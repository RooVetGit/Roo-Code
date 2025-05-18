import sqlite3 from "sqlite3"
import { open, Database } from "sqlite"

/**
 * Task record in the database
 */
export interface Task {
	id: string
	createdAt: Date
	baseSnapshotId: string
	workspaceDir: string
}

/**
 * Checkpoint record in the database
 */
export interface Checkpoint {
	id: string
	taskId: string
	sequenceNum: number
	parentCheckpointId: string | null
	patchPath: string
	metadata: any
	createdAt: Date
}

/**
 * PatchDatabase handles SQLite database operations for the patch-based checkpoint system
 */
export class PatchDatabase {
	private dbPath: string
	private db: Database | null = null

	constructor(dbPath: string) {
		this.dbPath = dbPath
	}

	/**
	 * Initialize the database
	 */
	public async initialize(): Promise<void> {
		// Open the database
		this.db = await open({
			filename: this.dbPath,
			driver: sqlite3.Database,
		})

		// Enable WAL mode for better performance
		await this.db.exec("PRAGMA journal_mode = WAL")

		// Create tables if they don't exist
		await this.db.exec(`
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                created_at INTEGER NOT NULL,
                base_snapshot_id TEXT NOT NULL,
                workspace_dir TEXT NOT NULL
            );
            
            CREATE TABLE IF NOT EXISTS checkpoints (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                sequence_num INTEGER NOT NULL,
                parent_checkpoint_id TEXT,
                patch_path TEXT NOT NULL,
                metadata TEXT,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (task_id) REFERENCES tasks(id),
                FOREIGN KEY (parent_checkpoint_id) REFERENCES checkpoints(id)
            );
            
            CREATE INDEX IF NOT EXISTS idx_checkpoints_task_id ON checkpoints(task_id);
            CREATE INDEX IF NOT EXISTS idx_checkpoints_parent_id ON checkpoints(parent_checkpoint_id);
        `)
	}

	/**
	 * Close the database connection
	 */
	public async close(): Promise<void> {
		if (this.db) {
			await this.db.close()
			this.db = null
		}
	}

	/**
	 * Create a new task
	 */
	public async createTask(task: Task): Promise<void> {
		if (!this.db) {
			throw new Error("Database not initialized")
		}

		await this.db.run(
			`INSERT INTO tasks (id, created_at, base_snapshot_id, workspace_dir) 
             VALUES (?, ?, ?, ?)`,
			task.id,
			task.createdAt.getTime(),
			task.baseSnapshotId,
			task.workspaceDir,
		)
	}

	/**
	 * Get a task by ID
	 */
	public async getTask(taskId: string): Promise<Task | null> {
		if (!this.db) {
			throw new Error("Database not initialized")
		}

		const row = await this.db.get(
			`SELECT id, created_at, base_snapshot_id, workspace_dir 
             FROM tasks 
             WHERE id = ?`,
			taskId,
		)

		if (!row) {
			return null
		}

		return {
			id: row.id,
			createdAt: new Date(row.created_at),
			baseSnapshotId: row.base_snapshot_id,
			workspaceDir: row.workspace_dir,
		}
	}

	/**
	 * Create a new checkpoint
	 */
	public async createCheckpoint(checkpoint: Checkpoint): Promise<void> {
		if (!this.db) {
			throw new Error("Database not initialized")
		}

		await this.db.run(
			`INSERT INTO checkpoints (id, task_id, sequence_num, parent_checkpoint_id, patch_path, metadata, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
			checkpoint.id,
			checkpoint.taskId,
			checkpoint.sequenceNum,
			checkpoint.parentCheckpointId,
			checkpoint.patchPath,
			JSON.stringify(checkpoint.metadata),
			checkpoint.createdAt.getTime(),
		)
	}

	/**
	 * Get a checkpoint by ID
	 */
	public async getCheckpoint(checkpointId: string): Promise<Checkpoint | null> {
		if (!this.db) {
			throw new Error("Database not initialized")
		}

		const row = await this.db.get(
			`SELECT id, task_id, sequence_num, parent_checkpoint_id, patch_path, metadata, created_at 
             FROM checkpoints 
             WHERE id = ?`,
			checkpointId,
		)

		if (!row) {
			return null
		}

		return {
			id: row.id,
			taskId: row.task_id,
			sequenceNum: row.sequence_num,
			parentCheckpointId: row.parent_checkpoint_id,
			patchPath: row.patch_path,
			metadata: JSON.parse(row.metadata || "{}"),
			createdAt: new Date(row.created_at),
		}
	}

	/**
	 * Get all checkpoints for a task
	 */
	public async getCheckpoints(taskId: string): Promise<Checkpoint[]> {
		if (!this.db) {
			throw new Error("Database not initialized")
		}

		const rows = await this.db.all(
			`SELECT id, task_id, sequence_num, parent_checkpoint_id, patch_path, metadata, created_at 
             FROM checkpoints 
             WHERE task_id = ? 
             ORDER BY sequence_num ASC`,
			taskId,
		)

		return rows.map((row) => ({
			id: row.id,
			taskId: row.task_id,
			sequenceNum: row.sequence_num,
			parentCheckpointId: row.parent_checkpoint_id,
			patchPath: row.patch_path,
			metadata: JSON.parse(row.metadata || "{}"),
			createdAt: new Date(row.created_at),
		}))
	}

	/**
	 * Get the path from base to a checkpoint
	 * Returns an array of checkpoints in order from oldest to newest
	 */
	public async getCheckpointPath(checkpointId: string): Promise<Checkpoint[]> {
		if (!this.db) {
			throw new Error("Database not initialized")
		}

		const checkpoint = await this.getCheckpoint(checkpointId)
		if (!checkpoint) {
			throw new Error(`Checkpoint ${checkpointId} not found`)
		}

		const path: Checkpoint[] = [checkpoint]
		let currentId = checkpoint.parentCheckpointId

		// Traverse up the parent chain
		while (currentId) {
			const parent = await this.getCheckpoint(currentId)
			if (!parent) {
				break
			}

			path.unshift(parent)
			currentId = parent.parentCheckpointId
		}

		return path
	}

	/**
	 * Delete a task and all its checkpoints
	 */
	public async deleteTask(taskId: string): Promise<void> {
		if (!this.db) {
			throw new Error("Database not initialized")
		}

		await this.db.run("BEGIN TRANSACTION")

		try {
			// Delete all checkpoints for this task
			await this.db.run("DELETE FROM checkpoints WHERE task_id = ?", taskId)

			// Delete the task
			await this.db.run("DELETE FROM tasks WHERE id = ?", taskId)

			await this.db.run("COMMIT")
		} catch (error) {
			await this.db.run("ROLLBACK")
			throw error
		}
	}

	/**
	 * Vacuum the database to reclaim space
	 */
	public async vacuum(): Promise<void> {
		if (!this.db) {
			throw new Error("Database not initialized")
		}

		await this.db.exec("VACUUM")
	}
}
