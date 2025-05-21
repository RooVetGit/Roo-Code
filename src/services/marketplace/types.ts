import { RocketConfig } from "config-rocket"

/**
 * Information about why an item matched search/filter criteria
 */
export interface MatchInfo {
	matched: boolean
	matchReason?: {
		nameMatch?: boolean
		descriptionMatch?: boolean
		tagMatch?: boolean
		typeMatch?: boolean
		hasMatchingSubcomponents?: boolean
	}
}

/**
 * Supported component types
 */
export type MarketplaceItemType = "mode" | "prompt" | "package" | "mcp"

/**
 * Base metadata interface
 */
export interface BaseMetadata {
	id?: string
	name: string
	description: string
	version: string
	binaryUrl?: string
	binaryHash?: string
	tags?: string[]
	author?: string
	authorUrl?: string
	sourceUrl?: string
}

/**
 * Repository root metadata
 */
export interface RepositoryMetadata extends BaseMetadata {}

/**
 * Component metadata with type
 */
export interface ComponentMetadata extends BaseMetadata {
	type: MarketplaceItemType
}

/**
 * Package metadata with optional subcomponents
 */
export interface PackageMetadata extends ComponentMetadata {
	type: "package"
	items?: {
		type: MarketplaceItemType
		path: string
		metadata?: ComponentMetadata
	}[]
}

/**
 * Subcomponent metadata with parent reference
 */
export interface SubcomponentMetadata extends ComponentMetadata {
	parentPackage: {
		name: string
		path: string
	}
}

/**
 * Represents an individual parsed marketplace item
 */
export interface MarketplaceItem {
	id: string
	name: string
	description: string
	type: MarketplaceItemType
	url: string
	repoUrl: string
	sourceName?: string
	author?: string
	authorUrl?: string
	tags?: string[]
	version: string
	binaryUrl?: string
	binaryHash?: string
	lastUpdated?: string
	sourceUrl?: string
	defaultBranch?: string
	path?: string // Add path to main item
	items?: {
		type: MarketplaceItemType
		path: string
		metadata?: ComponentMetadata
		lastUpdated?: string
		matchInfo?: MatchInfo // Add match information for subcomponents
	}[]
	matchInfo?: MatchInfo // Add match information for the package itself
	config?: RocketConfig // Revert to using RocketConfig
}

/**
 * Represents a Git repository source for marketplace items
 */
export interface MarketplaceSource {
	url: string
	name?: string
	enabled: boolean
}

/**
 * Represents a repository with its metadata and items
 */
export interface MarketplaceRepository {
	metadata: RepositoryMetadata
	items: MarketplaceItem[]
	url: string
	error?: string
	defaultBranch?: string
}

/**
 * Utility type for metadata files with locale
 */
export type LocalizedMetadata<T> = {
	[locale: string]: T
}

/**
 * Options for localization handling
 */
export interface LocalizationOptions {
	userLocale: string
	fallbackLocale: string
}

export interface InstallMarketplaceItemOptions {
	/**
	 * Specify the target scope
	 *
	 * @default 'project'
	 */
	target?: "global" | "project"
	/**
	 * Parameters provided by the user for configurable marketplace items
	 */
	parameters?: Record<string, any>
}

export interface RemoveInstalledMarketplaceItemOptions {
	/**
	 * Specify the target scope
	 *
	 * @default 'project'
	 */
	target?: "global" | "project"
}
