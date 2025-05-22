import * as path from "path"
import * as fs from "fs/promises"
import * as vscode from "vscode"
import * as yaml from "yaml"
import { SimpleGit } from "simple-git"
import { validateAnyMetadata } from "./schemas"
import {
	ComponentMetadata,
	MarketplaceItemType,
	LocalizationOptions,
	LocalizedMetadata,
	MarketplaceItem,
	PackageMetadata,
} from "./types"
import { getUserLocale } from "./utils"

/**
 * Handles component discovery and metadata loading
 */
export class MetadataScanner {
	private git?: SimpleGit
	private localizationOptions: LocalizationOptions
	private originalRootDir: string | null = null
	private static readonly MAX_DEPTH = 5 // Maximum directory depth
	private static readonly BATCH_SIZE = 50 // Number of items to process at once
	private static readonly CONCURRENT_SCANS = 3 // Number of concurrent directory scans
	private isDisposed = false

	constructor(git?: SimpleGit, localizationOptions?: LocalizationOptions) {
		this.git = git
		this.localizationOptions = localizationOptions || {
			userLocale: getUserLocale(),
			fallbackLocale: "en",
		}
	}

	/**
	 * Clean up resources
	 */
	dispose(): void {
		if (this.isDisposed) {
			return
		}

		// Clean up git instance reference
		this.git = undefined

		// Clear any other references
		this.originalRootDir = null
		this.localizationOptions = null as any

		this.isDisposed = true
	}

	/**
	 * Generator function to yield items in batches
	 */
	private async *scanDirectoryBatched(
		rootDir: string,
		repoUrl: string,
		sourceName?: string,
		depth: number = 0,
	): AsyncGenerator<MarketplaceItem[]> {
		if (depth > MetadataScanner.MAX_DEPTH) {
			return
		}

		const batch: MarketplaceItem[] = []
		const entries = await fs.readdir(rootDir, { withFileTypes: true })

		for (const entry of entries) {
			if (!entry.isDirectory()) continue

			const componentDir = path.join(rootDir, entry.name)
			const metadata = await this.loadComponentMetadata(componentDir)
			const localizedMetadata = metadata ? this.getLocalizedMetadata(metadata) : null

			if (localizedMetadata) {
				const item = await this.createMarketplaceItem(
					localizedMetadata,
					componentDir,
					repoUrl,
					this.originalRootDir || rootDir,
					sourceName,
				)

				if (item) {
					// If this is a package, scan for subcomponents
					if (this.isPackageMetadata(localizedMetadata)) {
						await this.scanPackageSubcomponents(componentDir, item)
					}

					batch.push(item)
					if (batch.length >= MetadataScanner.BATCH_SIZE) {
						yield batch.splice(0)
					}
				}
			}

			// Only scan subdirectories if no metadata was found
			if (!localizedMetadata) {
				const subGenerator = this.scanDirectoryBatched(componentDir, repoUrl, sourceName, depth + 1)
				for await (const subBatch of subGenerator) {
					batch.push(...subBatch)
					if (batch.length >= MetadataScanner.BATCH_SIZE) {
						yield batch.splice(0)
					}
				}
			}
		}

		if (batch.length > 0) {
			yield batch
		}
	}

	/**
	 * Scans a directory for components
	 * @param rootDir The root directory to scan
	 * @param repoUrl The repository URL
	 * @param sourceName Optional source repository name
	 * @returns Array of discovered items
	 */
	/**
	 * Scan a directory and return items in batches
	 */
	async scanDirectory(
		rootDir: string,
		repoUrl: string,
		sourceName?: string,
		isRecursiveCall: boolean = false,
	): Promise<MarketplaceItem[]> {
		// Only set originalRootDir on the first call
		if (!isRecursiveCall && !this.originalRootDir) {
			this.originalRootDir = rootDir
		}

		const items: MarketplaceItem[] = []
		const generator = this.scanDirectoryBatched(rootDir, repoUrl, sourceName)

		for await (const batch of generator) {
			items.push(...batch)
		}

		return items
	}

	/**
	 * Gets localized metadata with fallback
	 * @param metadata The localized metadata object
	 * @returns The metadata in the user's locale or fallback locale, or null if neither is available
	 */
	private getLocalizedMetadata(metadata: LocalizedMetadata<ComponentMetadata>): ComponentMetadata | null {
		const { userLocale, fallbackLocale } = this.localizationOptions

		// First try user's locale
		if (metadata[userLocale]) {
			return metadata[userLocale]
		}

		// Fall back to fallbackLocale (typically English)
		if (metadata[fallbackLocale]) {
			return metadata[fallbackLocale]
		}

		// No suitable metadata found
		return null
	}

	/**
	 * Loads metadata for a component
	 * @param componentDir The component directory
	 * @returns Localized metadata or null if no metadata found
	 */
	private async loadComponentMetadata(componentDir: string): Promise<LocalizedMetadata<ComponentMetadata> | null> {
		const metadata: LocalizedMetadata<ComponentMetadata> = {}
		try {
			const entries = await fs.readdir(componentDir, { withFileTypes: true })

			// Look for metadata.{locale}.yml files
			for (const entry of entries) {
				if (!entry.isFile()) continue

				const match = entry.name.match(/^metadata\.([a-z]{2})\.yml$/)
				if (!match) continue

				const locale = match[1]
				const metadataPath = path.join(componentDir, entry.name)

				try {
					const content = await fs.readFile(metadataPath, "utf-8")
					const parsed = yaml.parse(content) as Record<string, any>

					// Add type field if missing but has a parent directory indicating type
					if (!parsed.type) {
						const parentDir = path.basename(componentDir)
						if (parentDir === "mcps") {
							parsed.type = "mcp"
						}
					}

					metadata[locale] = validateAnyMetadata(parsed) as ComponentMetadata
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error)
					console.error(`Error loading metadata from ${metadataPath}:`, error)

					// Show validation errors to user
					if (errorMessage.includes("Invalid metadata:")) {
						vscode.window.showErrorMessage(
							`Invalid metadata in ${path.basename(metadataPath)}: ${errorMessage.replace("Invalid metadata:", "").trim()}`,
						)
					}
				}
			}
		} catch (error) {
			console.error(`Error reading directory ${componentDir}:`, error)
		}

		return Object.keys(metadata).length > 0 ? metadata : null
	}

	/**
	 * Creates a MarketplaceItem from component metadata
	 * @param metadata The component metadata
	 * @param componentDir The component directory
	 * @param repoUrl The repository URL
	 * @param sourceName Optional source repository name
	 * @returns MarketplaceItem or null if invalid
	 */
	private async createMarketplaceItem(
		metadata: ComponentMetadata,
		componentDir: string,
		repoUrl: string,
		rootDir: string,
		sourceName?: string,
	): Promise<MarketplaceItem | null> {
		// Skip if no type or invalid type
		if (!metadata.type || !this.isValidMarketplaceItemType(metadata.type)) {
			return null
		}
		// Always use the original root directory for path calculations
		const effectiveRootDir = this.originalRootDir || rootDir
		// Always calculate path relative to the original root directory
		const relativePath = path.relative(effectiveRootDir, componentDir).replace(/\\/g, "/")
		// Don't encode spaces in URL to match test expectations
		const urlPath = relativePath
			.split("/")
			.map((part) => encodeURIComponent(part))
			.join("/")
		// Create the item with the correct path and URL
		return {
			id: metadata.id || `${metadata.type}#${relativePath || metadata.name}`,
			name: metadata.name,
			description: metadata.description,
			type: metadata.type,
			version: metadata.version,
			binaryUrl: metadata.binaryUrl,
			binaryHash: metadata.binaryHash,
			tags: metadata.tags,
			url: `${repoUrl}/tree/main/${urlPath}`,
			repoUrl,
			sourceName,
			path: relativePath,
			lastUpdated: await this.getLastModifiedDate(componentDir),
			items: [], // Initialize empty items array for all components
			author: metadata.author,
			authorUrl: metadata.authorUrl,
			sourceUrl: metadata.sourceUrl,
		}
	}

	/**
	 * Gets the last modified date for a component using git history
	 * @param componentDir The component directory
	 * @returns ISO date string
	 */
	private async getLastModifiedDate(componentDir: string): Promise<string> {
		if (this.git) {
			try {
				// Get the latest commit date for the directory and its contents
				const result = await this.git.raw([
					"log",
					"-1",
					"--format=%aI", // ISO 8601 format
					"--",
					componentDir,
				])
				if (result) {
					return result.trim()
				}
			} catch (error) {
				console.error(`Error getting git history for ${componentDir}:`, error)
				// Fall through to fs.stat fallback
			}
		}

		// Fallback to fs.stat if git is not available or fails
		try {
			const stats = await fs.stat(componentDir)
			return stats.mtime.toISOString()
		} catch {
			return new Date().toISOString()
		}
	}

	/**
	 * Recursively scans a package directory for subcomponents
	 * @param packageDir The package directory to scan
	 * @param packageItem The package item to add subcomponents to
	 */
	private async scanPackageSubcomponents(
		packageDir: string,
		packageItem: MarketplaceItem,
		parentPath: string = "",
	): Promise<void> {
		try {
			// First check for explicitly listed items in package metadata
			const metadataPath = path.join(packageDir, "metadata.en.yml")
			try {
				const content = await fs.readFile(metadataPath, "utf-8")
				const parsed = yaml.parse(content) as PackageMetadata

				if (parsed.items) {
					for (const item of parsed.items) {
						// For relative paths starting with ../, resolve from package directory
						const itemPath = path.join(packageDir, item.path)
						const subMetadata = await this.loadComponentMetadata(itemPath)
						if (subMetadata) {
							const localizedSubMetadata = this.getLocalizedMetadata(subMetadata)
							if (localizedSubMetadata) {
								packageItem.items = packageItem.items || []
								packageItem.items.push({
									type: localizedSubMetadata.type,
									path: item.path,
									metadata: localizedSubMetadata,
									lastUpdated: await this.getLastModifiedDate(itemPath),
								})
							}
						}
					}
				}
			} catch (error) {
				// Ignore errors reading metadata.en.yml - we'll still scan subdirectories
			}

			// Then scan subdirectories for implicit components
			const entries = await fs.readdir(packageDir, { withFileTypes: true })
			for (const entry of entries) {
				if (!entry.isDirectory()) continue

				const subPath = path.join(packageDir, entry.name)
				const relativePath = parentPath ? `${parentPath}/${entry.name}` : entry.name

				// Try to load metadata directly
				const subMetadata = await this.loadComponentMetadata(subPath)
				if (!subMetadata) {
					// If no metadata found, recurse into directory
					await this.scanPackageSubcomponents(subPath, packageItem, relativePath)
					continue
				}

				// Get localized metadata with fallback
				const localizedSubMetadata = this.getLocalizedMetadata(subMetadata)
				if (!localizedSubMetadata) {
					// If no localized metadata, recurse into directory
					await this.scanPackageSubcomponents(subPath, packageItem, relativePath)
					continue
				}

				// Check if this component is already listed
				const isListed = packageItem.items?.some((i) => i.path === relativePath)
				if (!isListed) {
					// Initialize items array if needed
					packageItem.items = packageItem.items || []

					// Add new subcomponent
					packageItem.items.push({
						type: localizedSubMetadata.type,
						path: relativePath,
						metadata: localizedSubMetadata,
						lastUpdated: await this.getLastModifiedDate(subPath),
					})
				}

				// Don't recurse into directories that have valid metadata
			}
		} catch (error) {
			console.error(`Error scanning package subcomponents in ${packageDir}:`, error)
		}
	}

	/**
	 * Type guard for component types
	 * @param type The type to check
	 * @returns Whether the type is valid
	 */
	private isValidMarketplaceItemType(type: string): type is MarketplaceItemType {
		return ["role", "mcp", "storage", "mode", "prompt", "package"].includes(type)
	}

	/**
	 * Type guard for package metadata
	 * @param metadata The metadata to check
	 * @returns Whether the metadata is for a package
	 */
	private isPackageMetadata(metadata: ComponentMetadata): metadata is PackageMetadata {
		return metadata.type === "package"
	}
}
