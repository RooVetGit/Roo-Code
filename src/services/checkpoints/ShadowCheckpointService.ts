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

	protected readonly dotGitDir: string
	protected git?: SimpleGit
	protected readonly log: (message: string) => void
	// --- ADDITION: Static logger for static methods ---
	protected static log: (message: string) => void = console.log

	// --- CHANGE START: Add cache for nested git repo paths ---
	// --- ADDITION: GC related properties ---
	private gcCounter: number = 0
	private readonly GC_CHECKPOINT_THRESHOLD: number = Number(process.env.GC_CHECKPOINT_THRESHOLD) || 20 // Run gc every 20 checkpoints
	private _nestedGitDirPaths: string[] | null = null // Cache for relative paths like "submodule/.git"
	// --- CHANGE END: Add cache for nested git repo paths ---
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
			this.baseHash = await git.revparse(["HEAD"])

			// --- STAGE 1: Run GC on init for existing repo ---
			this.log(`[${this.constructor.name}#initShadowGit] Existing shadow repo found. Running garbage collection.`)
			try {
				const gcStartTime = Date.now()
				// Use the more thorough repack command
				this.log(`[${this.constructor.name}#initShadowGit] Running git repack -adf --path-walk --quiet...`)
				await git.raw(["repack", "-a", "-d", "-f", "--path-walk", "--quiet"])
				this.log(
					`[${this.constructor.name}#initShadowGit] Repository repack completed in ${Date.now() - gcStartTime}ms.`,
				)
			} catch (gcError) {
				this.log(
					`[${this.constructor.name}#initShadowGit] Repository repack failed: ${gcError instanceof Error ? gcError.message : String(gcError)}`,
				)
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
			created = true
		}

		const duration = Date.now() - startTime

		this.log(
			`[${this.constructor.name}#initShadowGit] initialized shadow repo with base commit ${this.baseHash} in ${duration}ms`,
		)

		this.git = git

		await onInit?.()

		// --- CHANGE START: Warm up the nested git paths cache ---
		// This ensures the potentially slow scan happens once during initialization.
		await this.findAndCacheNestedGitRepoPaths()
		// --- CHANGE END: Warm up the nested git paths cache ---

		this.emit("initialize", {
			type: "initialize",
			workspaceDir: this.workspaceDir,
			baseHash: this.baseHash,
			created,
			duration,
		})

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

	// --- CHANGE START: New method to find and cache nested .git directory paths ---
	// This method scans for nested .git directories once and caches their paths
	// to avoid repeated expensive scans by ripgrep.
	private async findAndCacheNestedGitRepoPaths(): Promise<string[]> {
		if (this._nestedGitDirPaths === null) {
			this.log(`[${this.constructor.name}#findAndCacheNestedGitRepoPaths] Scanning for nested .git directories.`)
			// Ripgrep for .git/HEAD files, excluding the root .git/HEAD of the workspace itself.
			// Note: The original `renameNestedGitRepos` looked for `**/${gitDir}/HEAD`.
			// We'll look for `**/.git/HEAD` and then `renameNestedGitRepos` will handle the suffix.
			const ripGrepArgs = [
				"--files",
				"--hidden",
				"--follow",
				"-g",
				`**/${path.join(".git", "HEAD")}`,
				this.workspaceDir,
			]
			const headFileEntries = await executeRipgrep({ args: ripGrepArgs, workspacePath: this.workspaceDir })

			this._nestedGitDirPaths = headFileEntries
				.filter(
					({ type, path: p }) =>
						type === "file" &&
						p.endsWith(path.join(".git", "HEAD")) && // Ensure it's a HEAD file
						p !== path.join(".git", "HEAD"), // Exclude the main .git/HEAD if workspaceDir is a git repo
				)
				.map((entry) => path.dirname(entry.path)) // Get the .git directory path (relative to workspaceDir)

			this.log(
				`[${this.constructor.name}#findAndCacheNestedGitRepoPaths] Found ${this._nestedGitDirPaths.length} nested .git directories.`,
			)
		}
		return this._nestedGitDirPaths
	}
	// --- CHANGE END: New method to find and cache nested .git directory paths ---

	// --- CHANGE START: Modify stageAll to be more performant ---
	// Instead of `git add .`, this uses `git status` to find specific changes
	// and then `git add <files>` and `git rm <files>`.
	private async stageAll(git: SimpleGit) {
		await this.renameNestedGitRepos(true)

		try {
			// Use git status to find changed/new/deleted files and stage them specifically
			const status = await git.status(["--porcelain=v1", "-uall"]) // -uall includes all untracked files
			const filesToAdd: string[] = []
			const filesToRemove: string[] = []

			if (status && status.files && status.files.length > 0) {
				// simple-git's status.files is an array of objects like:
				// { path: 'file.txt', index: 'M', working_dir: ' ' }
				// index: Status of the index
				// working_dir: Status of the working directory
				status.files.forEach((file) => {
					const filePath = file.path
					// Determine if file needs to be added or removed
					// 'D' in index or working_dir means deleted
					if (file.index === "D" || file.working_dir === "D") {
						filesToRemove.push(filePath)
					} else if (file.index === "?" || file.working_dir === "?") {
						// Untracked
						filesToAdd.push(filePath)
					} else if (file.index === "A" || file.working_dir === "A") {
						// Added
						filesToAdd.push(filePath)
					} else if (file.index === "M" || file.working_dir === "M") {
						// Modified
						filesToAdd.push(filePath)
					} else if (file.index.startsWith("R") || file.working_dir.startsWith("R")) {
						// Renamed
						filesToAdd.push(filePath) // Add the new path
					} else if (file.index.startsWith("C") || file.working_dir.startsWith("C")) {
						// Copied
						filesToAdd.push(filePath) // Add the new path
					}
					// Other statuses like 'U' (unmerged) might need specific handling if relevant
				})
			}

			if (filesToRemove.length > 0) {
				await git.rm(filesToRemove)
			}
			if (filesToAdd.length > 0) {
				await git.add(filesToAdd)
			}
		} catch (error) {
			this.log(
				`[${this.constructor.name}#stageAll] failed to process git status or stage/remove files: ${error instanceof Error ? error.message : String(error)}`,
			)
			throw error
		} finally {
			await this.renameNestedGitRepos(false)
		}
	}
	// Since we use git to track checkpoints, we need to temporarily disable
	// nested git repos to work around git's requirement of using submodules for
	// nested repos.

	// This method now uses the pre-scanned and cached list of nested .git directories.
	private async renameNestedGitRepos(disable: boolean) {
		const nestedGitDirPaths = await this.findAndCacheNestedGitRepoPaths() // Uses cache after first scan

		for (const relativeGitDirPath of nestedGitDirPaths) {
			// e.g., "submoduleA/.git"
			const originalGitPath = path.join(this.workspaceDir, relativeGitDirPath) // Becomes absolute path
			const disabledGitPath = originalGitPath + GIT_DISABLED_SUFFIX

			try {
				if (disable) {
					// Check if the original .git directory exists and is not already disabled
					if ((await fileExistsAtPath(originalGitPath)) && !originalGitPath.endsWith(GIT_DISABLED_SUFFIX)) {
						await fs.rename(originalGitPath, disabledGitPath)
						this.log(
							`[${this.constructor.name}#renameNestedGitRepos] disabled nested git repo ${originalGitPath}`,
						)
					}
				} else {
					// Check if the disabled version exists
					if (await fileExistsAtPath(disabledGitPath)) {
						await fs.rename(disabledGitPath, originalGitPath)
						this.log(
							`[${this.constructor.name}#renameNestedGitRepos] enabled nested git repo ${originalGitPath}`,
						)
					}
				}
			} catch (error) {
				// Log specific error for this rename operation but continue with others
				this.log(
					`[${this.constructor.name}#renameNestedGitRepos] failed to ${disable ? "disable" : "enable"} ${originalGitPath}: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}
	}
	// --- CHANGE END: Modify renameNestedGitRepos to use cached paths ---

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
			this._checkpoints.push(toHash)
			const duration = Date.now() - startTime

			if (isFirst || result.commit) {
				this.emit("checkpoint", { type: "checkpoint", isFirst, fromHash, toHash, duration })
			}

			if (result.commit) {
				this.log(
					`[${this.constructor.name}#saveCheckpoint] checkpoint saved in ${duration}ms -> ${result.commit}`,
				)

				// --- STAGE 2: Periodically run GC after saving checkpoints ---
				this.gcCounter++
				if (this.gcCounter >= this.GC_CHECKPOINT_THRESHOLD) {
					this.log(
						`[${this.constructor.name}#saveCheckpoint] Reached gc threshold (${this.GC_CHECKPOINT_THRESHOLD}). Running background gc.`,
					)
					this.gcCounter = 0 // Reset counter

					// Run gc asynchronously (fire and forget) to avoid blocking the save operation.
					this.git
						.raw(["gc"])
						.then(() => {
							this.log(
								`[${this.constructor.name}#saveCheckpoint] Background garbage collection completed.`,
							)
						})
						.catch((gcError: any) => {
							this.log(
								`[${this.constructor.name}#saveCheckpoint] Background garbage collection failed: ${gcError instanceof Error ? gcError.message : String(gcError)}`,
							)
						})
				}
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

			// --- CHANGE START: Consider if renameNestedGitRepos is needed around clean/reset ---
			// If `git clean` or `git reset` could be affected by nested .git repos
			// (e.g., if they try to operate on them as submodules despite core.worktree),
			// you might need to wrap this section with renameNestedGitRepos(true/false).
			// However, `core.worktree` usually makes Git operate on the workspace files directly.
			// For now, assuming it's not strictly needed here for performance, but it's a thought.
			// await this.renameNestedGitRepos(true);
			// try {
			await this.git.clean("f", ["-d", "-f"])
			await this.git.reset(["--hard", commitHash])
			// } finally {
			//    await this.renameNestedGitRepos(false);
			// }
			// --- CHANGE END: Consider if renameNestedGitRepos is needed around clean/reset ---

			// Remove all checkpoints after the specified commitHash.
			const checkpointIndex = this._checkpoints.indexOf(commitHash)

			if (checkpointIndex !== -1) {
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

		if (!from) {
			// Get the initial commit hash if 'from' is not provided
			const revListOutput = await this.git.raw(["rev-list", "--max-parents=0", "HEAD"])
			from = revListOutput ? revListOutput.trim() : undefined
			if (!from) {
				this.log(`[${this.constructor.name}#getDiff] Could not determine initial commit (baseHash).`)
				return [] // Or throw an error, depending on desired behavior
			}
		}

		// Stage changes only if diffing against the working directory (when 'to' is undefined).
		// This ensures untracked files are considered by `git diff <commit>`.
		// `git diff <commit1>..<commit2>` doesn't need this staging of the working dir.
		if (!to) {
			await this.stageAll(this.git)
		}

		this.log(
			`[${this.constructor.name}#getDiff] diffing ${to ? `${from}..${to}` : `${from}..HEAD (working directory)`}`,
		)

		// Use `git diff --name-status` for a more precise list of changes (Added, Modified, Deleted, Renamed).
		const diffArgs = ["--name-status"]
		if (to) {
			diffArgs.push(`${from}..${to}`)
		} else {
			diffArgs.push(from) // Diff commit 'from' against the (staged) working tree
		}

		const nameStatusOutput = (await this.git.diff(diffArgs)).trim()
		const fileInfos: Array<{ path: string; status: string; origPath?: string }> = []

		if (nameStatusOutput) {
			nameStatusOutput.split("\n").forEach((line) => {
				if (!line.trim()) return
				const parts = line.split("\t")
				const status = parts[0][0] // First char of status, e.g., 'A', 'M', 'D', 'R', 'C'
				let filePath = parts[1]
				let origPath: string | undefined

				if ((status === "R" || status === "C") && parts.length > 2) {
					// Renamed or Copied
					origPath = parts[1] // The original path
					filePath = parts[2] // The new path
				}
				fileInfos.push({ path: filePath, status, origPath })
			})
		}

		const cwdPath = (await this.getShadowGitConfigWorktree(this.git)) || this.workspaceDir || ""
		const result: CheckpointDiff[] = []

		for (const info of fileInfos) {
			const relPath = info.path
			const absPath = path.join(cwdPath, relPath)
			let beforeContent = ""
			let afterContent = ""

			// Fetch 'before' content if the file was not Added (i.e., it existed in 'from' or was renamed/copied from an existing file)
			if (info.status !== "A") {
				const pathForBefore = info.origPath || relPath // Use original path for renames/copies
				try {
					beforeContent = await this.git.show([`${from}:${pathForBefore}`])
				} catch (showError) {
					// File might not exist in 'from' if it was, for example, deleted and then re-added differently,
					// or if it's binary and show fails. Log or handle as needed.
					this.log(
						`[${this.constructor.name}#getDiff] Could not git.show ${from}:${pathForBefore}. Error: ${showError}`,
					)
					beforeContent = "" // Default to empty string
				}
			}

			// Fetch 'after' content if the file was not Deleted
			if (info.status !== "D") {
				if (to) {
					// Diffing between two commits
					try {
						afterContent = await this.git.show([`${to}:${relPath}`])
					} catch (showError) {
						this.log(
							`[${this.constructor.name}#getDiff] Could not git.show ${to}:${relPath}. Error: ${showError}`,
						)
						afterContent = ""
					}
				} else {
					// Diffing against working directory
					try {
						// Ensure file exists before reading, especially if it's newly added in working dir but not yet committed.
						if (await fileExistsAtPath(absPath)) {
							afterContent = await fs.readFile(absPath, "utf8")
						} else {
							// This case should be rare if stageAll correctly added new files.
							this.log(
								`[${this.constructor.name}#getDiff] File ${absPath} not found in working directory for 'after' content.`,
							)
							afterContent = ""
						}
					} catch (readError) {
						this.log(
							`[${this.constructor.name}#getDiff] Could not fs.readFile ${absPath}. Error: ${readError}`,
						)
						afterContent = ""
					}
				}
			}
			result.push({
				paths: { relative: relPath, absolute: absPath },
				content: { before: beforeContent, after: afterContent },
			})
		}
		return result
	}
	// --- CHANGE END: Modify getDiff for performance and accuracy ---

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

	public static setStaticLogger(logger: (message: string) => void) {
		ShadowCheckpointService.log = logger
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
			this.log(`[${this.name}#deleteTask.${taskId}] deleted branch ${branchName}`)
		} else {
			this.log(`[${this.name}#deleteTask.${taskId}] ERROR: failed to delete branch ${branchName}`)
		}
	}

	public static async deleteBranch(git: SimpleGit, branchName: string) {
		const branches = await git.branchLocal()

		if (!branches.all.includes(branchName)) {
			this.log(`[${this.name}#deleteBranch] ERROR: branch ${branchName} does not exist`)
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
				// --- STAGE 3: Run GC after deleting a branch ---
				try {
					this.log(`[${this.name}#deleteBranch] Running gc --prune=now after deleting branch ${branchName}`)
					// Using raw for --prune=now as simple-git's gc() doesn't directly support it.
					// Fire-and-forget
					git.raw(["gc", "--prune=now", "--quiet"])
						.then(() => {
							this.log(
								`[${this.name}#deleteBranch] Background gc --prune=now completed for branch ${branchName}`,
							)
						})
						.catch((gcError) => {
							this.log(
								`[${this.name}#deleteBranch] ERROR: Background gc after deleting branch ${branchName} failed: ${gcError instanceof Error ? gcError.message : String(gcError)}`,
							)
						})
				} catch (e) {
					// This catch is for synchronous errors in *initiating* the gc, not for gc runtime errors.
					// Runtime errors of gc are handled by the .catch() above.
					this.log(
						`[${this.name}#deleteBranch] ERROR: Failed to initiate gc: ${e instanceof Error ? e.message : String(e)}`,
					)
				}

				return true
			} catch (error) {
				this.log(
					`[${this.name}#deleteBranch] ERROR: failed to delete branch ${branchName}: ${error instanceof Error ? error.message : String(error)}`,
				)

				return false
			} finally {
				if (worktree.value) {
					await git.addConfig("core.worktree", worktree.value)
				}
			}
		} else {
			await git.branch(["-D", branchName])
			// --- STAGE 3: Run GC after deleting a branch ---
			try {
				this.log(`[${this.name}#deleteBranch] Running gc --prune=now after deleting branch ${branchName}`)
				// Fire-and-forget
				git.raw(["gc", "--prune=now", "--quiet"])
					.then(() => {
						this.log(
							`[${this.name}#deleteBranch] Background gc --prune=now completed for branch ${branchName}`,
						)
					})
					.catch((gcError) => {
						this.log(
							`[${this.name}#deleteBranch] ERROR: Background gc after deleting branch ${branchName} failed: ${gcError instanceof Error ? gcError.message : String(gcError)}`,
						)
					})
			} catch (e) {
				// This catch is for synchronous errors in *initiating* the gc.
				this.log(
					`[${this.name}#deleteBranch] ERROR: Failed to initiate gc: ${e instanceof Error ? e.message : String(e)}`,
				)
			}

			return true
		}
	}
}
