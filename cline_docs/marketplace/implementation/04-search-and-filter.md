# Search and Filter Implementation

This document details the implementation of search and filtering functionality in the Marketplace, including algorithms, optimization techniques, and performance considerations.

## Core Filter System

The Marketplace implements a comprehensive filtering system that handles multiple filter types, concurrent operations, and detailed match tracking.

### Filter Implementation

```typescript
/**
 * Filter items based on criteria with match tracking
 */
export function filterItems(
	items: PackageManagerItem[],
	filters: {
		type?: ComponentType
		search?: string
		tags?: string[]
	},
): PackageManagerItem[] {
	// Helper function to normalize text for case-insensitive comparison
	const normalizeText = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim()

	// Normalize search term once
	const searchTerm = filters.search ? normalizeText(filters.search) : ""

	// Create a deep clone of items
	const clonedItems = items.map((item) => JSON.parse(JSON.stringify(item)) as PackageManagerItem)

	return clonedItems
		.filter((item) => {
			// Check parent item matches
			const itemMatches = {
				type: !filters.type || item.type === filters.type,
				search:
					!searchTerm ||
					containsSearchTerm(item.name, searchTerm) ||
					containsSearchTerm(item.description, searchTerm),
				tags: !filters.tags?.length || (item.tags && filters.tags.some((tag) => item.tags!.includes(tag))),
			}

			// Check subcomponent matches
			const subcomponentMatches =
				item.items?.some((subItem) => {
					const subMatches = {
						type: !filters.type || subItem.type === filters.type,
						search:
							!searchTerm ||
							(subItem.metadata &&
								(containsSearchTerm(subItem.metadata.name, searchTerm) ||
									containsSearchTerm(subItem.metadata.description, searchTerm))),
						tags:
							!filters.tags?.length ||
							(subItem.metadata?.tags &&
								filters.tags.some((tag) => subItem.metadata!.tags!.includes(tag))),
					}

					return (
						subMatches.type &&
						(!searchTerm || subMatches.search) &&
						(!filters.tags?.length || subMatches.tags)
					)
				}) ?? false

			// Include item if either parent matches or has matching subcomponents
			const hasActiveFilters = filters.type || searchTerm || filters.tags?.length
			if (!hasActiveFilters) return true

			const parentMatchesAll = itemMatches.type && itemMatches.search && itemMatches.tags
			const isPackageWithMatchingSubcomponent = item.type === "package" && subcomponentMatches

			return parentMatchesAll || isPackageWithMatchingSubcomponent
		})
		.map((item) => addMatchInfo(item, filters))
}
```

### Match Tracking

The system tracks detailed match information:

```typescript
/**
 * Add match information to items
 */
function addMatchInfo(item: PackageManagerItem, filters: Filters): PackageManagerItem {
	const matchReason: Record<string, boolean> = {
		nameMatch: filters.search ? containsSearchTerm(item.name, filters.search) : true,
		descriptionMatch: filters.search ? containsSearchTerm(item.description, filters.search) : true,
		typeMatch: filters.type ? item.type === filters.type : true,
		tagMatch: filters.tags?.length ? hasMatchingTags(item.tags, filters.tags) : true,
	}

	// Process subcomponents
	if (item.items) {
		item.items = item.items.map((subItem) => {
			const subMatches = {
				type: !filters.type || subItem.type === filters.type,
				search:
					!filters.search ||
					(subItem.metadata &&
						(containsSearchTerm(subItem.metadata.name, filters.search) ||
							containsSearchTerm(subItem.metadata.description, filters.search))),
				tags:
					!filters.tags?.length ||
					(subItem.metadata?.tags && filters.tags.some((tag) => subItem.metadata!.tags!.includes(tag))),
			}

			subItem.matchInfo = {
				matched: subMatches.type && subMatches.search && subMatches.tags,
				matchReason: {
					typeMatch: subMatches.type,
					nameMatch: subMatches.search,
					tagMatch: subMatches.tags,
				},
			}

			return subItem
		})
	}

	return {
		...item,
		matchInfo: {
			matched: Object.values(matchReason).every(Boolean),
			matchReason,
		},
	}
}
```

## Sort System

The Marketplace implements flexible sorting with subcomponent support:

```typescript
/**
 * Sort items with subcomponent support
 */
export function sortItems(
	items: PackageManagerItem[],
	sortBy: "name" | "lastUpdated" | "author",
	sortOrder: "asc" | "desc",
	sortSubcomponents: boolean = false,
): PackageManagerItem[] {
	return [...items]
		.map((item) => {
			const clonedItem = { ...item }

			if (clonedItem.items && sortSubcomponents) {
				clonedItem.items = [...clonedItem.items].sort((a, b) => {
					const aValue = getSortValue(a, sortBy)
					const bValue = getSortValue(b, sortBy)
					return compareValues(aValue, bValue, sortOrder)
				})
			}

			return clonedItem
		})
		.sort((a, b) => {
			const aValue = getSortValue(a, sortBy)
			const bValue = getSortValue(b, sortBy)
			return compareValues(aValue, bValue, sortOrder)
		})
}
```

## State Management Integration

The filtering system integrates with the state management through state transitions:

```typescript
export class PackageManagerViewStateManager {
	private state: ViewState
	private stateChangeHandlers: Set<StateChangeHandler>

	/**
	 * Process state transitions
	 */
	public async transition(transition: ViewStateTransition): Promise<void> {
		switch (transition.type) {
			case "UPDATE_FILTERS": {
				const { filters = {} } = transition.payload || {}

				// Update filters while preserving existing ones
				const updatedFilters = {
					type: filters.type ?? this.state.filters.type,
					search: filters.search ?? this.state.filters.search,
					tags: filters.tags ?? this.state.filters.tags,
				}

				// Update state
				this.state = {
					...this.state,
					filters: updatedFilters,
				}

				// Notify subscribers
				this.notifyStateChange()

				// Request filtered items from backend
				vscode.postMessage({
					type: "filterPackageManagerItems",
					filters: updatedFilters,
				})
				break
			}

			case "FETCH_COMPLETE": {
				const { items } = transition.payload as { items: PackageManagerItem[] }

				// Update both all items and display items
				this.state = {
					...this.state,
					allItems: items,
					displayItems: items,
					isFetching: false,
				}

				this.notifyStateChange()
				break
			}
		}
	}

	/**
	 * Subscribe to state changes
	 */
	public onStateChange(handler: StateChangeHandler): () => void {
		this.stateChangeHandlers.add(handler)
		return () => this.stateChangeHandlers.delete(handler)
	}
}
```

````

## Performance Optimizations

### Concurrent Operation Handling

```typescript
export class PackageManagerManager {
	private isMetadataScanActive = false
	private pendingOperations: Array<() => Promise<void>> = []

	/**
	 * Queue filter operations during active scans
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

			const nextOperation = this.pendingOperations.shift()
			if (nextOperation) {
				void this.queueOperation(nextOperation)
			}
		}
	}
}
````

### Filter Optimizations

1. **Early Termination**:

    - Returns as soon as any field matches
    - Avoids unnecessary checks
    - Handles empty filters efficiently

2. **Efficient String Operations**:

    - Normalizes text once
    - Uses native string methods
    - Avoids regex for simple matches

3. **State Management**:
    - State transitions for predictable updates
    - Subscriber pattern for state changes
    - Separation of all items and display items
    - Backend-driven filtering
    - Optimistic UI updates
    - Efficient state synchronization

## Testing Strategy

```typescript
describe("Filter System", () => {
	describe("Match Tracking", () => {
		it("should track type matches", () => {
			const result = filterItems([testItem], { type: "mode" })
			expect(result[0].matchInfo.matchReason.typeMatch).toBe(true)
		})

		it("should track subcomponent matches", () => {
			const result = filterItems([testPackage], { search: "test" })
			const subItem = result[0].items![0]
			expect(subItem.matchInfo.matched).toBe(true)
		})
	})

	describe("Sort System", () => {
		it("should sort subcomponents", () => {
			const result = sortItems([testPackage], "name", "asc", true)
			expect(result[0].items).toBeSorted((a, b) => a.metadata.name.localeCompare(b.metadata.name))
		})
	})
})
```

## Error Handling

The system includes robust error handling:

1. **Filter Errors**:

    - Invalid filter types
    - Malformed search terms
    - Missing metadata

2. **Sort Errors**:

    - Invalid sort fields
    - Missing sort values
    - Type mismatches

3. **State Errors**:
    - Invalid state transitions
    - Message handling errors
    - State synchronization issues
    - Timeout handling
    - Source modification tracking
    - Filter validation errors

---

**Previous**: [Data Structures](./03-data-structures.md) | **Next**: [UI Component Design](./05-ui-components.md)
