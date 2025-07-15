import * as fs from "fs/promises"
import * as path from "path"
import type { FileBuffer, FileOperation, BufferResult, FlushResult } from "./types"

/**
 * Manages buffered file content during silent mode operations
 */
export class BufferManager {
	private buffers = new Map<string, FileBuffer>()
	private maxBufferSize = 50 * 1024 * 1024 // 50MB limit
	private maxBufferedFiles = 100 // Maximum number of files to buffer

	/**
	 * Creates or updates a file buffer
	 */
	public async bufferFileOperation(filePath: string, operation: FileOperation): Promise<BufferResult> {
		// Check memory limits
		if (this.buffers.size >= this.maxBufferedFiles) {
			return {
				success: false,
				error: `Buffer limit exceeded: maximum ${this.maxBufferedFiles} files`,
			}
		}

		try {
			const buffer = await this.getOrCreateBuffer(filePath)
			const result = await buffer.applyOperation(operation)

			// Check if we've exceeded memory limits after the operation
			this.enforceMemoryLimits()

			return result
		} catch (error) {
			this.releaseBuffer(filePath)
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error occurred",
			}
		}
	}

	/**
	 * Gets the current buffered content for a file
	 */
	public getBufferedContent(filePath: string): string | null {
		return this.buffers.get(filePath)?.content || null
	}

	/**
	 * Applies all buffered changes to the file system
	 */
	public async flushBuffers(filePaths: string[]): Promise<FlushResult> {
		const results: FlushResult = { success: [], failed: [] }

		for (const filePath of filePaths) {
			try {
				await this.flushBuffer(filePath)
				results.success.push(filePath)
			} catch (error) {
				results.failed.push({ filePath, error })
			}
		}

		return results
	}

	/**
	 * Releases buffers and cleans up memory
	 */
	public cleanup(taskId?: string): void {
		if (taskId) {
			// Release buffers for specific task
			this.releaseTaskBuffers(taskId)
		} else {
			// Full cleanup
			this.buffers.clear()
		}
	}

	/**
	 * Gets or creates a buffer for a file
	 */
	private async getOrCreateBuffer(filePath: string): Promise<FileBuffer> {
		let buffer = this.buffers.get(filePath)
		if (!buffer) {
			buffer = new FileBufferImpl(filePath)
			this.buffers.set(filePath, buffer)
		}
		return buffer
	}

	/**
	 * Flushes a single buffer to the file system
	 */
	private async flushBuffer(filePath: string): Promise<void> {
		const buffer = this.buffers.get(filePath)
		if (!buffer) {
			throw new Error(`No buffer found for file: ${filePath}`)
		}

		await buffer.flush()
		this.buffers.delete(filePath)
	}

	/**
	 * Releases a specific buffer
	 */
	private releaseBuffer(filePath: string): void {
		this.buffers.delete(filePath)
	}

	/**
	 * Releases buffers for a specific task
	 */
	private releaseTaskBuffers(taskId: string): void {
		// For now, we don't track buffers by task ID
		// This could be enhanced in the future if needed
		const buffersToRemove: string[] = []

		for (const [filePath, buffer] of this.buffers.entries()) {
			if (buffer.taskId === taskId) {
				buffersToRemove.push(filePath)
			}
		}

		buffersToRemove.forEach((filePath) => this.buffers.delete(filePath))
	}

	/**
	 * Enforces memory limits by removing oldest buffers if necessary
	 */
	private enforceMemoryLimits(): void {
		const totalSize = Array.from(this.buffers.values()).reduce((total, buffer) => total + buffer.size(), 0)

		if (totalSize > this.maxBufferSize) {
			// Remove oldest buffers until we're under the limit
			// This is a simple implementation - could be enhanced with LRU
			const bufferEntries = Array.from(this.buffers.entries())
			const numToRemove = Math.ceil(bufferEntries.length * 0.2) // Remove 20%

			for (let i = 0; i < numToRemove && this.buffers.size > 0; i++) {
				const [filePath] = bufferEntries[i]
				this.buffers.delete(filePath)
			}
		}
	}
}

/**
 * Implementation of FileBuffer
 */
class FileBufferImpl implements FileBuffer {
	public content: string = ""
	public operations: FileOperation[] = []
	public taskId: string = ""

	constructor(public filePath: string) {}

	public async applyOperation(operation: FileOperation): Promise<BufferResult> {
		try {
			this.operations.push(operation)

			switch (operation.type) {
				case "create":
					this.content = operation.content || ""
					break
				case "modify":
					this.content = operation.content || ""
					break
				case "delete":
					this.content = ""
					break
				default:
					throw new Error(`Unknown operation type: ${operation.type}`)
			}

			return { success: true }
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			}
		}
	}

	public async flush(): Promise<void> {
		// Ensure directory exists
		const dir = path.dirname(this.filePath)
		await fs.mkdir(dir, { recursive: true })

		// Apply the final operation
		const lastOperation = this.operations[this.operations.length - 1]

		if (lastOperation?.type === "delete") {
			try {
				await fs.unlink(this.filePath)
			} catch (error) {
				// File might not exist, which is OK for delete operations
				if ((error as any)?.code !== "ENOENT") {
					throw error
				}
			}
		} else {
			await fs.writeFile(this.filePath, this.content, "utf8")
		}
	}

	public size(): number {
		return Buffer.byteLength(this.content, "utf8")
	}
}
