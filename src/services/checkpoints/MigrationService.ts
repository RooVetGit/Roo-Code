import fs from "fs/promises"
import path from "path"
import crypto from "crypto"
import simpleGit from "simple-git"

import { PatchDatabase } from "./PatchDatabase"
import { PatchGenerator } from "./PatchGenerator"
import { getExcludePatterns } from "./excludes"

/**
 * MigrationService handles migrating from the old Git-based checkpoint system
 * to the new patch-based checkpoint system.
 */
export class MigrationService {
	private readonly globalStorageDir: string
	private readonly log: (message: string) => void
	private readonly patchGenerator: PatchGenerator

	constructor(globalStorageDir: string, log: (message: string) => void) {
		this.globalStorageDir = globalStorageDir
		this.log = log
		this.patchGenerator = new PatchGenerator()
	}

	/**
	 * Migrate all tasks from the old Git-based checkpoint system to the new patch-based system
	 */
	public async migrateAllTasks(): Promise<void> {
		this.log("[MigrationService#migrateAllTasks] starting migration of all tasks")

		// Find all task directories
		const tasksDir = path.join(this.globalStorageDir, "tasks")

		try {
			const taskDirs = await fs.readdir(tasksDir)

			for (const taskId of taskDirs) {
				try {
					await this.migrateTask(taskId)
				} catch (error) {
					this.log(`[MigrationService#migrateAllTasks] error migrating task ${taskId}: ${error}`)
				}
			}

			this.log("[MigrationService#migrateAllTasks] migration completed")
		} catch (error) {
			this.log(`[MigrationService#migrateAllTasks] error reading tasks directory: ${error}`)
		}
	}

	/**
	 * Migrate a single task from the old Git-based checkpoint system to the new patch-based system
	 */
	public async migrateTask(taskId: string): Promise<void> {
		this.log(`[MigrationService#migrateTask] starting migration of task ${taskId}`)

		// Check if the old Git-based checkpoint directory exists
		const oldCheckpointsDir = path.join(this.globalStorageDir, "tasks", taskId, "checkpoints")
		const dotGitDir = path.join(oldCheckpointsDir, ".git")

		try {
			const gitDirExists = await fs
				.stat(dotGitDir)
				.then(() => true)
				.catch(() => false)

			if (!gitDirExists) {
				this.log(`[MigrationService#migrateTask] no Git repository found for task ${taskId}, skipping`)
				return
			}

			// Create new patch-based checkpoint directory
			const newCheckpointsDir = path.join(this.globalStorageDir, "tasks", taskId, "checkpoints-new")
			await fs.mkdir(newCheckpointsDir, { recursive: true })

			// Initialize database
			const db = new PatchDatabase(path.join(newCheckpointsDir, "checkpoints.db"))
			await db.initialize()

			// Get Git repository
			const git = simpleGit(oldCheckpointsDir)

			// Get worktree directory (workspace directory)
			const worktreeConfig = await git.raw(["config", "--get", "core.worktree"])
			const workspaceDir = worktreeConfig.trim()

			// Get commit history
			const log = await git.log()
			const commits = [...log.all].reverse() // Oldest first

			if (commits.length === 0) {
				this.log(`[MigrationService#migrateTask] no commits found for task ${taskId}, skipping`)
				return
			}

			// Create base snapshot from the first commit
			const baseCommit = commits[0]
			const baseSnapshotId = crypto.randomUUID()

			// Create snapshots directory
			const snapshotsDir = path.join(newCheckpointsDir, "snapshots", baseSnapshotId)
			await fs.mkdir(snapshotsDir, { recursive: true })

			// Get files from the first commit
			await git.checkout(baseCommit.hash)

			// Get exclude patterns
			const excludePatterns = await getExcludePatterns(workspaceDir)

			// Get all files in the workspace
			const files = await this.patchGenerator.getWorkspaceFiles(workspaceDir, excludePatterns)

			// Create base snapshot
			for (const file of files) {
				try {
					const relativePath = path.relative(workspaceDir, file)
					const content = await fs.readFile(file, "utf-8")

					// Create directory structure in snapshot
					const targetDir = path.dirname(path.join(snapshotsDir, relativePath))
					await fs.mkdir(targetDir, { recursive: true })

					// Write file content
					await fs.writeFile(path.join(snapshotsDir, relativePath), content)
				} catch (error) {
					this.log(`[MigrationService#migrateTask] error processing file ${file}: ${error}`)
				}
			}

			// Create task record
			await db.createTask({
				id: taskId,
				createdAt: new Date(baseCommit.date),
				baseSnapshotId,
				workspaceDir,
			})

			// Create patches directory
			const patchesDir = path.join(newCheckpointsDir, "patches")
			await fs.mkdir(patchesDir, { recursive: true })

			// Process each commit (except the first one, which is the base snapshot)
			let previousState: Record<string, string> = {}

			// Read base snapshot to get initial state
			const readDir = async (dir: string, base: string = "") => {
				const entries = await fs.readdir(dir, { withFileTypes: true })

				for (const entry of entries) {
					const fullPath = path.join(dir, entry.name)
					const relativePath = path.join(base, entry.name)

					if (entry.isDirectory()) {
						await readDir(fullPath, relativePath)
					} else {
						const content = await fs.readFile(fullPath, "utf-8")
						previousState[relativePath] = content
					}
				}
			}

			await readDir(snapshotsDir)

			// Process each commit after the base
			let parentCheckpointId: string | null = null

			for (let i = 1; i < commits.length; i++) {
				const commit = commits[i]
				const checkpointId = crypto.randomUUID()

				// Checkout this commit
				await git.checkout(commit.hash)

				// Get current state
				const currentState: Record<string, string> = {}
				const currentFiles = await this.patchGenerator.getWorkspaceFiles(workspaceDir, excludePatterns)

				for (const file of currentFiles) {
					try {
						const relativePath = path.relative(workspaceDir, file)
						const content = await fs.readFile(file, "utf-8")
						currentState[relativePath] = content
					} catch (error) {
						this.log(`[MigrationService#migrateTask] error reading file ${file}: ${error}`)
					}
				}

				// Generate patch
				const patch = this.patchGenerator.generatePatch(previousState, currentState)

				// Save patch to disk
				const patchPath = path.join(patchesDir, `${checkpointId}.json`)
				await fs.writeFile(patchPath, JSON.stringify(patch, null, 2))

				// Create checkpoint record
				await db.createCheckpoint({
					id: checkpointId,
					taskId,
					sequenceNum: i - 1, // Base snapshot is not a checkpoint
					parentCheckpointId,
					patchPath,
					metadata: { message: commit.message },
					createdAt: new Date(commit.date),
				})

				// Update for next iteration
				previousState = currentState
				parentCheckpointId = checkpointId
			}

			// Close database
			await db.close()

			// Rename directories to complete migration
			const oldCheckpointsDirBackup = path.join(this.globalStorageDir, "tasks", taskId, "checkpoints-old")
			await fs.rename(oldCheckpointsDir, oldCheckpointsDirBackup)
			await fs.rename(newCheckpointsDir, oldCheckpointsDir)

			this.log(`[MigrationService#migrateTask] migration completed for task ${taskId}`)
		} catch (error) {
			this.log(`[MigrationService#migrateTask] error migrating task ${taskId}: ${error}`)
			throw error
		}
	}
}
