# Marketplace Architecture

This document provides a comprehensive overview of the Marketplace's architecture, including its components, interactions, and data flow.

## System Overview

The Marketplace is built on a modular architecture that separates concerns between data management, UI rendering, and user interactions. The system consists of several key components that work together to provide a seamless experience for discovering, browsing, and managing items.

### High-Level Architecture

```mermaid
graph TD
    User[User] -->|Interacts with| UI[Marketplace UI]
    UI -->|Sends messages| MH[Message Handler]
    MH -->|Processes requests| PM[MarketplaceManager]
    PM -->|Validates sources| PSV[MarketplaceSourceValidation]
    PM -->|Fetches repos| GF[GitFetcher]
    GF -->|Scans metadata| MS[MetadataScanner]
    MS -->|Reads| FS[File System / Git Repositories]
    PM -->|Returns filtered data| MH
    MH -->|Updates state| UI
    UI -->|Displays| User
```

The architecture follows a message-based pattern where:

1. The UI sends messages to the backend through a message handler
2. The backend processes these messages and returns results
3. The UI updates based on the returned data
4. Components are loosely coupled through message passing

## Component Interactions

The Marketplace components interact through a well-defined message flow:

### Core Interaction Patterns

1. **Data Loading**:

    - GitFetcher handles repository cloning and updates
    - MetadataScanner loads item data from repositories
    - MarketplaceManager manages caching and concurrency
    - UI requests data through the message handler

2. **Filtering and Search**:

    - UI sends filter/search criteria to the backend
    - MarketplaceManager applies filters with match info
    - Filtered results are returned to the UI
    - State manager handles view-level filtering

3. **Source Management**:
    - UI sends source management commands
    - MarketplaceManager coordinates with GitFetcher
    - Cache is managed with timeout protection
    - Sources are processed with concurrency control

## Data Flow Diagram

The following diagram illustrates the data flow through the Marketplace system:

```mermaid
graph LR
    subgraph Sources
        GR[Git Repositories]
        FS[File System]
    end

    subgraph Backend
        GF[GitFetcher]
        MS[MetadataScanner]
        PM[MarketplaceManager]
        MH[Message Handler]
    end

    subgraph Frontend
        UI[UI Components]
        State[State Management]
    end

    GR -->|Clone/Pull| GF
    FS -->|Cache| GF
    GF -->|Metadata| MS
    MS -->|Parsed Data| PM
    PM -->|Cached Items| PM
    UI -->|User Actions| MH
    MH -->|Messages| PM
    PM -->|Filtered Data| MH
    MH -->|Updates| State
    State -->|Renders| UI
```

## Sequence Diagrams

### Item Loading Sequence

The following sequence diagram shows how items are loaded from sources:

```mermaid
sequenceDiagram
    participant User
    participant UI as UI Components
    participant MH as Message Handler
    participant PM as MarketplaceManager
    participant GF as GitFetcher
    participant MS as MetadataScanner
    participant FS as File System/Git

    User->>UI: Open Marketplace
    UI->>MH: Send init message
    MH->>PM: Initialize
    PM->>GF: Request repository data
    GF->>FS: Clone/pull repository
    GF->>MS: Request metadata scan
    MS->>FS: Read repository data
    FS-->>MS: Return raw data
    MS-->>GF: Return parsed metadata
    GF-->>PM: Return repository data
    PM-->>MH: Return initial items
    MH-->>UI: Update with items
    UI-->>User: Display items
```

### Search and Filter Sequence

This sequence diagram illustrates the search and filter process:

```mermaid
sequenceDiagram
    participant User
    participant UI as UI Components
    participant State as State Manager
    participant MH as Message Handler
    participant PM as MarketplaceManager

    User->>UI: Enter search term
    UI->>State: Update filters
    State->>MH: Send search message
    MH->>PM: Apply search filter
    PM->>PM: Filter items with match info
    PM-->>MH: Return filtered items
    MH-->>State: Update with filtered items
    State-->>UI: Update view
    UI-->>User: Display filtered results

    User->>UI: Select type filter
    UI->>State: Update type filter
    State->>MH: Send type filter message
    MH->>PM: Apply type filter
    PM->>PM: Filter by type with match info
    PM-->>MH: Return type-filtered items
    MH-->>State: Update filtered items
    State-->>UI: Update view
    UI-->>User: Display type-filtered results
```

## Class Diagrams

### Core Classes

The following class diagram shows the main classes in the Marketplace system:

```mermaid
classDiagram
    class MarketplaceManager {
        -currentItems: MarketplaceItem[]
        -cache: Map
        -gitFetcher: GitFetcher
        -activeSourceOperations: Set
        +getMarketplaceItems(): MarketplaceItem[]
        +filterItems(filters): MarketplaceItem[]
        +sortItems(sortBy, order): MarketplaceItem[]
        +refreshRepository(url): void
        -queueOperation(operation): void
        -validateSources(sources): ValidationError[]
    }

    class MarketplaceSourceValidation {
        +validateSourceUrl(url): ValidationError[]
        +validateSourceName(name): ValidationError[]
        +validateSourceDuplicates(sources): ValidationError[]
        +validateSource(source): ValidationError[]
        +validateSources(sources): ValidationError[]
        -isValidGitRepositoryUrl(url): boolean
    }

    class GitFetcher {
        -cacheDir: string
        -metadataScanner: MetadataScanner
        +fetchRepository(url): MarketplaceRepository
        -cloneOrPullRepository(url): void
        -validateRegistryStructure(dir): void
        -parseRepositoryMetadata(dir): RepositoryMetadata
    }

    class MetadataScanner {
        -git: SimpleGit
        +scanDirectory(path): MarketplaceItem[]
        +parseMetadata(file): ComponentMetadata
        -buildComponentHierarchy(items): MarketplaceItem[]
    }

    class MarketplaceViewStateManager {
        -state: ViewState
        -stateChangeHandlers: Set
        -fetchTimeoutId: NodeJS.Timeout
        -sourcesModified: boolean
        +initialize(): void
        +onStateChange(handler): () => void
        +cleanup(): void
        +getState(): ViewState
        +transition(transition): Promise<void>
        -notifyStateChange(): void
        -clearFetchTimeout(): void
        -isFilterActive(): boolean
        -filterItems(items): MarketplaceItem[]
        -sortItems(items): MarketplaceItem[]
        +handleMessage(message): Promise<void>
    }

    MarketplaceManager --> GitFetcher: uses
    MarketplaceManager --> MarketplaceSourceValidation: uses
    GitFetcher --> MetadataScanner: uses
    MarketplaceManager --> MarketplaceViewStateManager: updates
```

## Component Responsibilities

### Backend Components

1. **GitFetcher**

    - Handles Git repository operations
    - Manages repository caching
    - Validates repository structure
    - Coordinates with MetadataScanner

2. **MetadataScanner**

    - Scans directories and repositories
    - Parses YAML metadata files
    - Builds component hierarchies
    - Handles file system operations

3. **MarketplaceManager**

    - Manages concurrent operations
    - Handles caching with timeout protection
    - Coordinates repository operations
    - Provides filtering and sorting

4. **marketplaceMessageHandler**
    - Routes messages between UI and backend
    - Processes commands from the UI
    - Returns data and status updates
    - Handles error conditions

### Frontend Components

1. **MarketplaceViewStateManager**

    - Manages frontend state and backend synchronization
    - Handles state transitions and message processing
    - Manages filtering, sorting, and view preferences
    - Coordinates with backend state
    - Handles timeout protection for operations
    - Manages source modification tracking
    - Provides state change subscriptions

2. **MarketplaceSourceValidation**

    - Validates Git repository URLs for any domain
    - Validates source names and configurations
    - Detects duplicate sources (case-insensitive)
    - Provides structured validation errors
    - Supports multiple Git protocols (HTTPS, SSH, Git)

3. **MarketplaceItemCard**

    - Displays item information
    - Handles tag interactions
    - Manages expandable sections
    - Shows match highlights
    - Handle item actions.

4. **ExpandableSection**

    - Provides collapsible sections
    - Manages expand/collapse state
    - Handles animations
    - Shows section metadata

5. **TypeGroup**
    - Groups items by type
    - Formats item lists
    - Highlights search matches
    - Maintains consistent styling

## Performance Considerations

The Marketplace architecture addresses several performance challenges:

1. **Concurrency Control**:

    - Source operations are locked to prevent conflicts
    - Operations are queued during metadata scanning
    - Cache timeouts prevent hanging operations
    - Repository operations are atomic

2. **Efficient Caching**:

    - Repository data is cached with expiry
    - Cache is cleaned up automatically
    - Forced refresh available when needed
    - Cache directories managed efficiently

3. **Smart Filtering**:
    - Match info tracks filter matches
    - Filtering happens at multiple levels
    - View state optimizes re-renders
    - Search is case-insensitive and normalized

## Error Handling

The architecture includes robust error handling:

1. **Repository Operations**:

    - Git lock files are cleaned up
    - Failed clones are retried
    - Corrupt repositories are re-cloned
    - Network timeouts are handled

2. **Data Processing**:

    - Invalid metadata is gracefully handled
    - Missing files are reported clearly
    - Parse errors preserve partial data
    - Type validation ensures consistency

3. **State Management**:
    - Invalid filters are normalized
    - Sort operations handle missing data
    - View updates are atomic
    - Error states are preserved

## Extensibility Points

The Marketplace architecture is designed for extensibility:

1. **Repository Sources**:

    - Support for multiple Git providers
    - Custom repository validation
    - Flexible metadata formats
    - Localization support

2. **Filtering System**:

    - Custom filter types
    - Extensible match info
    - Flexible sort options
    - View state customization

3. **UI Components**:
    - Custom item renderers
    - Flexible layout system
    - Theme integration
    - Accessibility support

---

**Previous**: [Adding Custom Item Sources](../user-guide/06-adding-custom-sources.md) | **Next**: [Core Components](./02-core-components.md)
