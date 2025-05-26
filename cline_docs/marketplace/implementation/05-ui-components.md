# UI Component Design

This document details the design and implementation of the Marketplace's UI components, including their structure, styling, interactions, and accessibility features.

## MarketplaceView

The MarketplaceView is the main container component that manages the overall marketplace interface.

### Component Structure

[/webview-ui/src/components/marketplace/MarketplaceView.tsx](/webview-ui/src/components/marketplace/MarketplaceView.tsx)

### State Management Integration

The component uses the MarketplaceViewStateManager through the useStateManager hook:

```tsx
const [state, manager] = useStateManager()
```

Key features:

- Manages tab state (browse/sources)
- Handles source configuration
- Coordinates filtering and sorting
- Manages loading states
- Handles source validation

## MarketplaceItemCard

The MarketplaceItemCard is the primary component for displaying item information in the UI.

### Component Structure

[/webview-ui/src/components/marketplace/components/MarketplaceItemCard.tsx](/webview-ui/src/components/marketplace/components/MarketplaceItemCard.tsx)

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

[/webview-ui/src/components/marketplace/components/ExpandableSection.tsx](/webview-ui/src/components/marketplace/components/ExpandableSection.tsx)

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

[/webview-ui/src/components/marketplace/components/TypeGroup.tsx](/webview-ui/src/components/marketplace/components/TypeGroup.tsx)

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

The Marketplace includes components for managing item sources.

[/webview-ui/src/components/marketplace/MarketplaceView.tsx](/webview-ui/src/components/marketplace/MarketplaceView.tsx)

## Filter Components

The Marketplace includes components for filtering and searching.

[/webview-ui/src/components/marketplace/MarketplaceView.tsx](/webview-ui/src/components/marketplace/MarketplaceView.tsx)

### TypeFilterGroup

[/webview-ui/src/components/marketplace/MarketplaceView.tsx](/webview-ui/src/components/marketplace/MarketplaceView.tsx)

### TagFilterGroup

[/webview-ui/src/components/marketplace/MarketplaceView.tsx](/webview-ui/src/components/marketplace/MarketplaceView.tsx)

## Styling Approach

The Marketplace UI uses a combination of Tailwind CSS and VSCode theme variables for styling.

## Responsive Design

The Marketplace UI is designed to work across different viewport sizes:

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
<div role="region" aria-label="Item details" aria-expanded={isExpanded}>
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
	<span>Loading items...</span>
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
				<h3 className="font-medium">Error loading items</h3>
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

## Component Testing

The Marketplace UI components include comprehensive tests:

### Unit Tests

```typescript
// Example of component unit test
describe("MarketplaceItemCard", () => {
  const mockItem: MarketplaceItem = {
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
      <MarketplaceItemCard
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
      <MarketplaceItemCard
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
    <MarketplaceItemCard
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
    <MarketplaceItemCard
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
