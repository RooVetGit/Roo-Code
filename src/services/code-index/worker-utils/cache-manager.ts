// Worker-compatible version of cache-manager without vscode dependencies
import { createHash } from "crypto"
import { ICacheManager } from "../interfaces/cache"
import debounce from "lodash.debounce"
import * as fs from "fs/promises"
import * as path from "path"

/**
 * Manages the cache for code indexing (worker-compatible version)
 */
export class CacheManager implements ICacheManager {
	private cachePath: string
	private fileHashes: Record<string, string> = {}
	private _debouncedSaveCache: () => void

	/**
	 * Creates a new cache manager
	 * @param context Mock context with globalStorageUri
	 * @param workspacePath Path to the workspace
	 */
	constructor(
		private context: { globalStorageUri: { fsPath: string } },
		private workspacePath: string,
	) {
		// Validate workspacePath is not empty
		if (!workspacePath || workspacePath.trim() === "") {
			throw new Error("Workspace path must not be empty")
		}

		const cacheFileName = `roo-index-cache-${createHash("sha256").update(workspacePath).digest("hex")}.json`
		this.cachePath = path.join(context.globalStorageUri.fsPath, cacheFileName)

		this._debouncedSaveCache = debounce(async () => {
			await this._performSave()
		}, 1500)
	}

	/**
	 * Initializes the cache manager by loading the cache file
	 */
	async initialize(): Promise<void> {
		try {
			const cacheData = await fs.readFile(this.cachePath, "utf8")
			this.fileHashes = JSON.parse(cacheData)
		} catch (error) {
			this.fileHashes = {}
		}
	}

	/**
	 * Saves the cache to disk
	 */
	private async _performSave(): Promise<void> {
		try {
			// Ensure directory exists
			const dir = path.dirname(this.cachePath)
			await fs.mkdir(dir, { recursive: true })

			// Write file atomically
			const tempPath = `${this.cachePath}.tmp`
			await fs.writeFile(tempPath, JSON.stringify(this.fileHashes, null, 2))
			await fs.rename(tempPath, this.cachePath)
		} catch (error) {
			console.error("Failed to save cache:", error)
		}
	}

	/**
	 * Clears the cache file by writing an empty object to it
	 */
	async clearCacheFile(): Promise<void> {
		try {
			// Ensure directory exists
			const dir = path.dirname(this.cachePath)
			await fs.mkdir(dir, { recursive: true })

			// Write empty cache
			await fs.writeFile(this.cachePath, JSON.stringify({}, null, 2))
			this.fileHashes = {}
		} catch (error) {
			console.error("Failed to clear cache file:", error, this.cachePath)
		}
	}

	/**
	 * Gets the hash for a file path
	 * @param filePath Path to the file
	 * @returns The hash for the file or undefined if not found
	 */
	getHash(filePath: string): string | undefined {
		return this.fileHashes[filePath]
	}

	/**
	 * Updates the hash for a file path
	 * @param filePath Path to the file
	 * @param hash New hash value
	 */
	updateHash(filePath: string, hash: string): void {
		this.fileHashes[filePath] = hash
		this._debouncedSaveCache()
	}

	/**
	 * Deletes the hash for a file path
	 * @param filePath Path to the file
	 */
	deleteHash(filePath: string): void {
		delete this.fileHashes[filePath]
		this._debouncedSaveCache()
	}

	/**
	 * Gets a copy of all file hashes
	 * @returns A copy of the file hashes record
	 */
	getAllHashes(): Record<string, string> {
		return { ...this.fileHashes }
	}
}
