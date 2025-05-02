# Searching and Filtering

The Marketplace provides powerful search and filtering capabilities to help you quickly find the components you need. This guide explains how to effectively use these features to narrow down your search results.

## Using the Search Functionality

The search box allows you to find components by matching text in various fields:

### What Gets Searched

When you enter a search term, the Marketplace looks for matches in:

1. **Item Name**: The primary identifier of the item
2. **Description**: The detailed explanation of the item's purpose
3. **Subcomponent Names and Descriptions**: Text within nested items

### Search Features

- **Case Insensitive**: Searches ignore letter case for easier matching
- **Whitespace Insensitive**: Extra spaces are normalized in the search
- **Partial Matching**: Finds results that contain your search term anywhere in the text
- **Instant Results**: Results update as you type
- **Match Highlighting**: Matching subcomponents are highlighted and expanded automatically

### Search Implementation

The search uses a simple string contains match that is case and whitespace insensitive. This means:

- "Data" will match "data", "DATA", "Data", etc.
- "machine learning" will match "Machine Learning", "machine-learning", etc.
- Partial words will match: "valid" will match "validation", "validator", etc.

### Search Tips

- Use specific, distinctive terms to narrow results
- Try different variations if you don't find what you're looking for
- Search for technology names or specific functionality
- Look for highlighted "match" indicators in expanded details sections

### Example Searches

| Search Term        | Will Find                                                                   |
| ------------------ | --------------------------------------------------------------------------- |
| "data"             | Items with "data" in their name, description, or subcomponents              |
| "validator"        | Items that include validation functionality or have validator subcomponents |
| "machine learning" | Items related to machine learning technology                                |

## Filtering by Item Type

The type filter allows you to focus on specific categories of items:

### Available Type Filters

- **Mode**: AI assistant personalities with specialized capabilities
- **MCP Server**: Model Context Protocol servers that provide additional functionality
- **Package**: Collections of related items
- **Prompt**: Pre-configured instructions for specific tasks

### Using Type Filters

1. Click on a type checkbox to show only items of that type
2. Select multiple types to show items that match any of the selected types
3. Clear all type filters to show all items again

When filtering by type, packages are handled specially:

- A package will be included if it matches the selected type
- A package will also be included if it contains any subcomponents matching the selected type
- When viewing a package that was included due to its subcomponents, the matching subcomponents will be highlighted

### Type Filter Behavior

- Type filters apply to both the primary item type and it's subcomponents
- Packages are included if they contain subcomponents matching the selected type
- The type is displayed as a badge on each item card
- Type filtering can be combined with search terms and tag filters

## Using Tags for Filtering

Tags provide a way to filter items by category, technology, or purpose:

### Tag Functionality

- Tags appear as clickable buttons on item cards
- Clicking a tag activates it as a filter
- Active tag filters are highlighted
- Items must have at least one of the selected tags to be displayed

### Finding and Using Tags

1. Browse through item cards to discover available tags
2. Click on a tag to filter for items with that tag
3. Click on additional tags to expand your filter (items with any of the selected tags will be shown)
4. Click on an active tag to deactivate it

### Common Tags

- Technology areas: "data", "web", "security", "ai"
- Programming languages: "python", "javascript", "typescript"
- Functionality: "testing", "documentation", "analysis"
- Domains: "finance", "healthcare", "education"

## Combining Search and Filters

For the most precise results, you can combine search terms, type filters, and tag filters:

### How Combined Filtering Works

1. **AND Logic Between Filter Types**: Items must match the search term AND the selected types AND have at least one of the selected tags
2. **OR Logic Within Tag Filters**: Items must have at least one of the selected tags

### Combined Filter Examples

| Search Term     | Type Filter | Tag Filter              | Will Find                                            |
| --------------- | ----------- | ----------------------- | ---------------------------------------------------- |
| "data"          | MCP Server  | "analytics"             | MCP Servers related to data analytics                |
| "test"          | Mode        | "automation", "quality" | Test automation or quality-focused modes             |
| "visualization" | Package     | "dashboard", "chart"    | Packages for creating dashboards or charts           |
| ""              | Mode        | ""                      | All modes and packages containing mode subcomponents |

### Clearing Filters

To reset your search and start over:

1. Clear the search box
2. Uncheck all type filters
3. Deactivate all tag filters by clicking on them

### Filter Status Indicators

The Marketplace provides visual feedback about your current filters:

- Active type filters are checked
- Active tag filters are highlighted
- The search box shows your current search term
- Result counts may be displayed to show how many items match your filters

---

**Previous**: [Browsing Items](./02-browsing-items.md) | **Next**: [Working with Package Details](./04-working-with-details.md)
