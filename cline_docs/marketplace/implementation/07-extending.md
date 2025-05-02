# Extending the Marketplace

This document provides guidance on extending the Marketplace with new features, component types, and customizations.

## Adding New Component Types

The Marketplace is designed to be extensible, allowing for the addition of new component types beyond the default ones (mode, mcp, prompt, package).

### Extending the MarketplaceItemType

To add a new component type:

1. **Update the MarketplaceItemType Type**:

```typescript
/**
 * Supported component types
 */
export type MarketplaceItemType = "mode" | "prompt" | "package" | "mcp" | "your-new-type"
```

2. **Update Type Label Functions**:

```typescript
const getTypeLabel = (type: string) => {
	switch (type) {
		case "mode":
			return "Mode"
		case "mcp":
			return "MCP Server"
		case "prompt":
			return "Prompt"
		case "package":
			return "Package"
		case "your-new-type":
			return "Your New Type"
		default:
			return "Other"
	}
}
```

3. **Update Type Color Functions**:

```typescript
const getTypeColor = (type: string) => {
	switch (type) {
		case "mode":
			return "bg-blue-600"
		case "mcp":
			return "bg-green-600"
		case "prompt":
			return "bg-purple-600"
		case "package":
			return "bg-orange-600"
		case "your-new-type":
			return "bg-yellow-600" // Choose a distinctive color
		default:
			return "bg-gray-600"
	}
}
```

4. **Update Type Group Labels**:

```typescript
const getTypeGroupLabel = (type: string) => {
	switch (type) {
		case "mode":
			return "Modes"
		case "mcp":
			return "MCP Servers"
		case "prompt":
			return "Prompts"
		case "package":
			return "Packages"
		case "your-new-type":
			return "Your New Types"
		default:
			return `${type.charAt(0).toUpperCase()}${type.slice(1)}s`
	}
}
```

### Directory Structure for New Types

When adding a new component type, follow this directory structure in your source repository:

```
repository-root/
├── metadata.en.yml
├── your-new-type/           # Directory for your new component type
│   ├── component-1/
│   │   └── metadata.en.yml
│   └── component-2/
│       └── metadata.en.yml
└── ...
```

### Metadata for New Types

The metadata for your new component type should follow the standard format:

```yaml
name: "Your Component Name"
description: "Description of your component"
version: "1.0.0"
type: "your-new-type"
tags:
    - relevant-tag-1
    - relevant-tag-2
```

### UI Considerations for New Types

When adding a new component type, consider these UI aspects:

1. **Type Filtering**:

    - Add your new type to the type filter options
    - Ensure proper labeling and styling

2. **Type-Specific Rendering**:

    - Consider if your type needs special rendering in the UI
    - Add any type-specific UI components or styles

3. **Type Icons**:
    - Choose an appropriate icon for your type
    - Add it to the icon mapping

```typescript
const getTypeIcon = (type: string) => {
	switch (type) {
		case "mode":
			return "codicon-person"
		case "mcp":
			return "codicon-server"
		case "prompt":
			return "codicon-comment"
		case "package":
			return "codicon-package"
		case "your-new-type":
			return "codicon-your-icon" // Choose an appropriate icon
		default:
			return "codicon-symbol-misc"
	}
}
```

## Creating Custom Templates

You can create custom templates to provide a starting point for users creating new components.

### Template Structure

A custom template should follow this structure:

```
custom-template/
├── metadata.en.yml
├── README.md
└── [component-specific files]
```

### Template Metadata

The template metadata should include:

```yaml
name: "Your Template Name"
description: "Description of your template"
version: "1.0.0"
type: "your-component-type"
template: true
templateFor: "your-component-type"
```

### Template Registration

Register your template with the Marketplace:

```typescript
// In your extension code
const registerTemplates = (context: vscode.ExtensionContext) => {
	const templatePath = path.join(context.extensionPath, "templates", "your-template")
	marketplace.registerTemplate(templatePath)
}
```

### Template Usage

Users can create new components from your template:

```typescript
// In the UI
const createFromTemplate = (templateName: string) => {
	vscode.postMessage({
		type: "createFromTemplate",
		templateName,
	})
}
```

## Implementing New Features

The Marketplace is designed to be extended with new features. Here's how to implement common types of features:

### Adding a New Filter Type

To add a new filter type (beyond type, search, and tags):

1. **Update the Filters Interface**:

```typescript
interface Filters {
	type: string
	search: string
	tags: string[]
	yourNewFilter: string // Add your new filter
}
```

2. **Update the Filter Function**:

```typescript
export function filterItems(
	items: MarketplaceItem[],
	filters: {
		type?: string
		search?: string
		tags?: string[]
		yourNewFilter?: string // Add your new filter
	},
): MarketplaceItem[] {
	// Existing filter logic...

	// Add your new filter logic
	if (filters.yourNewFilter) {
		result = result.filter((item) => {
			// Your filter implementation
			return yourFilterLogic(item, filters.yourNewFilter)
		})
	}

	return result
}
```

3. **Add UI Controls**:

```tsx
const YourNewFilterControl: React.FC<{
	value: string
	onChange: (value: string) => void
}> = ({ value, onChange }) => {
	return (
		<div className="filter-group">
			<h3 className="filter-heading">Your New Filter</h3>
			{/* Your filter UI controls */}
		</div>
	)
}
```

4. **Integrate with the Main UI**:

```tsx
<FilterPanel>
	<TypeFilterGroup selectedType={filters.type} onChange={handleTypeChange} availableTypes={availableTypes} />
	<SearchInput value={filters.search} onChange={handleSearchChange} />
	<TagFilterGroup selectedTags={filters.tags} onChange={handleTagsChange} availableTags={availableTags} />
	<YourNewFilterControl value={filters.yourNewFilter} onChange={handleYourNewFilterChange} />
</FilterPanel>
```

### Adding a New View Mode

To add a new view mode (beyond the card view):

1. **Add a View Mode State**:

```typescript
type ViewMode = "card" | "list" | "yourNewView"

const [viewMode, setViewMode] = useState<ViewMode>("card")
```

2. **Create the View Component**:

```tsx
const YourNewView: React.FC<{
	items: MarketplaceItem[]
	filters: Filters
	setFilters: (filters: Filters) => void
}> = ({ items, filters, setFilters }) => {
	return <div className="your-new-view">{/* Your view implementation */}</div>
}
```

3. **Add View Switching Controls**:

```tsx
const ViewModeSelector: React.FC<{
	viewMode: ViewMode
	setViewMode: (mode: ViewMode) => void
}> = ({ viewMode, setViewMode }) => {
	return (
		<div className="view-mode-selector">
			<button
				className={`view-mode-button ${viewMode === "card" ? "active" : ""}`}
				onClick={() => setViewMode("card")}
				aria-pressed={viewMode === "card"}
				title="Card View">
				<span className="codicon codicon-preview"></span>
			</button>
			<button
				className={`view-mode-button ${viewMode === "list" ? "active" : ""}`}
				onClick={() => setViewMode("list")}
				aria-pressed={viewMode === "list"}
				title="List View">
				<span className="codicon codicon-list-flat"></span>
			</button>
			<button
				className={`view-mode-button ${viewMode === "yourNewView" ? "active" : ""}`}
				onClick={() => setViewMode("yourNewView")}
				aria-pressed={viewMode === "yourNewView"}
				title="Your New View">
				<span className="codicon codicon-your-icon"></span>
			</button>
		</div>
	)
}
```

4. **Integrate with the Main UI**:

```tsx
<div className="marketplace-container">
	<div className="toolbar">
		<ViewModeSelector viewMode={viewMode} setViewMode={setViewMode} />
		{/* Other toolbar items */}
	</div>

	<div className="content">
		{viewMode === "card" && <CardView items={items} filters={filters} setFilters={setFilters} />}
		{viewMode === "list" && <ListView items={items} filters={filters} setFilters={setFilters} />}
		{viewMode === "yourNewView" && <YourNewView items={items} filters={filters} setFilters={setFilters} />}
	</div>
</div>
```

### Adding Custom Actions

To add custom actions for package items:

1. **Create an Action Handler**:

```typescript
const handleCustomAction = (item: MarketplaceItem) => {
	vscode.postMessage({
		type: "customAction",
		item: item.name,
		itemType: item.type,
	})
}
```

2. **Add Action Button to the UI**:

```tsx
<Button onClick={() => handleCustomAction(item)} className="custom-action-button">
	<span className="codicon codicon-your-icon mr-2"></span>
	Your Custom Action
</Button>
```

3. **Handle the Action in the Message Handler**:

```typescript
case "customAction":
  // Handle the custom action
  const { item, itemType } = message;
  // Your custom action implementation
  return {
    type: "customActionResult",
    success: true,
    data: { /* result data */ }
  };
```

## Customizing the UI

The Marketplace UI can be customized in several ways:

### Custom Styling

To customize the styling:

1. **Add Custom CSS Variables**:

```css
/* In your CSS file */
:root {
	--package-card-bg: var(--vscode-panel-background);
	--package-card-border: var(--vscode-panel-border);
	--package-card-hover: var(--vscode-list-hoverBackground);
	--your-custom-variable: #your-color;
}
```

2. **Use Custom Classes**:

```tsx
<div className="your-custom-component">
	<div className="your-custom-header">{/* Your custom UI */}</div>
</div>
```

3. **Add Custom Themes**:

```typescript
type Theme = "default" | "compact" | "detailed" | "yourCustomTheme"

const [theme, setTheme] = useState<Theme>("default")

// Theme-specific styles
const getThemeClasses = (theme: Theme) => {
	switch (theme) {
		case "compact":
			return "compact-theme"
		case "detailed":
			return "detailed-theme"
		case "yourCustomTheme":
			return "your-custom-theme"
		default:
			return "default-theme"
	}
}
```

### Custom Components

To replace or extend existing components:

1. **Create a Custom Component**:

```tsx
const CustomPackageCard: React.FC<MarketplaceItemCardProps> = (props) => {
	// Your custom implementation
	return (
		<div className="custom-package-card">
			{/* Your custom UI */}
			<h3>{props.item.name}</h3>
			{/* Additional custom elements */}
			<div className="custom-footer">{/* Custom footer content */}</div>
		</div>
	)
}
```

2. **Use Component Injection**:

```tsx
interface ComponentOverrides {
	PackageCard?: React.MarketplaceItemType<MarketplaceItemCardProps>
	ExpandableSection?: React.MarketplaceItemType<ExpandableSectionProps>
	TypeGroup?: React.MarketplaceItemType<TypeGroupProps>
}

const MarketplaceView: React.FC<{
	initialItems: MarketplaceItem[]
	componentOverrides?: ComponentOverrides
}> = ({ initialItems, componentOverrides = {} }) => {
	// Component selection logic
	const PackageCard = componentOverrides.PackageCard || MarketplaceItemCard

	return (
		<div className="marketplace">
			{items.map((item) => (
				<PackageCard
					key={item.name}
					item={item}
					filters={filters}
					setFilters={setFilters}
					activeTab={activeTab}
					setActiveTab={setActiveTab}
				/>
			))}
		</div>
	)
}
```

### Custom Layouts

To implement custom layouts:

1. **Create a Layout Component**:

```tsx
const CustomLayout: React.FC<{
	sidebar: React.ReactNode
	content: React.ReactNode
	footer?: React.ReactNode
}> = ({ sidebar, content, footer }) => {
	return (
		<div className="custom-layout">
			<div className="custom-sidebar">{sidebar}</div>
			<div className="custom-content">{content}</div>
			{footer && <div className="custom-footer">{footer}</div>}
		</div>
	)
}
```

2. **Use the Layout in the Main UI**:

```tsx
<CustomLayout
	sidebar={
		<FilterPanel
			filters={filters}
			setFilters={setFilters}
			availableTypes={availableTypes}
			availableTags={availableTags}
		/>
	}
	content={
		<div className="results-area">
			{filteredItems.map((item) => (
				<MarketplaceItemCard
					key={item.name}
					item={item}
					filters={filters}
					setFilters={setFilters}
					activeTab={activeTab}
					setActiveTab={setActiveTab}
				/>
			))}
		</div>
	}
	footer={<div className="status-bar">{`Showing ${filteredItems.length} of ${items.length} packages`}</div>}
/>
```

## Extending Backend Functionality

The Marketplace backend can be extended with new functionality:

### Custom Source Providers

To add support for new source types:

1. **Create a Source Provider Interface**:

```typescript
interface SourceProvider {
	type: string
	canHandle(url: string): boolean
	fetchItems(url: string): Promise<MarketplaceItem[]>
}
```

2. **Implement a Custom Provider**:

```typescript
class CustomSourceProvider implements SourceProvider {
	type = "custom"

	canHandle(url: string): boolean {
		return url.startsWith("custom://")
	}

	async fetchItems(url: string): Promise<MarketplaceItem[]> {
		// Your custom implementation
		// Fetch items from your custom source
		return items
	}
}
```

3. **Register the Provider**:

```typescript
// In your extension code
const registerSourceProviders = (marketplace: MarketplaceManager) => {
	marketplace.registerSourceProvider(new CustomSourceProvider())
}
```

### Custom Metadata Processors

To add support for custom metadata formats:

1. **Create a Metadata Processor Interface**:

```typescript
interface MetadataProcessor {
	canProcess(filePath: string): boolean
	process(filePath: string, content: string): Promise<any>
}
```

2. **Implement a Custom Processor**:

```typescript
class CustomMetadataProcessor implements MetadataProcessor {
	canProcess(filePath: string): boolean {
		return filePath.endsWith(".custom")
	}

	async process(filePath: string, content: string): Promise<any> {
		// Your custom processing logic
		return processedMetadata
	}
}
```

3. **Register the Processor**:

```typescript
// In your extension code
const registerMetadataProcessors = (metadataScanner: MetadataScanner) => {
	metadataScanner.registerProcessor(new CustomMetadataProcessor())
}
```

### Custom Message Handlers

To add support for custom messages:

1. **Extend the Message Handler**:

```typescript
// In your extension code
const extendMessageHandler = () => {
	const originalHandler = handleMarketplaceMessages

	return async (message: any, marketplace: MarketplaceManager) => {
		// Handle custom messages
		if (message.type === "yourCustomMessage") {
			// Your custom message handling
			return {
				type: "yourCustomResponse",
				data: {
					/* response data */
				},
			}
		}

		// Fall back to the original handler
		return originalHandler(message, marketplace)
	}
}
```

2. **Register the Extended Handler**:

```typescript
// In your extension code
const customMessageHandler = extendMessageHandler()
context.subscriptions.push(
	vscode.commands.registerCommand("marketplace.handleMessage", (message) => {
		return customMessageHandler(message, marketplace)
	}),
)
```

## Integration with Other Systems

The Marketplace can be integrated with other systems:

### Integration with External APIs

To integrate with external APIs:

1. **Create an API Client**:

```typescript
class ExternalApiClient {
	private baseUrl: string

	constructor(baseUrl: string) {
		this.baseUrl = baseUrl
	}

	async fetchPackages(): Promise<MarketplaceItem[]> {
		const response = await fetch(`${this.baseUrl}/packages`)
		const data = await response.json()

		// Transform API data to MarketplaceItem format
		return data.map((item) => ({
			name: item.name,
			description: item.description,
			type: item.type,
			url: item.url,
			repoUrl: item.repository_url,
			// Map other fields
		}))
	}
}
```

2. **Create a Source Provider for the API**:

```typescript
class ApiSourceProvider implements SourceProvider {
	private apiClient: ExternalApiClient

	constructor(apiUrl: string) {
		this.apiClient = new ExternalApiClient(apiUrl)
	}

	type = "api"

	canHandle(url: string): boolean {
		return url.startsWith("api://")
	}

	async fetchItems(url: string): Promise<MarketplaceItem[]> {
		return this.apiClient.fetchPackages()
	}
}
```

3. **Register the API Provider**:

```typescript
// In your extension code
const registerApiProvider = (marketplace: MarketplaceManager) => {
	marketplace.registerSourceProvider(new ApiSourceProvider("https://your-api.example.com"))
}
```

### Integration with Authentication Systems

To integrate with authentication systems:

1. **Create an Authentication Provider**:

```typescript
class AuthProvider {
	private token: string | null = null

	async login(): Promise<boolean> {
		// Your authentication logic
		this.token = "your-auth-token"
		return true
	}

	async getToken(): Promise<string | null> {
		if (!this.token) {
			await this.login()
		}
		return this.token
	}

	isAuthenticated(): boolean {
		return !!this.token
	}
}
```

2. **Use Authentication in API Requests**:

```typescript
class AuthenticatedApiClient extends ExternalApiClient {
	private authProvider: AuthProvider

	constructor(baseUrl: string, authProvider: AuthProvider) {
		super(baseUrl)
		this.authProvider = authProvider
	}

	async fetchPackages(): Promise<MarketplaceItem[]> {
		const token = await this.authProvider.getToken()

		if (!token) {
			throw new Error("Authentication required")
		}

		const response = await fetch(`${this.baseUrl}/packages`, {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		})

		// Process response as before
	}
}
```

### Integration with Local Development Tools

To integrate with local development tools:

1. **Create a Local Development Provider**:

```typescript
class LocalDevProvider {
	private workspacePath: string

	constructor(workspacePath: string) {
		this.workspacePath = workspacePath
	}

	async createLocalPackage(template: string, name: string): Promise<string> {
		const targetPath = path.join(this.workspacePath, name)

		// Create directory
		await fs.promises.mkdir(targetPath, { recursive: true })

		// Copy template files
		// Your implementation

		return targetPath
	}

	async buildLocalPackage(packagePath: string): Promise<boolean> {
		// Your build implementation
		return true
	}

	async testLocalPackage(packagePath: string): Promise<boolean> {
		// Your test implementation
		return true
	}
}
```

2. **Integrate with the Marketplace**:

```typescript
// In your extension code
const registerLocalDevTools = (context: vscode.ExtensionContext) => {
	const workspaceFolders = vscode.workspace.workspaceFolders

	if (!workspaceFolders) {
		return
	}

	const workspacePath = workspaceFolders[0].uri.fsPath
	const localDevProvider = new LocalDevProvider(workspacePath)

	// Register commands
	context.subscriptions.push(
		vscode.commands.registerCommand("marketplace.createLocal", async (template, name) => {
			return localDevProvider.createLocalPackage(template, name)
		}),

		vscode.commands.registerCommand("marketplace.buildLocal", async (packagePath) => {
			return localDevProvider.buildLocalPackage(packagePath)
		}),

		vscode.commands.registerCommand("marketplace.testLocal", async (packagePath) => {
			return localDevProvider.testLocalPackage(packagePath)
		}),
	)
}
```

## Best Practices for Extensions

When extending the Marketplace, follow these best practices:

### Maintainable Code

1. **Follow the Existing Patterns**:

    - Use similar naming conventions
    - Follow the same code structure
    - Maintain consistent error handling

2. **Document Your Extensions**:

    - Add JSDoc comments to functions and classes
    - Explain the purpose of your extensions
    - Document any configuration options

3. **Write Tests**:
    - Add unit tests for new functionality
    - Update integration tests as needed
    - Ensure test coverage remains high

### Performance Considerations

1. **Lazy Loading**:

    - Load data only when needed
    - Defer expensive operations
    - Use pagination for large datasets

2. **Efficient Data Processing**:

    - Minimize data transformations
    - Use memoization for expensive calculations
    - Batch operations when possible

3. **UI Responsiveness**:
    - Keep the UI responsive during operations
    - Show loading indicators for async operations
    - Use debouncing for frequent events

### Compatibility

1. **VSCode API Compatibility**:

    - Use stable VSCode API features
    - Handle API version differences
    - Test with multiple VSCode versions

2. **Cross-Platform Support**:

    - Test on Windows, macOS, and Linux
    - Use path.join for file paths
    - Handle file system differences

3. **Theme Compatibility**:
    - Use VSCode theme variables
    - Test with light and dark themes
    - Support high contrast mode

---

**Previous**: [Testing Strategy](./06-testing-strategy.md)
