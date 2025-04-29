import fs from "fs/promises"
import os from "os"
import * as path from "path"
import crypto from "crypto"
import EventEmitter from "events"

import simpleGit, { SimpleGit } from "simple-git"
import pWaitFor from "p-wait-for"

import { fileExistsAtPath } from "../../utils/fs"
import { executeRipgrep } from "../../services/search/file-search"

import { GIT_DISABLED_SUFFIX } from "./constants"
import { CheckpointDiff, CheckpointResult, CheckpointEventMap } from "./types"
import { getExcludePatterns } from "./excludes"

export abstract class ShadowCheckpointService extends EventEmitter {
	public readonly taskId: string
	public readonly checkpointsDir: string
	public readonly workspaceDir: string

	protected _checkpoints: string[] = []
	protected _baseHash?: string
	protected checkpointTimestamps: { commitHash: string; timestamp: number }[] = []

	protected readonly dotGitDir: string
	protected git?: SimpleGit
	protected readonly log: (message: string) => void
	protected shadowGitConfigWorktree?: string

	public get baseHash() {
		return this._baseHash
	}

	protected set baseHash(value: string | undefined) {
		this._baseHash = value
	}

	public get isInitialized() {
		return !!this.git
	}

	public get checkpoints(): readonly string[] {
		return this._checkpoints
	}

	public get timestamps(): readonly { commitHash: string; timestamp: number }[] {
		return this.checkpointTimestamps
	}

	constructor(taskId: string, checkpointsDir: string, workspaceDir: string, log: (message: string) => void) {
		super()

		const homedir = os.homedir()
		const desktopPath = path.join(homedir, "Desktop")
		const documentsPath = path.join(homedir, "Documents")
		const downloadsPath = path.join(homedir, "Downloads")
		const protectedPaths = [homedir, desktopPath, documentsPath, downloadsPath]

		if (protectedPaths.includes(workspaceDir)) {
			throw new Error(`Cannot use checkpoints in ${workspaceDir}`)
		}

		this.taskId = taskId
		this.checkpointsDir = checkpointsDir
		this.workspaceDir = workspaceDir

		this.dotGitDir = path.join(this.checkpointsDir, ".git")
		this.log = log
	}

	public async initShadowGit(onInit?: () => Promise<void>) {
		if (this.git) {
			throw new Error("Shadow git repo already initialized")
		}

		await fs.mkdir(this.checkpointsDir, { recursive: true })
		const git = simpleGit(this.checkpointsDir)
		const gitVersion = await git.version()
		this.log(`[${this.constructor.name}#create] git = ${gitVersion}`)

		let created = false
		const startTime = Date.now()

		if (await fileExistsAtPath(this.dotGitDir)) {
			this.log(`[${this.constructor.name}#initShadowGit] shadow git repo already exists at ${this.dotGitDir}`)
			const worktree = await this.getShadowGitConfigWorktree(git)

			if (worktree !== this.workspaceDir) {
				throw new Error(
					`Checkpoints can only be used in the original workspace: ${worktree} !== ${this.workspaceDir}`,
				)
			}

			await this.writeExcludeFile()

			try {
				// Check if the repository has any commits yet
				const logCheck = await git.log(["-n", "1"]).catch(() => null) // Catch error if log fails (e.g., empty repo)

				if (logCheck && logCheck.latest) {
					// Commits exist, proceed with restoring state
					let trueInitialCommitHash: string | undefined
					try {
						// Find the root commit (the actual initial commit)
						const initialCommitResult = await git.raw(["rev-list", "--max-parents=0", "HEAD"])
						trueInitialCommitHash = initialCommitResult?.trim()
					} catch (revListError) {
						this.log(
							`[ERROR] initShadowGit: Failed to get true initial commit hash: ${revListError}. Proceeding without reliable initial commit check.`,
						)
					}

					// Get current HEAD, mainly for logging/reference, not for loop logic
					this.baseHash = await git.revparse(["HEAD"]).catch(() => undefined)

					try {
						// Get log in reverse chronological order (newest first)
						const logResult = await git.log({ format: { hash: "%H", timestamp: "%ct" } })

						const recoveredCheckpoints: string[] = []
						const recoveredTimestamps: { commitHash: string; timestamp: number }[] = []
						const commits = [...logResult.all].reverse() // Oldest first

						for (const commit of commits) {
							const commitHash = commit.hash
							const timestamp = parseInt(commit.timestamp, 10) * 1000

							if (isNaN(timestamp)) {
								this.log(
									`[WARN] initShadowGit: Could not parse timestamp for commit ${commitHash}. Skipping.`,
								)
								continue
							}

							// Always add timestamp entry for every commit found
							recoveredTimestamps.push({ commitHash, timestamp })

							// Add to checkpoints array only if it's NOT the true initial commit
							if (commitHash !== trueInitialCommitHash) {
								recoveredCheckpoints.push(commitHash)
							} else {
								this.log(
									`[DEBUG] initShadowGit: Identified commit ${commitHash} as the true initial commit. Not adding to _checkpoints.`,
								)
							}
						}

						// Assign the recovered state
						this._checkpoints = recoveredCheckpoints
						// Ensure timestamps are sorted correctly by time
						this.checkpointTimestamps = recoveredTimestamps.sort((a, b) => a.timestamp - b.timestamp)

						// this.log(`[DEBUG] initShadowGit: Restored _checkpoints: ${JSON.stringify(this._checkpoints)}`);
						// this.log(`[DEBUG] initShadowGit: Restored checkpointTimestamps: ${JSON.stringify(this.checkpointTimestamps)}`);
					} catch (logError) {
						this.log(
							`[ERROR] initShadowGit: Failed to get git log to restore checkpoint state: ${logError}. State might be incorrect.`,
						)
						// Fallback: Initialize minimally
						this._checkpoints = []
						this.checkpointTimestamps = []
						if (this.baseHash) {
							this.checkpointTimestamps.push({ commitHash: this.baseHash, timestamp: startTime }) // Use startTime as fallback ts
						} else {
							this.log(
								`[WARN] initShadowGit: Fallback (log error) - Could not determine baseHash, state arrays left empty.`,
							)
						}
					}
				} else {
					// No commits found, perform initial commit
					this.log(
						`[${this.constructor.name}#initShadowGit] Repo exists but has no commits. Performing initial commit.`,
					)
					await this.stageAll(git)
					const { commit } = await git.commit("initial commit", { "--allow-empty": null })
					this.baseHash = commit
					if (this.baseHash) {
						// Initialize state after initial commit
						this._checkpoints = [] // No checkpoints yet
						this.checkpointTimestamps = [{ commitHash: this.baseHash, timestamp: Date.now() }] // Use current time for initial commit ts
					} else {
						this.log(`[ERROR] initShadowGit: Failed to get commit hash after initial commit.`)
						this._checkpoints = []
						this.checkpointTimestamps = []
					}
					created = true // Consider this as part of the creation process for logging/events
				}
			} catch (repoCheckError) {
				this.log(
					`[ERROR] initShadowGit: Error checking existing repo or performing initial commit: ${repoCheckError}. Aborting initialization.`,
				)
				// Re-throw the error as this indicates a potentially corrupted state
				throw repoCheckError
			}
		} else {
			this.log(`[${this.constructor.name}#initShadowGit] creating shadow git repo at ${this.checkpointsDir}`)
			await git.init()
			await git.addConfig("core.worktree", this.workspaceDir) // Sets the working tree to the current workspace.
			await git.addConfig("commit.gpgSign", "false") // Disable commit signing for shadow repo.
			await git.addConfig("user.name", "Roo Code")
			await git.addConfig("user.email", "noreply@example.com")
			await this.writeExcludeFile()
			await this.stageAll(git)
			const { commit } = await git.commit("initial commit", { "--allow-empty": null })
			this.baseHash = commit
			// Record initial timestamp when creating repo
			if (this.baseHash) {
				this.checkpointTimestamps = [{ commitHash: this.baseHash, timestamp: startTime }] // Use startTime for consistency
			}
			created = true
		}

		const duration = Date.now() - startTime

		this.log(
			`[${this.constructor.name}#initShadowGit] initialized shadow repo with base commit ${this.baseHash} in ${duration}ms`,
		)

		this.git = git

		await onInit?.()

		// Only emit initialize event if initialization seems successful (baseHash is set)
		if (this.baseHash) {
			this.emit("initialize", {
				type: "initialize",
				workspaceDir: this.workspaceDir,
				baseHash: this.baseHash, // Now guaranteed to be string here
				created,
				duration,
			})
		} else {
			this.log(
				`[ERROR] initShadowGit: Initialization failed or baseHash could not be determined. 'initialize' event not emitted.`,
			)
		}
		return { created, duration }
	}

	// Add basic excludes directly in git config, while respecting any
	// .gitignore in the workspace.
	// .git/info/exclude is local to the shadow git repo, so it's not
	// shared with the main repo - and won't conflict with user's
	// .gitignore.
	protected async writeExcludeFile() {
		await fs.mkdir(path.join(this.dotGitDir, "info"), { recursive: true })
		const patterns = await getExcludePatterns(this.workspaceDir)
		await fs.writeFile(path.join(this.dotGitDir, "info", "exclude"), patterns.join("\n"))
	}

	private async stageAll(git: SimpleGit) {
		await this.renameNestedGitRepos(true)

		try {
			await git.add(".")
		} catch (error) {
			this.log(
				`[${this.constructor.name}#stageAll] failed to add files to git: ${error instanceof Error ? error.message : String(error)}`,
			)
		} finally {
			await this.renameNestedGitRepos(false)
		}
	}

	// Since we use git to track checkpoints, we need to temporarily disable
	// nested git repos to work around git's requirement of using submodules for
	// nested repos.
	private async renameNestedGitRepos(disable: boolean) {
		try {
			// Find all .git directories that are not at the root level.
			const gitDir = ".git" + (disable ? "" : GIT_DISABLED_SUFFIX)
			const args = ["--files", "--hidden", "--follow", "-g", `**/${gitDir}/HEAD`, this.workspaceDir]

			const gitPaths = await (
				await executeRipgrep({ args, workspacePath: this.workspaceDir })
			).filter(({ type, path }) => type === "folder" && path.includes(".git") && !path.startsWith(".git"))

			// For each nested .git directory, rename it based on operation.
			for (const gitPath of gitPaths) {
				if (gitPath.path.startsWith(".git")) {
					continue
				}

				const currentPath = path.join(this.workspaceDir, gitPath.path)
				let newPath: string

				if (disable) {
					newPath = !currentPath.endsWith(GIT_DISABLED_SUFFIX)
						? currentPath + GIT_DISABLED_SUFFIX
						: currentPath
				} else {
					newPath = currentPath.endsWith(GIT_DISABLED_SUFFIX)
						? currentPath.slice(0, -GIT_DISABLED_SUFFIX.length)
						: currentPath
				}

				if (currentPath === newPath) {
					continue
				}

				try {
					await fs.rename(currentPath, newPath)

					this.log(
						`[${this.constructor.name}#renameNestedGitRepos] ${disable ? "disabled" : "enabled"} nested git repo ${currentPath}`,
					)
				} catch (error) {
					this.log(
						`[${this.constructor.name}#renameNestedGitRepos] failed to ${disable ? "disable" : "enable"} nested git repo ${currentPath}: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			}
		} catch (error) {
			this.log(
				`[${this.constructor.name}#renameNestedGitRepos] failed to ${disable ? "disable" : "enable"} nested git repos: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	private async getShadowGitConfigWorktree(git: SimpleGit) {
		if (!this.shadowGitConfigWorktree) {
			try {
				this.shadowGitConfigWorktree = (await git.getConfig("core.worktree")).value || undefined
			} catch (error) {
				this.log(
					`[${this.constructor.name}#getShadowGitConfigWorktree] failed to get core.worktree: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}

		return this.shadowGitConfigWorktree
	}

	public async saveCheckpoint(message: string): Promise<CheckpointResult | undefined> {
		try {
			this.log(`[${this.constructor.name}#saveCheckpoint] starting checkpoint save`)

			if (!this.git) {
				throw new Error("Shadow git repo not initialized")
			}

			const startTime = Date.now()
			await this.stageAll(this.git)
			const result = await this.git.commit(message)
			const isFirst = this._checkpoints.length === 0
			const fromHash = this._checkpoints[this._checkpoints.length - 1] ?? this.baseHash!
			const toHash = result.commit || fromHash
			const currentTimestamp = Date.now() // Capture timestamp before potentially long duration calculation
			this._checkpoints.push(toHash)
			// Record timestamp for the new checkpoint
			if (result.commit) {
				this.checkpointTimestamps.push({ commitHash: toHash, timestamp: currentTimestamp })
			}
			const duration = Date.now() - startTime

			if (isFirst || result.commit) {
				this.emit("checkpoint", { type: "checkpoint", isFirst, fromHash, toHash, duration })
			}

			if (result.commit) {
				this.log(
					`[${this.constructor.name}#saveCheckpoint] checkpoint saved in ${duration}ms -> ${result.commit}`,
				)
				return result
			} else {
				this.log(`[${this.constructor.name}#saveCheckpoint] found no changes to commit in ${duration}ms`)
				return undefined
			}
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e))
			this.log(`[${this.constructor.name}#saveCheckpoint] failed to create checkpoint: ${error.message}`)
			this.emit("error", { type: "error", error })
			throw error
		}
	}

	public async restoreCheckpoint(commitHash: string) {
		try {
			this.log(`[${this.constructor.name}#restoreCheckpoint] starting checkpoint restore`)

			if (!this.git) {
				throw new Error("Shadow git repo not initialized")
			}

			const start = Date.now()
			await this.git.clean("f", ["-d", "-f"])
			await this.git.reset(["--hard", commitHash])

			// Remove all checkpoints after the specified commitHash.
			const checkpointIndex = this._checkpoints.indexOf(commitHash)

			if (checkpointIndex !== -1) {
				// Also truncate the timestamp list to keep it in sync
				const timestampIndex = this.checkpointTimestamps.findIndex((item) => item.commitHash === commitHash)
				if (timestampIndex !== -1) {
					this.checkpointTimestamps = this.checkpointTimestamps.slice(0, timestampIndex + 1)
				}
				// Truncate the checkpoints list
				this._checkpoints = this._checkpoints.slice(0, checkpointIndex + 1)
			}

			const duration = Date.now() - start
			this.emit("restore", { type: "restore", commitHash, duration })
			this.log(`[${this.constructor.name}#restoreCheckpoint] restored checkpoint ${commitHash} in ${duration}ms`)
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e))
			this.log(`[${this.constructor.name}#restoreCheckpoint] failed to restore checkpoint: ${error.message}`)
			this.emit("error", { type: "error", error })
			throw error
		}
	}

	public async getDiff({ from, to }: { from?: string; to?: string }): Promise<CheckpointDiff[]> {
		if (!this.git) {
			throw new Error("Shadow git repo not initialized")
		}

		const result = []

		if (!from) {
			from = (await this.git.raw(["rev-list", "--max-parents=0", "HEAD"])).trim()
		}

		// Stage all changes so that untracked files appear in diff summary.
		await this.stageAll(this.git)

		this.log(`[${this.constructor.name}#getDiff] diffing ${to ? `${from}..${to}` : `${from}..HEAD`}`)
		const { files } = to ? await this.git.diffSummary([`${from}..${to}`]) : await this.git.diffSummary([from])

		const cwdPath = (await this.getShadowGitConfigWorktree(this.git)) || this.workspaceDir || ""

		for (const file of files) {
			const relPath = file.file
			const absPath = path.join(cwdPath, relPath)
			const before = await this.git.show([`${from}:${relPath}`]).catch(() => "")

			const after = to
				? await this.git.show([`${to}:${relPath}`]).catch(() => "")
				: await fs.readFile(absPath, "utf8").catch(() => "")

			result.push({ paths: { relative: relPath, absolute: absPath }, content: { before, after } })
		}

		return result
	}

	/**
	 * Finds the commit hash of the latest checkpoint created strictly *before* the given timestamp.
	 * Returns the baseHash if no checkpoint before the timestamp is found.
	 * @param timestamp The timestamp to compare against.
	 * @returns The commit hash string or undefined if the list is empty.
	 */
	public findCheckpointBefore(timestamp: number): string | undefined {
		if (!this.checkpointTimestamps || this.checkpointTimestamps.length === 0) {
			return this.baseHash // Return baseHash if no timestamps recorded yet
		}

		let foundHash: string | undefined = this.baseHash // Default to baseHash

		// Iterate backwards to find the first checkpoint strictly before the timestamp
		for (let i = this.checkpointTimestamps.length - 1; i >= 0; i--) {
			const checkpoint = this.checkpointTimestamps[i]
			if (checkpoint.timestamp < timestamp) {
				foundHash = checkpoint.commitHash
				break // Found the latest one before the target timestamp
			}
		}

		// If the loop finishes without finding one (meaning the message is older than the first recorded timestamp),
		// foundHash remains baseHash (or the hash of the earliest entry if baseHash wasn't set correctly initially).
		// If the first entry's timestamp is >= timestamp, it correctly returns baseHash.

		return foundHash
	}

	/**
	 * EventEmitter
	 */

	override emit<K extends keyof CheckpointEventMap>(event: K, data: CheckpointEventMap[K]) {
		return super.emit(event, data)
	}

	override on<K extends keyof CheckpointEventMap>(event: K, listener: (data: CheckpointEventMap[K]) => void) {
		return super.on(event, listener)
	}

	override off<K extends keyof CheckpointEventMap>(event: K, listener: (data: CheckpointEventMap[K]) => void) {
		return super.off(event, listener)
	}

	override once<K extends keyof CheckpointEventMap>(event: K, listener: (data: CheckpointEventMap[K]) => void) {
		return super.once(event, listener)
	}

	/**
	 * Storage
	 */

	public static hashWorkspaceDir(workspaceDir: string) {
		return crypto.createHash("sha256").update(workspaceDir).digest("hex").toString().slice(0, 8)
	}

	protected static taskRepoDir({ taskId, globalStorageDir }: { taskId: string; globalStorageDir: string }) {
		return path.join(globalStorageDir, "tasks", taskId, "checkpoints")
	}

	protected static workspaceRepoDir({
		globalStorageDir,
		workspaceDir,
	}: {
		globalStorageDir: string
		workspaceDir: string
	}) {
		return path.join(globalStorageDir, "checkpoints", this.hashWorkspaceDir(workspaceDir))
	}

	public static async deleteTask({
		taskId,
		globalStorageDir,
		workspaceDir,
	}: {
		taskId: string
		globalStorageDir: string
		workspaceDir: string
	}) {
		const workspaceRepoDir = this.workspaceRepoDir({ globalStorageDir, workspaceDir })
		const branchName = `roo-${taskId}`
		const git = simpleGit(workspaceRepoDir)
		const success = await this.deleteBranch(git, branchName)

		if (success) {
			console.log(`[${this.name}#deleteTask.${taskId}] deleted branch ${branchName}`)
		} else {
			console.error(`[${this.name}#deleteTask.${taskId}] failed to delete branch ${branchName}`)
		}
	}

	public static async deleteBranch(git: SimpleGit, branchName: string) {
		const branches = await git.branchLocal()

		if (!branches.all.includes(branchName)) {
			console.error(`[${this.constructor.name}#deleteBranch] branch ${branchName} does not exist`)
			return false
		}

		const currentBranch = await git.revparse(["--abbrev-ref", "HEAD"])

		if (currentBranch === branchName) {
			const worktree = await git.getConfig("core.worktree")

			try {
				await git.raw(["config", "--unset", "core.worktree"])
				await git.reset(["--hard"])
				await git.clean("f", ["-d"])
				const defaultBranch = branches.all.includes("main") ? "main" : "master"
				await git.checkout([defaultBranch, "--force"])

				await pWaitFor(
					async () => {
						const newBranch = await git.revparse(["--abbrev-ref", "HEAD"])
						return newBranch === defaultBranch
					},
					{ interval: 500, timeout: 2_000 },
				)

				await git.branch(["-D", branchName])
				return true
			} catch (error) {
				console.error(
					`[${this.constructor.name}#deleteBranch] failed to delete branch ${branchName}: ${error instanceof Error ? error.message : String(error)}`,
				)

				return false
			} finally {
				if (worktree.value) {
					await git.addConfig("core.worktree", worktree.value)
				}
			}
		} else {
			await git.branch(["-D", branchName])
			return true
		}
	}
}
