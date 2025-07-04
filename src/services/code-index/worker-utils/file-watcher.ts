// Worker-compatible version of file-watcher without vscode dependencies
import * as chokidar from "chokidar"
import * as path from "path"
import ignore from "ignore"

export interface FileWatcherOptions {
	excludePatterns?: string[]
	includePatterns?: string[]
}

export interface FileChangeEvent {
	type: "created" | "changed" | "deleted"
	path: string
}

/**
 * Worker-compatible file watcher that monitors file system changes
 */
export class FileWatcher {
	private watcher: chokidar.FSWatcher | null = null
	private ignoreInstance: ReturnType<typeof ignore>
	private listeners: ((event: FileChangeEvent) => void)[] = []

	constructor(
		private workspacePath: string,
		private options: FileWatcherOptions = {},
	) {
		if (!workspacePath || workspacePath.trim() === "") {
			throw new Error("Workspace path cannot be empty")
		}
		// Initialize ignore instance with exclude patterns
		this.ignoreInstance = ignore()
		if (options.excludePatterns) {
			this.ignoreInstance.add(options.excludePatterns)
		}
	}

	/**
	 * Start watching for file changes
	 */
	start(): void {
		if (this.watcher) {
			return // Already watching
		}

		// Configure chokidar options
		const watchOptions = {
			cwd: this.workspacePath,
			ignored: (filePath: string) => {
				const relativePath = path.relative(this.workspacePath, filePath)
				return relativePath ? this.ignoreInstance.ignores(relativePath) : false
			},
			persistent: true,
			ignoreInitial: true,
			followSymlinks: false,
			usePolling: false,
			interval: 100,
			binaryInterval: 300,
			awaitWriteFinish: {
				stabilityThreshold: 200,
				pollInterval: 100,
			},
		}

		// Create watcher
		this.watcher = chokidar.watch(this.workspacePath, watchOptions)

		// Set up event handlers
		this.watcher
			.on("add", (filePath: string) => {
				this.emitEvent({ type: "created", path: path.join(this.workspacePath, filePath) })
			})
			.on("change", (filePath: string) => {
				this.emitEvent({ type: "changed", path: path.join(this.workspacePath, filePath) })
			})
			.on("unlink", (filePath: string) => {
				this.emitEvent({ type: "deleted", path: path.join(this.workspacePath, filePath) })
			})
			.on("error", (error: unknown) => {
				console.error("[FileWatcher] Error:", error)
			})
	}

	/**
	 * Stop watching for file changes
	 */
	async stop(): Promise<void> {
		if (this.watcher) {
			await this.watcher.close()
			this.watcher = null
		}
	}

	/**
	 * Add a listener for file change events
	 */
	onFileChange(listener: (event: FileChangeEvent) => void): void {
		this.listeners.push(listener)
	}

	/**
	 * Remove a listener
	 */
	removeListener(listener: (event: FileChangeEvent) => void): void {
		const index = this.listeners.indexOf(listener)
		if (index !== -1) {
			this.listeners.splice(index, 1)
		}
	}

	/**
	 * Check if a file should be watched based on patterns
	 */
	shouldWatchFile(filePath: string): boolean {
		const relativePath = path.relative(this.workspacePath, filePath)

		// Check if ignored
		if (relativePath && this.ignoreInstance.ignores(relativePath)) {
			return false
		}

		// If include patterns are specified, check if file matches any
		if (this.options.includePatterns && this.options.includePatterns.length > 0) {
			const ext = path.extname(filePath).toLowerCase()
			const fileName = path.basename(filePath)

			return this.options.includePatterns.some((pattern) => {
				// Handle simple extension patterns
				if (pattern.startsWith("**/*") && pattern.indexOf("*", 4) === -1) {
					const patternExt = pattern.substring(3)
					return filePath.endsWith(patternExt)
				}
				// Handle specific file name patterns
				if (pattern.startsWith("**/") && !pattern.includes("*", 3)) {
					const patternName = pattern.substring(3)
					return fileName === patternName
				}
				// For complex patterns, use simple matching
				return filePath.includes(pattern.replace(/\*\*/g, "").replace(/\*/g, ""))
			})
		}

		// If no include patterns, watch all non-ignored files
		return true
	}

	/**
	 * Emit an event to all listeners
	 */
	private emitEvent(event: FileChangeEvent): void {
		// Check if file should be watched before emitting
		if (this.shouldWatchFile(event.path)) {
			for (const listener of this.listeners) {
				try {
					listener(event)
				} catch (error) {
					console.error("[FileWatcher] Error in listener:", error)
				}
			}
		}
	}

	/**
	 * Get watcher status
	 */
	isWatching(): boolean {
		return this.watcher !== null
	}
}
