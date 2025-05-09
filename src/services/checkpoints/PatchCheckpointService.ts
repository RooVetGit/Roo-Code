import fs from "fs/promises"
import path from "path"
import crypto from "crypto"
import EventEmitter from "events"

import { CheckpointDiff, CheckpointResult, CheckpointEventMap } from "./types"
import { getExcludePatterns } from "./excludes"
import { PatchDatabase } from "./PatchDatabase"
import { PatchGenerator } from "./PatchGenerator"

/**
 * PatchCheckpointService implements a patch-based checkpoint system that stores
 * only the differences between states, drastically reducing storage requirements
 * while maintaining full functionality.
 */
export class PatchCheckpointService extends EventEmitter {
	public readonly taskId: string
	public readonly checkpointsDir: string
	public readonly workspaceDir: string

	protected _checkpoints: string[] = []
	protected _baseSnapshot?: string

	protected readonly log: (message: string) => void
	protected readonly db: PatchDatabase
	protected readonly patchGenerator: PatchGenerator
	protected _isInitialized: boolean = false

	public get baseSnapshot() {
		return this._baseSnapshot
	}

	protected set baseSnapshot(value: string | undefined) {
		this._baseSnapshot = value
	}

	public get isInitialized() {
		return this._isInitialized
	}

	constructor(taskId: string, checkpointsDir: string, workspaceDir: string, log: (message: string) => void) {
		super()

		// Prevent using checkpoints in protected directories
		const homedir = process.env.HOME || process.env.USERPROFILE || ""
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
		this.log = log

		// Initialize the database and patch generator
		this.db = new PatchDatabase(path.join(checkpointsDir, "checkpoints.db"))
		this.patchGenerator = new PatchGenerator()
	}

	/**
	 * Initialize the checkpoint service
	 */
	public async initialize(): Promise<{ created: boolean; duration: number }> {
		if (this._isInitialized) {
			throw new Error("Checkpoint service already initialized")
		}

		const startTime = Date.now()
		this.log(`[${this.constructor.name}#initialize] initializing checkpoint service`)

		// Create checkpoints directory if it doesn't exist
		await fs.mkdir(this.checkpointsDir, { recursive: true })

		// Initialize the database
		await this.db.initialize()

		// Check if we have an existing base snapshot
		const existingTask = await this.db.getTask(this.taskId)
		let created = false

		if (existingTask) {
			this.log(`[${this.constructor.name}#initialize] task already exists in database`)
			this.baseSnapshot = existingTask.baseSnapshotId

			// Load existing checkpoints
			const checkpoints = await this.db.getCheckpoints(this.taskId)
			this._checkpoints = checkpoints.map((c) => c.id)
		} else {
			this.log(`[${this.constructor.name}#initialize] creating new task in database`)

			// Create base snapshot
			const baseSnapshotId = crypto.randomUUID()
			this.baseSnapshot = baseSnapshotId

			// Create a snapshot of the current workspace
			await this.createBaseSnapshot(baseSnapshotId)

			// Create task record in database
			await this.db.createTask({
				id: this.taskId,
				createdAt: new Date(),
				baseSnapshotId,
				workspaceDir: this.workspaceDir,
			})

			created = true
		}

		this._isInitialized = true
		const duration = Date.now() - startTime

		this.log(
			`[${this.constructor.name}#initialize] initialized checkpoint service with base snapshot ${this.baseSnapshot} in ${duration}ms`,
		)

		this.emit("initialize", {
			type: "initialize",
			workspaceDir: this.workspaceDir,
			baseHash: this.baseSnapshot!,
			created,
			duration,
		})

		return { created, duration }
	}

	/**
	 * Create a base snapshot of the current workspace
	 */
	private async createBaseSnapshot(snapshotId: string): Promise<void> {
		this.log(`[${this.constructor.name}#createBaseSnapshot] creating base snapshot`)

		// Get files to include in snapshot (respecting excludes)
		const excludePatterns = await getExcludePatterns(this.workspaceDir)
		const files = await this.patchGenerator.getWorkspaceFiles(this.workspaceDir, excludePatterns)

		// Create snapshot directory
		const snapshotDir = path.join(this.checkpointsDir, "snapshots", snapshotId)
		await fs.mkdir(snapshotDir, { recursive: true })

		// Store file contents
		for (const file of files) {
			try {
				const relativePath = path.relative(this.workspaceDir, file)
				const content = await fs.readFile(file, "utf-8")

				// Create directory structure in snapshot
				const targetDir = path.dirname(path.join(snapshotDir, relativePath))
				await fs.mkdir(targetDir, { recursive: true })

				// Write file content
				await fs.writeFile(path.join(snapshotDir, relativePath), content)
			} catch (error) {
				this.log(`[${this.constructor.name}#createBaseSnapshot] error processing file ${file}: ${error}`)
			}
		}

		this.log(`[${this.constructor.name}#createBaseSnapshot] base snapshot created with ${files.length} files`)
	}

	/**
	 * Save a new checkpoint
	 */
	public async saveCheckpoint(message: string): Promise<CheckpointResult | undefined> {
		try {
			this.log(`[${this.constructor.name}#saveCheckpoint] starting checkpoint save`)

			if (!this.isInitialized) {
				throw new Error("Checkpoint service not initialized")
			}

			const startTime = Date.now()

			// Generate a unique ID for this checkpoint
			const checkpointId = crypto.randomUUID()

			// Determine parent checkpoint
			const parentCheckpointId =
				this._checkpoints.length > 0 ? this._checkpoints[this._checkpoints.length - 1] : null

			// Get the source state to compare against
			const sourceState = parentCheckpointId
				? await this.getCheckpointState(parentCheckpointId)
				: await this.getBaseSnapshotState()

			// Get current workspace state
			const currentState = await this.getCurrentWorkspaceState()

			// Generate patch
			const patch = this.patchGenerator.generatePatch(sourceState, currentState)

			// If there are no changes, return undefined
			if (Object.keys(patch.files).length === 0) {
				this.log(
					`[${this.constructor.name}#saveCheckpoint] found no changes to commit in ${Date.now() - startTime}ms`,
				)
				return undefined
			}

			// Save patch to disk
			const patchDir = path.join(this.checkpointsDir, "patches")
			await fs.mkdir(patchDir, { recursive: true })

			const patchPath = path.join(patchDir, `${checkpointId}.json`)
			await fs.writeFile(patchPath, JSON.stringify(patch, null, 2))

			// Create checkpoint record in database
			await this.db.createCheckpoint({
				id: checkpointId,
				taskId: this.taskId,
				sequenceNum: this._checkpoints.length,
				parentCheckpointId,
				patchPath,
				metadata: { message },
				createdAt: new Date(),
			})

			// Update checkpoints array
			this._checkpoints.push(checkpointId)

			const isFirst = this._checkpoints.length === 1
			const fromHash = parentCheckpointId ?? this.baseSnapshot!
			const toHash = checkpointId
			const duration = Date.now() - startTime

			this.emit("checkpoint", {
				type: "checkpoint",
				isFirst,
				fromHash,
				toHash,
				duration,
			})

			this.log(`[${this.constructor.name}#saveCheckpoint] checkpoint saved in ${duration}ms -> ${checkpointId}`)

			return {
				commit: checkpointId,
			}
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e))
			this.log(`[${this.constructor.name}#saveCheckpoint] failed to create checkpoint: ${error.message}`)
			this.emit("error", { type: "error", error })
			throw error
		}
	}

	/**
	 * Restore a checkpoint
	 */
	public async restoreCheckpoint(checkpointId: string) {
		try {
			this.log(`[${this.constructor.name}#restoreCheckpoint] starting checkpoint restore for ${checkpointId}`)

			if (!this.isInitialized) {
				throw new Error("Checkpoint service not initialized")
			}

			const start = Date.now()

			// Get the checkpoint state
			const state = await this.getCheckpointState(checkpointId)

			// Apply the state to the workspace
			await this.applyStateToWorkspace(state)

			// Remove all checkpoints after the specified checkpointId
			const checkpointIndex = this._checkpoints.indexOf(checkpointId)
			if (checkpointIndex !== -1) {
				this._checkpoints = this._checkpoints.slice(0, checkpointIndex + 1)
			}

			const duration = Date.now() - start
			this.emit("restore", { type: "restore", commitHash: checkpointId, duration })
			this.log(
				`[${this.constructor.name}#restoreCheckpoint] restored checkpoint ${checkpointId} in ${duration}ms`,
			)
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e))
			this.log(`[${this.constructor.name}#restoreCheckpoint] failed to restore checkpoint: ${error.message}`)
			this.emit("error", { type: "error", error })
			throw error
		}
	}

	/**
	 * Get the differences between two checkpoints
	 */
	public async getDiff({ from, to }: { from?: string; to?: string }): Promise<CheckpointDiff[]> {
		if (!this.isInitialized) {
			throw new Error("Checkpoint service not initialized")
		}

		const result: CheckpointDiff[] = []

		if (!from) {
			from = this.baseSnapshot
		}

		// Get the source state
		const sourceState =
			from === this.baseSnapshot ? await this.getBaseSnapshotState() : await this.getCheckpointState(from)

		// Get the target state
		const targetState = to ? await this.getCheckpointState(to) : await this.getCurrentWorkspaceState()

		// Compare states and generate diffs
		for (const [relativePath, targetContent] of Object.entries(targetState)) {
			const sourceContent = sourceState[relativePath] || ""

			if (sourceContent !== targetContent) {
				const absolutePath = path.join(this.workspaceDir, relativePath)

				result.push({
					paths: {
						relative: relativePath,
						absolute: absolutePath,
					},
					content: {
						before: sourceContent,
						after: targetContent,
					},
				})
			}
		}

		// Also check for files that were in source but not in target (deletions)
		for (const relativePath of Object.keys(sourceState)) {
			if (!targetState[relativePath]) {
				const absolutePath = path.join(this.workspaceDir, relativePath)

				result.push({
					paths: {
						relative: relativePath,
						absolute: absolutePath,
					},
					content: {
						before: sourceState[relativePath],
						after: "",
					},
				})
			}
		}

		return result
	}

	/**
	 * Get the state of the base snapshot
	 */
	private async getBaseSnapshotState(): Promise<Record<string, string>> {
		const state: Record<string, string> = {}
		const snapshotDir = path.join(this.checkpointsDir, "snapshots", this.baseSnapshot!)

		// Walk through the snapshot directory and read all files
		const readDir = async (dir: string, base: string = "") => {
			const entries = await fs.readdir(dir, { withFileTypes: true })

			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name)
				const relativePath = path.join(base, entry.name)

				if (entry.isDirectory()) {
					await readDir(fullPath, relativePath)
				} else {
					const content = await fs.readFile(fullPath, "utf-8")
					state[relativePath] = content
				}
			}
		}

		await readDir(snapshotDir)
		return state
	}

	/**
	 * Get the state of a checkpoint by applying patches
	 */
	private async getCheckpointState(checkpointId: string): Promise<Record<string, string>> {
		// Get the checkpoint and its ancestors
		const checkpoint = await this.db.getCheckpoint(checkpointId)
		if (!checkpoint) {
			throw new Error(`Checkpoint ${checkpointId} not found`)
		}

		// Start with the base snapshot state
		let state = await this.getBaseSnapshotState()

		// Get the path from base to the target checkpoint
		const path = await this.db.getCheckpointPath(checkpointId)

		// Apply patches in order
		for (const cp of path) {
			const patchContent = await fs.readFile(cp.patchPath, "utf-8")
			const patch = JSON.parse(patchContent)

			// Apply patch to state
			state = this.patchGenerator.applyPatch(state, patch)
		}

		return state
	}

	/**
	 * Get the current state of the workspace
	 */
	private async getCurrentWorkspaceState(): Promise<Record<string, string>> {
		const state: Record<string, string> = {}

		// Get files to include (respecting excludes)
		const excludePatterns = await getExcludePatterns(this.workspaceDir)
		const files = await this.patchGenerator.getWorkspaceFiles(this.workspaceDir, excludePatterns)

		// Read file contents
		for (const file of files) {
			try {
				const relativePath = path.relative(this.workspaceDir, file)
				const content = await fs.readFile(file, "utf-8")
				state[relativePath] = content
			} catch (error) {
				this.log(`[${this.constructor.name}#getCurrentWorkspaceState] error reading file ${file}: ${error}`)
			}
		}

		return state
	}

	/**
	 * Apply a state to the workspace
	 */
	private async applyStateToWorkspace(state: Record<string, string>): Promise<void> {
		// Get current files in workspace
		const excludePatterns = await getExcludePatterns(this.workspaceDir)
		const currentFiles = await this.patchGenerator.getWorkspaceFiles(this.workspaceDir, excludePatterns)
		const currentRelativePaths = currentFiles.map((f) => path.relative(this.workspaceDir, f))

		// Apply state files
		for (const [relativePath, content] of Object.entries(state)) {
			const absolutePath = path.join(this.workspaceDir, relativePath)

			// Create directory if it doesn't exist
			const dir = path.dirname(absolutePath)
			await fs.mkdir(dir, { recursive: true })

			// Write file content
			await fs.writeFile(absolutePath, content)
		}

		// Remove files that are not in the state
		for (const relativePath of currentRelativePaths) {
			if (!state[relativePath]) {
				const absolutePath = path.join(this.workspaceDir, relativePath)
				await fs.unlink(absolutePath).catch(() => {})
			}
		}
	}

	/**
	 * EventEmitter overrides
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
	 * Close the database connection
	 */
	public async close(): Promise<void> {
		await this.db.close()
	}

	/**
	 * Static utility methods
	 */
	public static hashWorkspaceDir(workspaceDir: string) {
		return crypto.createHash("sha256").update(workspaceDir).digest("hex").toString().slice(0, 8)
	}

	public static async deleteTask({ taskId, globalStorageDir }: { taskId: string; globalStorageDir: string }) {
		const checkpointsDir = path.join(globalStorageDir, "tasks", taskId, "checkpoints")

		try {
			// Remove the entire checkpoints directory for this task
			await fs.rm(checkpointsDir, { recursive: true, force: true })
			console.log(`[${this.name}#deleteTask.${taskId}] deleted checkpoint directory`)
		} catch (error) {
			console.error(`[${this.name}#deleteTask.${taskId}] failed to delete checkpoint directory: ${error}`)
		}
	}
}
