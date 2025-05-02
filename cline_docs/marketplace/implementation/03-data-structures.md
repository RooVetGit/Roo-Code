# Data Structures

This document details the key data structures used in the Marketplace, including their definitions, relationships, and usage patterns.

## Item Types

The Marketplace uses a type system to categorize different kinds of items:

### MarketplaceItemType Enumeration

[/src/services/marketplace/types.ts](/src/services/marketplace/types.ts)

These types represent the different kinds of components that can be managed by the Marketplace:

1. **mode**: AI assistant personalities with specialized capabilities
2. **prompt**: Pre-configured instructions for specific tasks
3. **mcp**: Model Context Protocol servers that provide additional functionality
4. **package**: Collections of items (multiple modes, mcps,..., like `roo-commander`)

## Core Data Structures

### MarketplaceRepository

```typescript
/**
 * Represents a repository with its metadata and items
 */
export interface MarketplaceRepository {
	metadata: RepositoryMetadata
	items: MarketplaceItem[]
	url: string
	defaultBranch: string
	error?: string
}
```

This interface represents a complete repository:

- **metadata**: The repository metadata
- **items**: Array of items in the repository
- **url**: The URL to the repository
- **defaultBranch**: The default Git branch (e.g., "main")
- **error**: Optional error message if there was a problem

### MarketplaceItem

[/src/services/marketplace/types.ts](/src/services/marketplace/types.ts)

Key changes:

- Added **defaultBranch** field for Git branch tracking
- Enhanced **matchInfo** structure for better filtering
- Improved subcomponent handling

### MatchInfo

[/src/services/marketplace/types.ts](/src/services/marketplace/types.ts)

Enhanced match tracking:

- Added **typeMatch** for component type filtering
- More detailed match reasons
- Support for subcomponent matching

## State Management Structures

### ValidationError

[/src/shared/MarketplaceValidation.ts](/src/shared/MarketplaceValidation.ts)

Used for structured validation errors:

- **field**: The field that failed validation (e.g., "url", "name")
- **message**: Human-readable error message

### ViewState

[/webview-ui/src/components/marketplace/MarketplaceViewStateManager.ts](/webview-ui/src/components/marketplace/MarketplaceViewStateManager.ts)

Manages UI state:

- **allItems**: All available items
- **displayItems**: Currently filtered/displayed items
- **isFetching**: Loading state indicator
- **activeTab**: Current view tab
- **refreshingUrls**: Sources being refreshed
- **sources**: Marketplace sources
- **filters**: Active filters
- **sortConfig**: Sort configuration

### ViewStateTransition

[/webview-ui/src/components/marketplace/MarketplaceViewStateManager.ts](/webview-ui/src/components/marketplace/MarketplaceViewStateManager.ts)

Defines state transitions:

- Operation types
- Optional payloads
- Type-safe transitions

### Filters

[/webview-ui/src/components/marketplace/MarketplaceViewStateManager.ts](/webview-ui/src/components/marketplace/MarketplaceViewStateManager.ts)

Enhanced filtering:

- Component type filtering
- Text search
- Tag-based filtering

## Metadata Interfaces

### BaseMetadata

[/src/services/marketplace/types.ts](/src/services/marketplace/types.ts)

Common metadata properties:

- **name**: Display name
- **description**: Detailed explanation
- **version**: Semantic version
- **tags**: Optional keywords

### ComponentMetadata

[/src/services/marketplace/types.ts](/src/services/marketplace/types.ts)

Added:

- **type** field for item component type

### PackageMetadata

[/src/services/marketplace/types.ts](/src/services/marketplace/types.ts)

Enhanced with:

- Subcomponent tracking

## Source Management

### MarketplaceSource

[/src/services/marketplace/types.ts](/src/services/marketplace/types.ts)

## Message Structures

> TBA

## Data Validation

### Metadata Validation

[/src/services/marketplace/schemas.ts](/src/services/marketplace/schemas.ts)

### URL Validation

[/src/shared/MarketplaceValidation.ts](/src/shared/MarketplaceValidation.ts)

Supports:

- Any valid domain name
- Multiple Git protocols
- Optional .git suffix
- Subpath components

## Data Flow

The Marketplace transforms data through several stages:

1. **Repository Level**:

    - Clone/pull Git repositories
    - Parse metadata files
    - Build component hierarchy

2. **Cache Level**:

    - Store repository data
    - Track timestamps
    - Handle expiration

3. **View Level**:
    - Apply filters
    - Sort items
    - Track matches
    - Manage UI state

## Data Relationships

### Component Hierarchy

```
Repository
├── Metadata
└── Items
    ├── Package
    │   ├── Mode
    │   ├── MCP
    │   └── Prompt
    └── Standalone Components (Modes, MCP, Prompts)
```

### State Flow

```
Git Repository → Cache → Marketplace → ViewState → UI
```

### Filter Chain

```
Raw Items → Type Filter → Search Filter → Tag Filter → Sorted Results
```

---

**Previous**: [Core Components](./02-core-components.md) | **Next**: [Search and Filter Implementation](./04-search-and-filter.md)
