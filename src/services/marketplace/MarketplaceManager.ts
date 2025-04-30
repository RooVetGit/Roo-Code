import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { GitFetcher } from "./GitFetcher"
import {
	MarketplaceItem,
	MarketplaceRepository,
	MarketplaceSource,
	ComponentType,
	ComponentMetadata,
	LocalizationOptions,
	InstallMarketplaceItemOptions,
} from "./types"
import { getUserLocale } from "./utils"
import { GlobalFileNames } from "src/shared/globalFileNames"
import { TerminalRegistry } from "src/integrations/terminal/TerminalRegistry"
import { assertsMpContext, createHookable, MarketplaceContext, registerMarketplaceHooks } from "roo-rocket"
import { assertsBinarySha256, unpackFromUint8 } from "config-rocket/cli"
import { uint8IsConfigPackWithParameters } from "config-rocket/cli"

/**
 * Service for managing marketplace data
 */
export class MarketplaceManager {
	private currentItems: MarketplaceItem[] = []
	private static readonly CACHE_EXPIRY_MS = 3600000 // 1 hour

	private gitFetcher: GitFetcher
	private cache: Map<string, { data: MarketplaceRepository; timestamp: number }> = new Map()
	public isFetching = false

	// Concurrency control
	private activeSourceOperations = new Set<string>() // Track active git operations per source
	private isMetadataScanActive = false // Track active metadata scanning
	private pendingOperations: Array<() => Promise<void>> = [] // Queue for pending operations

	constructor(private readonly context: vscode.ExtensionContext) {
		const localizationOptions: LocalizationOptions = {
			userLocale: getUserLocale(),
			fallbackLocale: "en",
		}
		this.gitFetcher = new GitFetcher(context, localizationOptions)
	}

	/**
	 * Queue an operation to run when no metadata scan is active
	 */
	private async queueOperation(operation: () => Promise<void>): Promise<void> {
		if (this.isMetadataScanActive) {
			return new Promise((resolve) => {
				this.pendingOperations.push(async () => {
					await operation()
					resolve()
				})
			})
		}

		try {
			this.isMetadataScanActive = true
			await operation()
		} finally {
			this.isMetadataScanActive = false

			// Process any pending operations
			const nextOperation = this.pendingOperations.shift()
			if (nextOperation) {
				void this.queueOperation(nextOperation)
			}
		}
	}

	async getMarketplaceItems(sources: MarketplaceSource[]): Promise<{ items: MarketplaceItem[]; errors?: string[] }> {
		const items: MarketplaceItem[] = []
		const errors: string[] = []

		// Filter enabled sources
		const enabledSources = sources.filter((s) => s.enabled)

		// Process sources sequentially with locking
		for (const source of enabledSources) {
			if (this.isSourceLocked(source.url)) {
				continue
			}

			try {
				this.lockSource(source.url)

				// Queue metadata scanning operation
				await this.queueOperation(async () => {
					const repo = await this.getRepositoryData(source.url, false, source.name)

					if (repo.items && repo.items.length > 0) {
						// Ensure each item is properly attributed to its source
						const itemsWithSource = repo.items.map((item) => ({
							...item,
							sourceName: source.name || this.getRepoNameFromUrl(source.url),
							sourceUrl: source.url,
						}))
						items.push(...itemsWithSource)
					}
				})
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				console.error(`MarketplaceManager: Failed to fetch data from ${source.url}:`, error)
				errors.push(`Source ${source.url}: ${errorMessage}`)
			} finally {
				this.unlockSource(source.url)
			}
		}

		// Store the current items
		this.currentItems = items

		// Return both items and errors
		const result = {
			items,
			...(errors.length > 0 && { errors }),
		}

		return result
	}

	/**
	 * Check if a source operation is in progress
	 */
	private isSourceLocked(url: string): boolean {
		return this.activeSourceOperations.has(url)
	}

	/**
	 * Lock a source for operations
	 */
	private lockSource(url: string): void {
		this.activeSourceOperations.add(url)
	}

	/**
	 * Unlock a source after operations complete
	 */
	private unlockSource(url: string): void {
		this.activeSourceOperations.delete(url)
	}

	async getRepositoryData(
		url: string,
		forceRefresh: boolean = false,
		sourceName?: string,
	): Promise<MarketplaceRepository> {
		try {
			// Check cache first (unless force refresh is requested)
			const cached = this.cache.get(url)

			if (!forceRefresh && cached && Date.now() - cached.timestamp < MarketplaceManager.CACHE_EXPIRY_MS) {
				return cached.data
			}

			// Fetch fresh data with timeout protection
			const fetchPromise = this.gitFetcher.fetchRepository(url, forceRefresh, sourceName)

			// Create a timeout promise
			let timeoutId: NodeJS.Timeout | undefined
			const timeoutPromise = new Promise<MarketplaceRepository>((_, reject) => {
				timeoutId = setTimeout(() => {
					reject(new Error(`Repository fetch timed out after 30 seconds: ${url}`))
				}, 30000) // 30 second timeout
			})

			try {
				// Race the fetch against the timeout
				const result = await Promise.race([fetchPromise, timeoutPromise])

				// Cache the result
				this.cache.set(url, { data: result, timestamp: Date.now() })

				return result
			} finally {
				if (timeoutId) {
					clearTimeout(timeoutId)
				}
			}
		} catch (error) {
			console.error(`MarketplaceManager: Error fetching repository data for ${url}:`, error)

			// Return empty repository data instead of throwing
			return {
				metadata: {
					name: "Unknown Repository",
					description: "Failed to load repository",
					version: "0.0.0",
				},
				items: [],
				url,
			}
		}
	}

	/**
	 * Refreshes a specific repository, bypassing the cache
	 * @param url The repository URL to refresh
	 * @param sourceName Optional name of the source
	 * @returns The refreshed repository data
	 */
	async refreshRepository(url: string, sourceName?: string): Promise<MarketplaceRepository> {
		try {
			// Force a refresh by bypassing the cache
			const data = await this.getRepositoryData(url, true, sourceName)
			return data
		} catch (error) {
			console.error(`MarketplaceManager: Failed to refresh repository ${url}:`, error)
			return {
				metadata: {
					name: "Unknown Repository",
					description: "Failed to load repository",
					version: "0.0.0",
				},
				items: [],
				url,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}

	/**
	 * Clears the in-memory cache
	 */
	clearCache(): void {
		this.cache.clear()
	}

	/**
	 * Cleans up cache directories for repositories that are no longer in the configured sources
	 * @param currentSources The current list of marketplace sources
	 */
	async cleanupCacheDirectories(currentSources: MarketplaceSource[]): Promise<void> {
		try {
			// Get the cache directory path
			const cacheDir = path.join(this.context.globalStorageUri.fsPath, "marketplace-cache")

			// Check if cache directory exists
			try {
				await fs.stat(cacheDir)
			} catch (error) {
				return
			}

			// Get all subdirectories in the cache directory
			const entries = await fs.readdir(cacheDir, { withFileTypes: true })
			const cachedRepoDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)

			// Get the list of repository names from current sources
			const currentRepoNames = currentSources.map((source) => this.getRepoNameFromUrl(source.url))

			// Find directories to delete
			const dirsToDelete = cachedRepoDirs.filter((dir) => !currentRepoNames.includes(dir))

			// Delete each directory that's no longer in the sources
			for (const dirName of dirsToDelete) {
				try {
					const dirPath = path.join(cacheDir, dirName)
					await fs.rm(dirPath, { recursive: true, force: true })
				} catch (error) {
					console.error(`MarketplaceManager: Failed to delete directory ${dirName}:`, error)
				}
			}
		} catch (error) {
			console.error("MarketplaceManager: Error cleaning up cache directories:", error)
		}
	}

	/**
	 * Extracts a safe directory name from a Git URL
	 * @param url The Git repository URL
	 * @returns A sanitized directory name
	 */
	private getRepoNameFromUrl(url: string): string {
		// Extract repo name from URL and sanitize it
		const urlParts = url.split("/").filter((part) => part !== "")
		const repoName = urlParts[urlParts.length - 1].replace(/\.git$/, "")
		return repoName.replace(/[^a-zA-Z0-9-_]/g, "-")
	}

	/**
	 * Filters marketplace items based on criteria
	 * @param items The items to filter
	 * @param filters The filter criteria
	 * @returns Filtered items
	 */
	private static readonly MAX_CACHE_SIZE = 100
	private static readonly BATCH_SIZE = 100

	private filterCache = new Map<
		string,
		{
			items: MarketplaceItem[]
			timestamp: number
		}
	>()

	/**
	 * Clear old entries from the filter cache
	 */
	private cleanupFilterCache(): void {
		if (this.filterCache.size > MarketplaceManager.MAX_CACHE_SIZE) {
			// Sort by timestamp and keep only the most recent entries
			const entries = Array.from(this.filterCache.entries())
				.sort(([, a], [, b]) => b.timestamp - a.timestamp)
				.slice(0, MarketplaceManager.MAX_CACHE_SIZE)

			this.filterCache.clear()
			entries.forEach(([key, value]) => this.filterCache.set(key, value))
		}
	}

	/**
	 * Filter items
	 */
	filterItems(
		items: MarketplaceItem[],
		filters: { type?: ComponentType; search?: string; tags?: string[] },
	): MarketplaceItem[] {
		// Create cache key from filters
		const cacheKey = JSON.stringify(filters)
		const cached = this.filterCache.get(cacheKey)
		if (cached) {
			return cached.items
		}

		// Clean up old cache entries
		this.cleanupFilterCache()

		// Process items in batches to avoid memory spikes
		const allFilteredItems: MarketplaceItem[] = []
		for (let i = 0; i < items.length; i += MarketplaceManager.BATCH_SIZE) {
			const batch = items.slice(i, Math.min(i + MarketplaceManager.BATCH_SIZE, items.length))
			const filteredBatch = this.processItemBatch(batch, filters)
			allFilteredItems.push(...filteredBatch)
		}

		// Cache the results
		this.filterCache.set(cacheKey, {
			items: allFilteredItems,
			timestamp: Date.now(),
		})

		return allFilteredItems
	}

	/**
	 * Process a batch of items
	 */
	private processItemBatch(
		batch: MarketplaceItem[],
		filters: { type?: ComponentType; search?: string; tags?: string[] },
	): MarketplaceItem[] {
		// Helper functions
		const normalizeText = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim()
		const searchTerm = filters.search ? normalizeText(filters.search) : ""
		const containsSearchTerm = (text: string) => !searchTerm || normalizeText(text).includes(searchTerm)

		return batch
			.map((item) => {
				const itemCopy = { ...item }

				// Check parent item matches
				const itemMatches = {
					type: !filters.type || itemCopy.type === filters.type,
					search:
						!searchTerm || containsSearchTerm(itemCopy.name) || containsSearchTerm(itemCopy.description),
					tags:
						!filters.tags?.length ||
						(itemCopy.tags && filters.tags.some((tag) => itemCopy.tags!.includes(tag))),
				}

				// Process subcomponents
				let hasMatchingSubcomponents = false
				if (itemCopy.items?.length) {
					itemCopy.items = itemCopy.items.map((subItem) => {
						const subMatches = {
							type: !filters.type || subItem.type === filters.type,
							search:
								!searchTerm ||
								(subItem.metadata &&
									(containsSearchTerm(subItem.metadata.name || "") ||
										containsSearchTerm(subItem.metadata.description || "") ||
										containsSearchTerm(subItem.type || ""))),
							tags:
								!filters.tags?.length ||
								(subItem.metadata?.tags &&
									filters.tags.some((tag) => subItem.metadata!.tags!.includes(tag))),
						}

						const subItemMatched =
							subMatches.type &&
							(!searchTerm || subMatches.search) &&
							(!filters.tags?.length || subMatches.tags)

						if (subItemMatched) {
							hasMatchingSubcomponents = true
							const matchReason: Record<string, boolean> = {
								nameMatch: searchTerm ? containsSearchTerm(subItem.metadata?.name || "") : true,
								descriptionMatch: searchTerm
									? containsSearchTerm(subItem.metadata?.description || "")
									: false,
							}

							if (filters.type) {
								matchReason.typeMatch = subMatches.type
							}

							subItem.matchInfo = {
								matched: true,
								matchReason,
							}
						} else {
							subItem.matchInfo = { matched: false }
						}

						return subItem
					})
				}

				const hasActiveFilters = filters.type || searchTerm || filters.tags?.length
				if (!hasActiveFilters) return itemCopy

				const parentMatchesAll = itemMatches.type && itemMatches.search && itemMatches.tags
				const isPackageWithMatchingSubcomponent = itemCopy.type === "package" && hasMatchingSubcomponents

				if (parentMatchesAll || isPackageWithMatchingSubcomponent) {
					const matchReason: Record<string, boolean> = {
						nameMatch: searchTerm ? containsSearchTerm(itemCopy.name) : false,
						descriptionMatch: searchTerm ? containsSearchTerm(itemCopy.description) : false,
					}

					if (filters.type) {
						matchReason.typeMatch = itemMatches.type
					}

					if (hasMatchingSubcomponents) {
						matchReason.hasMatchingSubcomponents = true
					}

					// If this is a package and we're searching, also check if any subcomponent names match
					if (searchTerm && itemCopy.type === "package" && itemCopy.items?.length) {
						const subcomponentNameMatches = itemCopy.items.some(
							(subItem) => subItem.metadata && containsSearchTerm(subItem.metadata.name || ""),
						)
						if (subcomponentNameMatches) {
							matchReason.hasMatchingSubcomponents = true
						}
					}

					itemCopy.matchInfo = {
						matched: true,
						matchReason,
					}
					return itemCopy
				}

				return null
			})
			.filter((item): item is MarketplaceItem => item !== null)
	}

	/**
	 * Sorts marketplace items
	 * @param items The items to sort
	 * @param sortBy The field to sort by
	 * @param sortOrder The sort order
	 * @returns Sorted items
	 */
	sortItems(
		items: MarketplaceItem[],
		sortBy: keyof Pick<MarketplaceItem, "name" | "author" | "lastUpdated">,
		sortOrder: "asc" | "desc",
		sortSubcomponents: boolean = false,
	): MarketplaceItem[] {
		return [...items]
			.map((item) => {
				// Deep clone the item
				const clonedItem = { ...item }

				// Sort or preserve subcomponents
				if (clonedItem.items && clonedItem.items.length > 0) {
					clonedItem.items = [...clonedItem.items]
					if (sortSubcomponents) {
						clonedItem.items.sort((a, b) => {
							const aValue = this.getSortValue(a, sortBy)
							const bValue = this.getSortValue(b, sortBy)
							const comparison = aValue.localeCompare(bValue)
							return sortOrder === "asc" ? comparison : -comparison
						})
					}
				}

				return clonedItem
			})
			.sort((a, b) => {
				const aValue = this.getSortValue(a, sortBy)
				const bValue = this.getSortValue(b, sortBy)
				const comparison = aValue.localeCompare(bValue)
				return sortOrder === "asc" ? comparison : -comparison
			})
	}

	/**
	 * Gets the current marketplace items
	 * @returns The current items
	 */
	getCurrentItems(): MarketplaceItem[] {
		return this.currentItems
	}

	/**
	 * Updates current items with filtered results
	 * @param filters The filter criteria
	 * @returns Filtered items
	 */
	updateWithFilteredItems(filters: { type?: ComponentType; search?: string; tags?: string[] }): MarketplaceItem[] {
		const filteredItems = this.filterItems(this.currentItems, filters)
		this.currentItems = filteredItems
		return filteredItems
	}

	/**
	 * Cleans up resources used by the marketplace
	 */
	async cleanup(): Promise<void> {
		// Clean up cache directories for all sources
		const sources = Array.from(this.cache.keys()).map((url) => ({ url, enabled: true }))
		await this.cleanupCacheDirectories(sources)
		this.clearCache()
		// Clear filter cache
		this.filterCache.clear()
	}

	/**
	 * Helper method to get the sort value for an item
	 */
	private getSortValue(
		item:
			| MarketplaceItem
			| { type: ComponentType; path: string; metadata?: ComponentMetadata; lastUpdated?: string },
		sortBy: keyof Pick<MarketplaceItem, "name" | "author" | "lastUpdated">,
	): string {
		if ("metadata" in item && item.metadata) {
			// Handle subcomponent
			switch (sortBy) {
				case "name":
					return item.metadata.name
				case "author":
					return ""
				case "lastUpdated":
					return item.lastUpdated || ""
				default:
					return item.metadata.name
			}
		} else {
			// Handle parent item
			const parentItem = item as MarketplaceItem
			switch (sortBy) {
				case "name":
					return parentItem.name
				case "author":
					return parentItem.author || ""
				case "lastUpdated":
					return parentItem.lastUpdated || ""
				default:
					return parentItem.name
			}
		}
	}

	async installMarketplaceItem(item: MarketplaceItem, options?: InstallMarketplaceItemOptions) {
		const { target = "project" } = options || {}

		vscode.window.showInformationMessage(`Installing item: "${item.name}"`)

		if (target === "project" && !vscode.workspace.workspaceFolders?.length)
			return vscode.window.showErrorMessage("Cannot load current workspace folder")

		const cwd =
			target === "project"
				? vscode.workspace.workspaceFolders![0].uri.fsPath
				: await this.ensureSettingsDirectoryExists()

		if (!item.binaryUrl || !item.binaryHash)
			return vscode.window.showErrorMessage("Item does not have a binary URL or hash")

		// Creates `mpContext` to delegate context to `roo-rocket`
		const mpContext = (
			target === "project"
				? { target }
				: {
						target,
						globalFileNames: {
							mcp: GlobalFileNames.mcpSettings,
							mode: GlobalFileNames.customModes,
						},
					}
		) satisfies MarketplaceContext
		assertsMpContext(mpContext)

		const binaryUint8 = await fetchBinary(item.binaryUrl)
		await assertsBinarySha256(binaryUint8, item.binaryHash)

		// Install via CLI if binary is a configurable pack.
		// TODO: think of a way to send the binary to the npx process
		if (await uint8IsConfigPackWithParameters(binaryUint8)) {
			vscode.window.showInformationMessage(`"${item.name}" is configurable, invoking interactive CLI...`)

			let pResult: string[] = []
			let pExitCode: number | undefined
			// We don't want to create a new terminal at the global dir, so I'm not using cwd here
			const terminalClass = await TerminalRegistry.getOrCreateTerminal(
				vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath ?? "",
				false,
				`IMI-${item.name}`,
			)
			terminalClass.terminal.show()
			await terminalClass.runCommand(
				`npx --yes roo-rocket@latest --mp="${JSON.stringify(mpContext).replaceAll(/"/g, '\\"')}" --cwd="${cwd}" --url="${item.binaryUrl}"`,
				{
					onLine: (line) => {
						pResult.push(line)
					},
					onShellExecutionComplete: (details) => {
						pExitCode = details.exitCode
					},
				},
			)

			if (pExitCode === 0) vscode.window.showInformationMessage(`"${item.name}" CLI reported success!`)
			else {
				console.error(pResult)
				// Revert so error search is potentially faster
				pResult.reverse()
				// Search for error line in the result
				const errorLine =
					pResult.find((line) => /^((\r)?\n)+ ERROR  /.test(line)) ?? // Prefer formatting error
					pResult.find((line) => /error/i.test(line)) ?? // General error
					"N/A"
				return vscode.window.showErrorMessage(`"${item.name}" CLI reported error: (${pExitCode}): ${errorLine}`)
			}
		}
		// Fast install for non-configurable packs.
		else {
			// Create a custom hookable instance to support global installations
			const customHookable = createHookable()
			registerMarketplaceHooks(customHookable, mpContext)

			vscode.window.showInformationMessage(`"${item.name}" is non-configurable, fast install...`)
			await unpackFromUint8(binaryUint8, {
				hookable: customHookable,
				nonAssemblyBehavior: true,
				cwd,
			})
			vscode.window.showInformationMessage(`"${item.name}" installed successfully`)
		}

		return true
	}

	/**
	 * Copied from `src/core/config/CustomModesManager.ts`, if in the future we add ClineProvider ref to this class, we can remove this and use the one from there.
	 */
	private async ensureSettingsDirectoryExists(): Promise<string> {
		const settingsDir = path.join(this.context.globalStorageUri.fsPath, "settings")
		await fs.mkdir(settingsDir, { recursive: true })
		return settingsDir
	}
}

async function fetchBinary(url: string) {
	const res = await fetch(url)
	if (!res.ok) throw new Error(`Failed to download binary from ${url}`)

	return new Uint8Array(await res.arrayBuffer())
}
