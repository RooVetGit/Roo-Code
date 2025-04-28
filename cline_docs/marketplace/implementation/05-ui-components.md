# UI Component Design

This document details the design and implementation of the Marketplace's UI components, including their structure, styling, interactions, and accessibility features.

## PackageManagerView

The PackageManagerView is the main container component that manages the overall marketplace interface.

### Component Structure

```tsx
const PackageManagerView: React.FC<PackageManagerViewProps> = ({ onDone }) => {
	const [state, manager] = useStateManager()
	const [tagSearch, setTagSearch] = useState("")
	const [isTagInputActive, setIsTagInputActive] = useState(false)

	// Fetch items on mount
	useEffect(() => {
		manager.transition({ type: "FETCH_ITEMS" })
	}, [manager])

	return (
		<Tab>
			<TabHeader>
				<div className="flex justify-between items-center">
					<h3>Marketplace</h3>
					<div className="flex gap-2">
						<Button
							variant={state.activeTab === "browse" ? "default" : "secondary"}
							onClick={() =>
								manager.transition({
									type: "SET_ACTIVE_TAB",
									payload: { tab: "browse" },
								})
							}>
							Browse
						</Button>
						<Button
							variant={state.activeTab === "sources" ? "default" : "secondary"}
							onClick={() =>
								manager.transition({
									type: "SET_ACTIVE_TAB",
									payload: { tab: "sources" },
								})
							}>
							Sources
						</Button>
					</div>
				</div>
			</TabHeader>

			<TabContent>
				{state.activeTab === "browse" ? (
					<BrowseView
						items={state.displayItems || []}
						filters={state.filters}
						onUpdateFilters={(filters) =>
							manager.transition({
								type: "UPDATE_FILTERS",
								payload: { filters },
							})
						}
					/>
				) : (
					<SourcesView
						sources={state.sources}
						refreshingUrls={state.refreshingUrls}
						onRefreshSource={(url) =>
							manager.transition({
								type: "REFRESH_SOURCE",
								payload: { url },
							})
						}
						onSourcesChange={(sources) =>
							manager.transition({
								type: "UPDATE_SOURCES",
								payload: { sources },
							})
						}
					/>
				)}
			</TabContent>
		</Tab>
	)
}
```

### State Management Integration

The component uses the PackageManagerViewStateManager through the useStateManager hook:

```tsx
const [state, manager] = useStateManager()
```

Key features:

- Manages tab state (browse/sources)
- Handles source configuration
- Coordinates filtering and sorting
- Manages loading states
- Handles source validation

## PackageManagerItemCard

The PackageManagerItemCard is the primary component for displaying package information in the UI.

### Component Structure

```tsx
export const PackageManagerItemCard: React.FC<PackageManagerItemCardProps> = ({
	item,
	filters,
	setFilters,
	activeTab,
	setActiveTab,
}) => {
	// URL validation helper
	const isValidUrl = (urlString: string): boolean => {
		try {
			new URL(urlString)
			return true
		} catch (e) {
			return false
		}
	}

	// Type label and color helpers
	const getTypeLabel = (type: string) => {
		switch (type) {
			case "mode":
				return "Mode"
			case "mcp server":
				return "MCP Server"
			case "prompt":
				return "Prompt"
			case "package":
				return "Package"
			default:
				return "Other"
		}
	}

	const getTypeColor = (type: string) => {
		switch (type) {
			case "mode":
				return "bg-blue-600"
			case "mcp server":
				return "bg-green-600"
			case "prompt":
				return "bg-purple-600"
			case "package":
				return "bg-orange-600"
			default:
				return "bg-gray-600"
		}
	}

	// URL opening handler
	const handleOpenUrl = () => {
		const urlToOpen = item.sourceUrl && isValidUrl(item.sourceUrl) ? item.sourceUrl : item.repoUrl
		vscode.postMessage({
			type: "openExternal",
			url: urlToOpen,
		})
	}

	// Group items by type
	const groupedItems = useMemo(() => {
		if (!item.items?.length) {
			return null
		}
		return groupItemsByType(item.items)
	}, [item.items]) as GroupedItems | null

	return (
		<div className="border border-vscode-panel-border rounded-md p-4 bg-vscode-panel-background">
			{/* Header section with name, author, and type badge */}
			<div className="flex justify-between items-start">
				<div>
					<h3 className="text-lg font-semibold text-vscode-foreground">{item.name}</h3>
					{item.author && <p className="text-sm text-vscode-descriptionForeground">{`by ${item.author}`}</p>}
				</div>
				<span className={`px-2 py-1 text-xs text-white rounded-full ${getTypeColor(item.type)}`}>
					{getTypeLabel(item.type)}
				</span>
			</div>

			{/* Description */}
			<p className="my-2 text-vscode-foreground">{item.description}</p>

			{/* Tags section */}
			{item.tags && item.tags.length > 0 && (
				<div className="flex flex-wrap gap-1 my-2">
					{item.tags.map((tag) => (
						<button
							key={tag}
							className={`px-2 py-1 text-xs rounded-full hover:bg-vscode-button-secondaryBackground ${
								filters.tags.includes(tag)
									? "bg-vscode-button-background text-vscode-button-foreground"
									: "bg-vscode-badge-background text-vscode-badge-foreground"
							}`}
							onClick={() => {
								if (filters.tags.includes(tag)) {
									setFilters({
										...filters,
										tags: filters.tags.filter((t) => t !== tag),
									})
								} else {
									setFilters({
										...filters,
										tags: [...filters.tags, tag],
									})
									if (activeTab !== "browse") {
										setActiveTab("browse")
									}
								}
							}}
							title={filters.tags.includes(tag) ? `Remove tag filter: ${tag}` : `Filter by tag: ${tag}`}>
							{tag}
						</button>
					))}
				</div>
			)}

			{/* Footer section with metadata and action button */}
			<div className="flex justify-between items-center mt-4">
				<div className="flex items-center gap-4 text-sm text-vscode-descriptionForeground">
					{item.version && (
						<span className="flex items-center">
							<span className="codicon codicon-tag mr-1"></span>
							{item.version}
						</span>
					)}
					{item.lastUpdated && (
						<span className="flex items-center">
							<span className="codicon codicon-calendar mr-1"></span>
							{new Date(item.lastUpdated).toLocaleDateString(undefined, {
								year: "numeric",
								month: "short",
								day: "numeric",
							})}
						</span>
					)}
				</div>

				<Button onClick={handleOpenUrl}>
					<span className="codicon codicon-link-external mr-2"></span>
					{item.sourceUrl ? "View" : item.sourceName || "Source"}
				</Button>
			</div>

			{/* Details section with subcomponents */}
			{groupedItems && (
				<ExpandableSection
					title="Component Details"
					badge={
						filters.search
							? (() => {
									const matchCount =
										item.items?.filter(
											(subItem) =>
												(subItem.metadata?.name || "")
													.toLowerCase()
													.includes(filters.search.toLowerCase()) ||
												(subItem.metadata?.description || "")
													.toLowerCase()
													.includes(filters.search.toLowerCase()),
										).length || 0
									return matchCount > 0
										? `${matchCount} match${matchCount !== 1 ? "es" : ""}`
										: undefined
								})()
							: undefined
					}
					defaultExpanded={
						!!filters.search &&
						(item.items?.some(
							(subItem) =>
								(subItem.metadata?.name || "").toLowerCase().includes(filters.search.toLowerCase()) ||
								(subItem.metadata?.description || "")
									.toLowerCase()
									.includes(filters.search.toLowerCase()),
						) ||
							false)
					}>
					<div className="space-y-4">
						{Object.entries(groupedItems).map(([type, group]) => (
							<TypeGroup key={type} type={type} items={group.items} searchTerm={filters.search} />
						))}
					</div>
				</ExpandableSection>
			)}
		</div>
	)
}
```

### Design Considerations

1. **Visual Hierarchy**:

    - Clear distinction between header, content, and footer
    - Type badge stands out with color coding
    - Important information is emphasized with typography

2. **Interactive Elements**:

    - Tags are clickable for filtering
    - External link button for source access
    - Expandable details section for subcomponents

3. **Information Density**:

    - Balanced display of essential information
    - Optional elements only shown when available
    - Expandable section for additional details

4. **VSCode Integration**:
    - Uses VSCode theme variables for colors
    - Matches VSCode UI patterns
    - Integrates with VSCode messaging system

## ExpandableSection

The ExpandableSection component provides a collapsible container for content that doesn't need to be visible at all times.

### Component Structure

```tsx
export const ExpandableSection: React.FC<ExpandableSectionProps> = ({
	title,
	children,
	className,
	defaultExpanded = false,
	badge,
}) => {
	const [isExpanded, setIsExpanded] = useState(defaultExpanded)

	return (
		<div className={cn("border-t border-vscode-panel-border mt-4", className)}>
			<button
				className="w-full flex items-center justify-between py-2 text-sm text-vscode-foreground hover:text-vscode-textLink"
				onClick={() => setIsExpanded(!isExpanded)}
				aria-expanded={isExpanded}
				aria-controls="details-content">
				<span className="font-medium flex items-center">
					<span className="codicon codicon-list-unordered mr-1"></span>
					{title}
				</span>
				<div className="flex items-center">
					{badge && (
						<span className="mr-2 text-xs bg-vscode-badge-background text-vscode-badge-foreground px-1 py-0.5 rounded">
							{badge}
						</span>
					)}
					<span
						className={cn(
							"codicon",
							isExpanded ? "codicon-chevron-down" : "codicon-chevron-right",
							"transition-transform duration-200",
						)}
					/>
				</div>
			</button>
			<div
				id="details-content"
				className={cn(
					"overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out",
					isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0",
				)}
				role="region"
				aria-labelledby="details-button">
				<div className="py-2 px-1 bg-vscode-panel-background rounded-sm">{children}</div>
			</div>
		</div>
	)
}
```

### Design Considerations

1. **Animation**:

    - Smooth height transition for expand/collapse
    - Opacity change for better visual feedback
    - Chevron icon rotation for state indication

2. **Accessibility**:

    - Proper ARIA attributes for screen readers
    - Keyboard navigation support
    - Clear visual indication of interactive state

3. **Flexibility**:

    - Accepts any content as children
    - Optional badge for additional information
    - Customizable through className prop

4. **State Management**:
    - Internal state for expanded/collapsed
    - Can be controlled through defaultExpanded prop
    - Preserves state during component lifecycle

## TypeGroup

The TypeGroup component displays a collection of items of the same type, with special handling for search matches.

### Component Structure

```tsx
export const TypeGroup: React.FC<TypeGroupProps> = ({ type, items, className, searchTerm }) => {
	const getTypeLabel = (type: string) => {
		switch (type) {
			case "mode":
				return "Modes"
			case "mcp server":
				return "MCP Servers"
			case "prompt":
				return "Prompts"
			case "package":
				return "Packages"
			default:
				return `${type.charAt(0).toUpperCase()}${type.slice(1)}s`
		}
	}

	if (!items?.length) {
		return null
	}

	// Check if an item matches the search term
	const itemMatchesSearch = (item: { name: string; description?: string }) => {
		if (!searchTerm) return false
		const term = searchTerm.toLowerCase()
		return item.name.toLowerCase().includes(term) || (item.description || "").toLowerCase().includes(term)
	}

	return (
		<div className={cn("mb-4", className)}>
			<h4 className="text-sm font-medium text-vscode-foreground mb-2">{getTypeLabel(type)}</h4>
			<ol className="list-decimal list-inside space-y-1">
				{items.map((item, index) => {
					const matches = itemMatchesSearch(item)
					return (
						<li
							key={`${item.path || index}`}
							className={cn(
								"text-sm pl-1",
								matches ? "text-vscode-foreground font-medium" : "text-vscode-foreground",
							)}
							title={item.path}>
							<span className={cn("font-medium", matches ? "text-vscode-textLink" : "")}>
								{item.name}
							</span>
							{item.description && (
								<span className="text-vscode-descriptionForeground"> - {item.description}</span>
							)}
							{matches && (
								<span className="ml-2 text-xs bg-vscode-badge-background text-vscode-badge-foreground px-1 py-0.5 rounded">
									match
								</span>
							)}
						</li>
					)
				})}
			</ol>
		</div>
	)
}
```

### Design Considerations

1. **List Presentation**:

    - Ordered list with automatic numbering
    - Clear type heading for context
    - Consistent spacing for readability

2. **Search Match Highlighting**:

    - Visual distinction for matching items
    - "match" badge for quick identification
    - Color change for matched text

3. **Information Display**:

    - Name and description clearly separated
    - Tooltip shows path information on hover
    - Truncation for very long descriptions

4. **Empty State Handling**:
    - Returns null when no items are present
    - Avoids rendering empty containers
    - Prevents unnecessary UI elements

## Source Configuration Components

The Marketplace includes components for managing package sources.

### SourcesView

```tsx
const SourcesView: React.FC<SourcesViewProps> = ({ sources, refreshingUrls, onRefreshSource, onSourcesChange }) => {
	const [newSourceUrl, setNewSourceUrl] = useState("")
	const [newSourceName, setNewSourceName] = useState("")
	const [error, setError] = useState("")

	const handleAddSource = () => {
		// Validate source URL and name
		const errors = [
			...validateSourceUrl(newSourceUrl),
			...validateSourceName(newSourceName),
			...validateSourceDuplicates(sources, {
				url: newSourceUrl,
				name: newSourceName,
				enabled: true,
			}),
		]

		if (errors.length > 0) {
			setError(errors[0].message)
			return
		}

		// Add new source
		onSourcesChange([
			...sources,
			{
				url: newSourceUrl,
				name: newSourceName || undefined,
				enabled: true,
			},
		])

		// Clear form
		setNewSourceUrl("")
		setNewSourceName("")
		setError("")
	}

	return (
		<div>
			<h4>Configure Marketplace Sources</h4>
			<p>Add Git repositories containing marketplace items.</p>

			{/* Source form */}
			<div>
				<input
					type="text"
					placeholder="Git repository URL"
					value={newSourceUrl}
					onChange={(e) => setNewSourceUrl(e.target.value)}
				/>
				<input
					type="text"
					placeholder="Display name (optional)"
					value={newSourceName}
					onChange={(e) => setNewSourceName(e.target.value)}
				/>
				{error && <p className="text-red-500">{error}</p>}
				<Button onClick={handleAddSource}>Add Source</Button>
			</div>

			{/* Source list */}
			<div>
				{sources.map((source) => (
					<SourceItem
						key={source.url}
						source={source}
						isRefreshing={refreshingUrls.includes(source.url)}
						onRefresh={() => onRefreshSource(source.url)}
						onToggle={() => {
							const updatedSources = sources.map((s) =>
								s.url === source.url ? { ...s, enabled: !s.enabled } : s,
							)
							onSourcesChange(updatedSources)
						}}
						onRemove={() => {
							const updatedSources = sources.filter((s) => s.url !== source.url)
							onSourcesChange(updatedSources)
						}}
					/>
				))}
			</div>
		</div>
	)
}
```

## Filter Components

The Marketplace includes components for filtering and searching.

### SearchInput

```tsx
const SearchInput: React.FC<{
	value: string
	onChange: (value: string) => void
}> = ({ value, onChange }) => {
	// Debounce search input to avoid excessive filtering
	const debouncedOnChange = useDebounce(onChange, 300)

	return (
		<div className="search-container">
			<span className="codicon codicon-search"></span>
			<input
				type="text"
				value={value}
				onChange={(e) => debouncedOnChange(e.target.value)}
				placeholder="Search packages..."
				className="search-input"
				aria-label="Search packages"
			/>
			{value && (
				<button className="clear-button" onClick={() => onChange("")} aria-label="Clear search">
					<span className="codicon codicon-close"></span>
				</button>
			)}
		</div>
	)
}
```

### TypeFilterGroup

```tsx
const TypeFilterGroup: React.FC<{
	selectedType: string
	onChange: (type: string) => void
	availableTypes: string[]
}> = ({ selectedType, onChange, availableTypes }) => {
	return (
		<div className="filter-group">
			<h3 className="filter-heading">Filter by Type</h3>
			<div className="filter-options">
				<label className="filter-option">
					<input
						type="radio"
						name="type-filter"
						value=""
						checked={selectedType === ""}
						onChange={() => onChange("")}
					/>
					<span>All Types</span>
				</label>

				{availableTypes.map((type) => (
					<label key={type} className="filter-option">
						<input
							type="radio"
							name="type-filter"
							value={type}
							checked={selectedType === type}
							onChange={() => onChange(type)}
						/>
						<span>{getTypeLabel(type)}</span>
					</label>
				))}
			</div>
		</div>
	)
}
```

### TagFilterGroup

```tsx
const TagFilterGroup: React.FC<{
	selectedTags: string[]
	onChange: (tags: string[]) => void
	availableTags: string[]
}> = ({ selectedTags, onChange, availableTags }) => {
	const toggleTag = (tag: string) => {
		if (selectedTags.includes(tag)) {
			onChange(selectedTags.filter((t) => t !== tag))
		} else {
			onChange([...selectedTags, tag])
		}
	}

	return (
		<div className="filter-group">
			<h3 className="filter-heading">Filter by Tags</h3>
			<div className="tag-cloud">
				{availableTags.map((tag) => (
					<button
						key={tag}
						className={`tag ${selectedTags.includes(tag) ? "selected" : ""}`}
						onClick={() => toggleTag(tag)}
						aria-pressed={selectedTags.includes(tag)}>
						{tag}
					</button>
				))}
			</div>
		</div>
	)
}
```

## Styling Approach

The Marketplace UI uses a combination of Tailwind CSS and VSCode theme variables for styling.

### VSCode Theme Integration

The components use VSCode theme variables to ensure they match the user's selected theme:

```css
/* Example of VSCode theme variable usage */
.package-card {
	background-color: var(--vscode-panel-background);
	border-color: var(--vscode-panel-border);
	color: var(--vscode-foreground);
}

.package-description {
	color: var(--vscode-descriptionForeground);
}

.package-link {
	color: var(--vscode-textLink-foreground);
}

.package-link:hover {
	color: var(--vscode-textLink-activeForeground);
}
```

### Tailwind CSS Usage

Tailwind CSS is used for utility-based styling:

```tsx
// Example of Tailwind CSS usage
<div className="flex justify-between items-center p-4 border rounded-md">
	<h3 className="text-lg font-semibold">{item.name}</h3>
	<span className="px-2 py-1 text-xs text-white rounded-full bg-blue-600">{getTypeLabel(item.type)}</span>
</div>
```

### Custom Utility Functions

The UI uses utility functions for class name composition:

```typescript
// cn utility for conditional class names
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}
```

## Responsive Design

The Marketplace UI is designed to work across different viewport sizes:

### Layout Adjustments

```tsx
// Example of responsive layout
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
	{items.map((item) => (
		<PackageManagerItemCard key={item.name} item={item} />
	))}
</div>
```

### Mobile Considerations

For smaller screens:

1. **Stacked Layout**:

    - Cards stack vertically on small screens
    - Filter panel collapses to a dropdown
    - Full-width elements for better touch targets

2. **Touch Optimization**:

    - Larger touch targets for mobile users
    - Swipe gestures for common actions
    - Simplified interactions for touch devices

3. **Content Prioritization**:
    - Critical information shown first
    - Less important details hidden behind expandable sections
    - Reduced information density on small screens

## Accessibility Features

The Marketplace UI includes several accessibility features:

### Keyboard Navigation

```tsx
// Example of keyboard navigation support
<button
	className="filter-button"
	onClick={handleClick}
	onKeyDown={(e) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault()
			handleClick()
		}
	}}
	tabIndex={0}
	role="checkbox"
	aria-checked={isSelected}>
	{label}
</button>
```

### Screen Reader Support

```tsx
// Example of screen reader support
<div role="region" aria-label="Package details" aria-expanded={isExpanded}>
	<button aria-controls="details-content" aria-expanded={isExpanded} onClick={toggleExpanded}>
		{isExpanded ? "Hide details" : "Show details"}
	</button>
	<div id="details-content" hidden={!isExpanded}>
		{/* Details content */}
	</div>
</div>
```

### Focus Management

```tsx
// Example of focus management
const buttonRef = useRef<HTMLButtonElement>(null)

useEffect(() => {
	if (isOpen && buttonRef.current) {
		buttonRef.current.focus()
	}
}, [isOpen])

return (
	<button ref={buttonRef} className="focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
		{label}
	</button>
)
```

### Color Contrast

The UI ensures sufficient color contrast for all text:

- Text uses VSCode theme variables that maintain proper contrast
- Interactive elements have clear focus states
- Color is not the only means of conveying information

## Animation and Transitions

The Marketplace UI uses subtle animations to enhance the user experience:

### Expand/Collapse Animation

```tsx
// Example of expand/collapse animation
<div
	className={cn(
		"overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out",
		isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0",
	)}>
	{children}
</div>
```

### Hover Effects

```tsx
// Example of hover effects
<button className="px-2 py-1 rounded-md transition-colors duration-150 hover:bg-vscode-button-hoverBackground">
	{label}
</button>
```

### Loading States

```tsx
// Example of loading state animation
<div className="loading-indicator">
	<div className="spinner animate-spin h-5 w-5 border-2 border-t-transparent rounded-full"></div>
	<span>Loading packages...</span>
</div>
```

## Error Handling in UI

The Marketplace UI includes graceful error handling:

### Error States

```tsx
// Example of error state display
const ErrorDisplay: React.FC<{ error: string; retry: () => void }> = ({ error, retry }) => {
	return (
		<div className="error-container p-4 border border-red-500 rounded-md bg-red-50 text-red-700">
			<div className="flex items-center">
				<span className="codicon codicon-error mr-2"></span>
				<h3 className="font-medium">Error loading packages</h3>
			</div>
			<p className="mt-2 mb-4">{error}</p>
			<button className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700" onClick={retry}>
				Retry
			</button>
		</div>
	)
}
```

### Empty States

```tsx
// Example of empty state display
const EmptyState: React.FC<{ message: string }> = ({ message }) => {
	return (
		<div className="empty-state p-8 text-center text-vscode-descriptionForeground">
			<div className="codicon codicon-info text-4xl mb-2"></div>
			<p>{message}</p>
		</div>
	)
}
```

### Loading States

```tsx
// Example of loading state with skeleton
const PackageCardSkeleton: React.FC = () => {
	return (
		<div className="border border-vscode-panel-border rounded-md p-4 bg-vscode-panel-background animate-pulse">
			<div className="flex justify-between items-start">
				<div className="w-2/3">
					<div className="h-6 bg-vscode-panel-border rounded"></div>
					<div className="h-4 w-1/3 bg-vscode-panel-border rounded mt-2"></div>
				</div>
				<div className="h-6 w-16 bg-vscode-panel-border rounded-full"></div>
			</div>
			<div className="h-4 bg-vscode-panel-border rounded mt-4"></div>
			<div className="h-4 bg-vscode-panel-border rounded mt-2 w-5/6"></div>
			<div className="flex gap-2 mt-4">
				<div className="h-6 w-16 bg-vscode-panel-border rounded-full"></div>
				<div className="h-6 w-16 bg-vscode-panel-border rounded-full"></div>
			</div>
		</div>
	)
}
```

## Component Testing

The Marketplace UI components include comprehensive tests:

### Unit Tests

```typescript
// Example of component unit test
describe("PackageManagerItemCard", () => {
  const mockItem: PackageManagerItem = {
    name: "Test Package",
    description: "A test package",
    type: "package",
    url: "https://example.com",
    repoUrl: "https://github.com/example/repo",
    tags: ["test", "example"],
    version: "1.0.0",
    lastUpdated: "2025-04-01"
  };

  const mockFilters = { type: "", search: "", tags: [] };
  const mockSetFilters = jest.fn();
  const mockSetActiveTab = jest.fn();

  it("renders correctly", () => {
    render(
      <PackageManagerItemCard
        item={mockItem}
        filters={mockFilters}
        setFilters={mockSetFilters}
        activeTab="browse"
        setActiveTab={mockSetActiveTab}
      />
    );

    expect(screen.getByText("Test Package")).toBeInTheDocument();
    expect(screen.getByText("A test package")).toBeInTheDocument();
    expect(screen.getByText("Package")).toBeInTheDocument();
  });

  it("handles tag clicks", () => {
    render(
      <PackageManagerItemCard
        item={mockItem}
        filters={mockFilters}
        setFilters={mockSetFilters}
        activeTab="browse"
        setActiveTab={mockSetActiveTab}
      />
    );

    fireEvent.click(screen.getByText("test"));

    expect(mockSetFilters).toHaveBeenCalledWith({
      type: "",
      search: "",
      tags: ["test"]
    });
  });
});
```

### Snapshot Tests

```typescript
// Example of snapshot test
it("matches snapshot", () => {
  const { container } = render(
    <PackageManagerItemCard
      item={mockItem}
      filters={mockFilters}
      setFilters={mockSetFilters}
      activeTab="browse"
      setActiveTab={mockSetActiveTab}
    />
  );

  expect(container).toMatchSnapshot();
});
```

### Accessibility Tests

```typescript
// Example of accessibility test
it("meets accessibility requirements", async () => {
  const { container } = render(
    <PackageManagerItemCard
      item={mockItem}
      filters={mockFilters}
      setFilters={mockSetFilters}
      activeTab="browse"
      setActiveTab={mockSetActiveTab}
    />
  );

  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

---

**Previous**: [Search and Filter Implementation](./04-search-and-filter.md) | **Next**: [Testing Strategy](./06-testing-strategy.md)
