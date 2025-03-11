import * as vscode from "vscode"
import { logger } from "../utils/logging"
import { GLOBAL_STATE_KEYS, SECRET_KEYS } from "../shared/globalState"

// Keys that should be stored per-window rather than globally
export const WINDOW_SPECIFIC_KEYS = ["mode"] as const
export type WindowSpecificKey = (typeof WINDOW_SPECIFIC_KEYS)[number]

export class ContextProxy {
	private readonly originalContext: vscode.ExtensionContext
	private stateCache: Map<string, any>
	private secretCache: Map<string, string | undefined>
	private windowId: string
	private readonly instanceCreationTime: Date = new Date()

	constructor(context: vscode.ExtensionContext) {
		// Initialize properties first
		this.originalContext = context
		this.stateCache = new Map()
		this.secretCache = new Map()

		// Generate a unique ID for this window instance
		this.windowId = this.ensureUniqueWindowId()
		logger.debug(`ContextProxy created with windowId: ${this.windowId}`)

		// Initialize state cache with all defined global state keys
		this.initializeStateCache()

		// Initialize secret cache with all defined secret keys
		this.initializeSecretCache()

		logger.debug("ContextProxy created")
	}

	/**
	 * Ensures we have a unique window ID, with fallback mechanisms if primary generation fails
	 * @returns A string ID unique to this VS Code window
	 */
	private ensureUniqueWindowId(): string {
		// Try to get a stable ID first
		let id = this.generateWindowId()

		// If all else fails, use a purely random ID as ultimate fallback
		// This will not be stable across restarts but ensures uniqueness
		if (!id) {
			id = `random_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
			logger.warn("Failed to generate stable window ID, using random ID instead")
		}

		return id
	}

	/**
	 * Generates a unique identifier for the current VS Code window
	 * This is used to namespace certain global state values to prevent
	 * conflicts when using multiple VS Code windows.
	 *
	 * The ID generation uses multiple sources to ensure uniqueness even in
	 * environments where workspace folders might be identical (like DevContainers).
	 *
	 * @returns A string ID unique to this VS Code window
	 */
	private generateWindowId(): string {
		try {
			// Get all available identifying information
			const folders = vscode.workspace.workspaceFolders || []
			const workspaceName = vscode.workspace.name || "unknown"
			const folderPaths = folders.map((folder) => folder.uri.toString()).join("|")

			// Generate a stable, pseudorandom ID based on the workspace information
			// This will be consistent for the same workspace but different across workspaces
			const baseId = `${workspaceName}|${folderPaths}`

			// Add machine-specific information (will differ between host and containers)
			// env.machineId is stable across VS Code sessions on the same machine
			const machineSpecificId = vscode.env.machineId || ""

			// Add a session component that distinguishes multiple windows with the same workspace
			// Creates a stable but reasonably unique hash
			const sessionHash = this.createSessionHash(baseId)

			// Combine all components
			return `${baseId}|${machineSpecificId}|${sessionHash}`
		} catch (error) {
			logger.error("Error generating window ID:", error)
			return "" // Empty string triggers the fallback in ensureUniqueWindowId
		}
	}

	/**
	 * Creates a stable hash from input string and window-specific properties
	 * that will be different for different VS Code windows even with identical projects
	 */
	private createSessionHash(input: string): string {
		try {
			// Use a combination of:
			// 1. The extension instance creation time
			const timestamp = this.instanceCreationTime.getTime()

			// 2. VS Code window-specific info we can derive
			// Using vscode.env.sessionId which changes on each VS Code window startup
			const sessionInfo = vscode.env.sessionId || ""

			// 3. Calculate a simple hash
			const hashStr = `${input}|${sessionInfo}|${timestamp}`
			let hash = 0
			for (let i = 0; i < hashStr.length; i++) {
				const char = hashStr.charCodeAt(i)
				hash = (hash << 5) - hash + char
				hash = hash & hash // Convert to 32bit integer
			}

			// Return a hexadecimal representation
			return Math.abs(hash).toString(16).substring(0, 8)
		} catch (error) {
			logger.error("Error creating session hash:", error)
			return Math.random().toString(36).substring(2, 10) // Random fallback
		}
	}

	/**
	 * Checks if a key should be stored per-window
	 * @param key The key to check
	 * @returns True if the key should be stored per-window, false otherwise
	 */
	private isWindowSpecificKey(key: string): boolean {
		return WINDOW_SPECIFIC_KEYS.includes(key as WindowSpecificKey)
	}

	/**
	 * Converts a regular key to a window-specific key
	 * @param key The original key
	 * @returns The window-specific key with window ID prefix
	 */
	private getWindowSpecificKey(key: string): string {
		return `window:${this.windowId}:${key}`
	}

	// Helper method to initialize state cache
	private initializeStateCache(): void {
		for (const key of GLOBAL_STATE_KEYS) {
			try {
				if (this.isWindowSpecificKey(key)) {
					// For window-specific keys, get the value using the window-specific key
					const windowKey = this.getWindowSpecificKey(key)
					const value = this.originalContext.globalState.get(windowKey)
					this.stateCache.set(key, value)
					logger.debug(`Loaded window-specific key ${key} as ${windowKey} with value: ${value}`)
				} else {
					// For global keys, use the regular key
					const value = this.originalContext.globalState.get(key)
					this.stateCache.set(key, value)
				}
			} catch (error) {
				logger.error(`Error loading global ${key}: ${error instanceof Error ? error.message : String(error)}`)
			}
		}
	}

	// Helper method to initialize secret cache
	private initializeSecretCache(): void {
		for (const key of SECRET_KEYS) {
			// Get actual value and update cache when promise resolves
			;(this.originalContext.secrets.get(key) as Promise<string | undefined>)
				.then((value) => {
					this.secretCache.set(key, value)
				})
				.catch((error: Error) => {
					logger.error(`Error loading secret ${key}: ${error.message}`)
				})
		}
	}

	get extensionUri(): vscode.Uri {
		return this.originalContext.extensionUri
	}
	get extensionPath(): string {
		return this.originalContext.extensionPath
	}
	get globalStorageUri(): vscode.Uri {
		return this.originalContext.globalStorageUri
	}
	get logUri(): vscode.Uri {
		return this.originalContext.logUri
	}
	get extension(): vscode.Extension<any> | undefined {
		return this.originalContext.extension
	}
	get extensionMode(): vscode.ExtensionMode {
		return this.originalContext.extensionMode
	}

	getGlobalState<T>(key: string): T | undefined
	getGlobalState<T>(key: string, defaultValue: T): T
	getGlobalState<T>(key: string, defaultValue?: T): T | undefined {
		// The cache already contains the correct value regardless of whether
		// this is a window-specific key (handled during initialization and updates)
		const value = this.stateCache.get(key) as T | undefined
		return value !== undefined ? value : (defaultValue as T | undefined)
	}

	async updateGlobalState<T>(key: string, value: T): Promise<void> {
		try {
			// Determine the storage key
			const storageKey = this.isWindowSpecificKey(key) ? this.getWindowSpecificKey(key) : key

			if (this.isWindowSpecificKey(key)) {
				logger.debug(
					`Updating window-specific key ${key} as ${storageKey} with value: ${JSON.stringify(value)}`,
				)
			}

			// Update in VSCode storage first
			await this.originalContext.globalState.update(storageKey, value)

			// Only update cache if storage update succeeded
			this.stateCache.set(key, value)
		} catch (error) {
			logger.error(
				`Failed to update global state for key ${key}: ${error instanceof Error ? error.message : String(error)}`,
			)
			throw error // Re-throw to allow callers to handle the error
		}
	}

	getSecret(key: string): string | undefined {
		return this.secretCache.get(key)
	}

	storeSecret(key: string, value?: string): Thenable<void> {
		// Update cache
		this.secretCache.set(key, value)
		// Write directly to context
		if (value === undefined) {
			return this.originalContext.secrets.delete(key)
		} else {
			return this.originalContext.secrets.store(key, value)
		}
	}
	/**
	 * Set a value in either secrets or global state based on key type.
	 * If the key is in SECRET_KEYS, it will be stored as a secret.
	 * If the key is in GLOBAL_STATE_KEYS or unknown, it will be stored in global state.
	 * @param key The key to set
	 * @param value The value to set
	 * @returns A promise that resolves when the operation completes
	 */
	setValue(key: string, value: any): Thenable<void> {
		if (SECRET_KEYS.includes(key as any)) {
			return this.storeSecret(key, value)
		}

		if (GLOBAL_STATE_KEYS.includes(key as any)) {
			return this.updateGlobalState(key, value)
		}

		logger.warn(`Unknown key: ${key}. Storing as global state.`)
		return this.updateGlobalState(key, value)
	}

	/**
	 * Set multiple values at once. Each key will be routed to either
	 * secrets or global state based on its type.
	 * @param values An object containing key-value pairs to set
	 * @returns A promise that resolves when all operations complete
	 */
	async setValues(values: Record<string, any>): Promise<void[]> {
		const promises: Thenable<void>[] = []

		for (const [key, value] of Object.entries(values)) {
			promises.push(this.setValue(key, value))
		}

		return Promise.all(promises)
	}

	/**
	 * Resets all global state, secrets, and in-memory caches.
	 * This clears all data from both the in-memory caches and the VSCode storage.
	 * @returns A promise that resolves when all reset operations are complete
	 */
	async resetAllState(): Promise<void> {
		// Clear in-memory caches
		this.stateCache.clear()
		this.secretCache.clear()

		// Create an array for all reset promises
		const resetPromises: Thenable<void>[] = []

		// Reset all global state values to undefined
		for (const key of GLOBAL_STATE_KEYS) {
			if (this.isWindowSpecificKey(key)) {
				// For window-specific keys, reset using the window-specific key
				const windowKey = this.getWindowSpecificKey(key)
				resetPromises.push(this.originalContext.globalState.update(windowKey, undefined))
			} else {
				resetPromises.push(this.originalContext.globalState.update(key, undefined))
			}
		}

		// Delete all secrets
		for (const key of SECRET_KEYS) {
			resetPromises.push(this.originalContext.secrets.delete(key))
		}

		// Wait for all reset operations to complete
		await Promise.all(resetPromises)

		this.initializeStateCache()
		this.initializeSecretCache()
	}
}
