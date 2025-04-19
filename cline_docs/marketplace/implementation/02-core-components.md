# Core Components

This document provides detailed information about the core components of the Marketplace system, their responsibilities, implementation details, and interactions.

## GitFetcher

The GitFetcher is responsible for managing Git repository operations, including cloning, pulling, and caching repository data.

### Responsibilities

- Cloning and updating Git repositories
- Managing repository cache
- Validating repository structure
- Coordinating with MetadataScanner
- Handling repository timeouts and errors

### Implementation Details

```typescript
class GitFetcher {
	private readonly cacheDir: string
	private metadataScanner: MetadataScanner
	private git?: SimpleGit

	/**
	 * Fetch repository data
	 * @param repoUrl Repository URL
	 * @param forceRefresh Whether to bypass cache
	 * @param sourceName Optional source name
	 * @returns Repository data
	 */
	public async fetchRepository(
		repoUrl: string,
		forceRefresh = false,
		sourceName?: string,
	): Promise<PackageManagerRepository> {
		// Implementation details
	}

	/**
	 * Clone or pull repository
	 * @param repoUrl Repository URL
	 * @param repoDir Repository directory
	 * @param forceRefresh Whether to force refresh
	 */
	private async cloneOrPullRepository(repoUrl: string, repoDir: string, forceRefresh: boolean): Promise<void> {
		// Implementation details
	}

	/**
	 * Clean up git locks
	 * @param repoDir Repository directory
	 */
	private async cleanupGitLocks(repoDir: string): Promise<void> {
		// Implementation details
	}
}
```

### Key Algorithms

#### Repository Management

The repository management process includes:

1. **Cache Management**:

    - Check if repository exists in cache
    - Validate cache freshness
    - Clean up stale cache entries
    - Handle cache directory creation

2. **Repository Operations**:

    - Clone new repositories
    - Pull updates for existing repos
    - Handle git lock files
    - Clean up failed operations

3. **Error Recovery**:
    - Handle network timeouts
    - Recover from corrupt repositories
    - Clean up partial clones
    - Retry failed operations

## MetadataScanner

The MetadataScanner is responsible for reading and parsing package metadata from repositories.

### Responsibilities

- Scanning directories for package metadata files
- Parsing YAML metadata into structured objects
- Building component hierarchies
- Supporting localized metadata
- Validating metadata structure

### Implementation Details

```typescript
class MetadataScanner {
	private git: SimpleGit
	private localizationOptions: LocalizationOptions

	/**
	 * Scan directory for package metadata
	 * @param directoryPath Directory to scan
	 * @param baseUrl Base repository URL
	 * @param sourceName Source repository name
	 * @returns Array of package items
	 */
	public async scanDirectory(
		directoryPath: string,
		baseUrl?: string,
		sourceName?: string,
	): Promise<PackageManagerItem[]> {
		// Implementation details
	}

	/**
	 * Parse metadata file
	 * @param filePath Path to metadata file
	 * @returns Parsed metadata
	 */
	private async parseMetadataFile(filePath: string): Promise<ComponentMetadata> {
		// Implementation details
	}
}
```

## PackageManagerManager

The PackageManagerManager is the central component that manages marketplace data, caching, and operations.

### Responsibilities

- Managing concurrent operations
- Handling repository caching
- Coordinating with GitFetcher
- Applying filters and sorting
- Managing package sources

### Implementation Details

```typescript
class PackageManagerManager {
	private currentItems: PackageManagerItem[] = []
	private cache: Map<string, { data: PackageManagerRepository; timestamp: number }>
	private gitFetcher: GitFetcher
	private activeSourceOperations = new Set<string>()
	private isMetadataScanActive = false
	private pendingOperations: Array<() => Promise<void>> = []

	/**
	 * Queue an operation to run when no metadata scan is active
	 */
	private async queueOperation(operation: () => Promise<void>): Promise<void> {
		// Implementation details
	}

	/**
	 * Get marketplace items from sources
	 */
	public async getPackageManagerItems(
		sources: PackageManagerSource[],
	): Promise<{ items: PackageManagerItem[]; errors?: string[] }> {
		// Implementation details
	}

	/**
	 * Filter items based on criteria
	 */
	public filterItems(
		items: PackageManagerItem[],
		filters: { type?: ComponentType; search?: string; tags?: string[] },
	): PackageManagerItem[] {
		// Implementation details
	}

	/**
	 * Sort items by field
	 */
	public sortItems(
		items: PackageManagerItem[],
		sortBy: keyof Pick<PackageManagerItem, "name" | "author" | "lastUpdated">,
		sortOrder: "asc" | "desc",
		sortSubcomponents: boolean = false,
	): PackageManagerItem[] {
		// Implementation details
	}
}
```

### Key Algorithms

#### Concurrency Control

The manager implements sophisticated concurrency control:

1. **Operation Queueing**:

    - Queue operations during active scans
    - Process operations sequentially
    - Handle operation dependencies
    - Maintain operation order

2. **Source Locking**:

    - Lock sources during operations
    - Prevent concurrent source access
    - Handle lock timeouts
    - Clean up stale locks

3. **Cache Management**:
    - Implement cache expiration
    - Handle cache invalidation
    - Clean up unused cache
    - Optimize cache storage

#### Advanced Filtering

The filtering system provides rich functionality:

1. **Multi-level Filtering**:

    - Filter parent items
    - Filter subcomponents
    - Handle package-specific logic
    - Track match information

2. **Match Information**:
    - Track match reasons
    - Handle partial matches
    - Support highlighting
    - Maintain match context

## PackageManagerSourceValidation

The PackageManagerSourceValidation component handles validation of marketplace sources and their configurations.

### Responsibilities

- Validating Git repository URLs for any domain
- Validating source names and configurations
- Detecting duplicate sources
- Providing structured validation errors
- Supporting multiple Git protocols

### Implementation Details

```typescript
export class PackageManagerSourceValidation {
	/**
	 * Validates a marketplace source URL
	 */
	public static validateSourceUrl(url: string): ValidationError[] {
		// Implementation details
	}

	/**
	 * Validates a marketplace source name
	 */
	public static validateSourceName(name?: string): ValidationError[] {
		// Implementation details
	}

	/**
	 * Validates sources for duplicates
	 */
	public static validateSourceDuplicates(
		sources: PackageManagerSource[],
		newSource?: PackageManagerSource,
	): ValidationError[] {
		// Implementation details
	}

	/**
	 * Checks if a URL is a valid Git repository URL
	 */
	private static isValidGitRepositoryUrl(url: string): boolean {
		// Implementation details
	}
}
```

### Key Algorithms

#### URL Validation

The URL validation system supports:

1. **Protocol Validation**:

    - HTTPS URLs
    - SSH URLs
    - Git protocol URLs
    - Custom domains and ports

2. **Domain Validation**:

    - Any valid domain name
    - IP addresses
    - Localhost for testing
    - Internal company domains

3. **Path Validation**:
    - Username/organization
    - Repository name
    - Optional .git suffix
    - Subpath support

## PackageManagerViewStateManager

The PackageManagerViewStateManager manages frontend state and synchronization with the backend.

### Responsibilities

- Managing frontend state transitions
- Handling message processing
- Managing timeouts and retries
- Coordinating with backend state
- Providing state change subscriptions
- Managing source modification tracking
- Handling filtering and sorting

### Implementation Details

```typescript
class PackageManagerViewStateManager {
	private state: ViewState
	private stateChangeHandlers: Set<StateChangeHandler>
	private fetchTimeoutId?: NodeJS.Timeout
	private sourcesModified: boolean

	/**
	 * Initialize state manager
	 */
	public initialize(): void {
		// Implementation details
	}

	/**
	 * Subscribe to state changes
	 */
	public onStateChange(handler: StateChangeHandler): () => void {
		// Implementation details
	}

	/**
	 * Process state transitions
	 */
	public async transition(transition: ViewStateTransition): Promise<void> {
		// Implementation details
	}

	/**
	 * Handle incoming messages
	 */
	public async handleMessage(message: any): Promise<void> {
		// Implementation details
	}
}
```

## Component Integration

The components work together through well-defined interfaces:

### Data Flow

1. **Repository Operations**:

    - PackageManagerManager validates sources with PackageManagerSourceValidation
    - PackageManagerManager coordinates with GitFetcher
    - GitFetcher manages repository state
    - MetadataScanner processes repository content
    - Results flow back to PackageManagerManager

2. **State Management**:

    - PackageManagerManager maintains backend state
    - ViewStateManager handles UI state transitions
    - ViewStateManager processes messages
    - State changes notify subscribers
    - Components react to state changes
    - Timeout protection ensures responsiveness

3. **User Interactions**:
    - UI events trigger state updates
    - ViewStateManager processes changes
    - Changes propagate to backend
    - Results update UI state

## Performance Optimizations

The system includes several optimizations:

1. **Concurrent Operations**:

    - Operation queueing
    - Source locking
    - Parallel processing where safe
    - Resource management

2. **Efficient Caching**:

    - Multi-level cache
    - Cache invalidation
    - Lazy loading
    - Cache cleanup

3. **Smart Filtering**:

    - Optimized algorithms
    - Match tracking
    - Incremental updates
    - Result caching

4. **State Management**:
    - Minimal updates
    - State normalization
    - Change batching
    - Update optimization

---

**Previous**: [Marketplace Architecture](./01-architecture.md) | **Next**: [Data Structures](./03-data-structures.md)
