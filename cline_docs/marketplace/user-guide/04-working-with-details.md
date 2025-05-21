# Working with Package Details

Marketplace items often contain multiple items organized in a hierarchical structure; these items are referred to as "Packages" and must have a type of `package`. The items organized within a package are referred to as "subitems" and have all the same metadata properties of regular items. This guide explains how to work with the details section of package cards to explore and understand the elements within each package.

## Expanding Package Details

Most packages in the Marketplace contain subcomponents that are hidden by default to keep the interface clean. You can expand these details to see what's inside each package:

### How to Expand Details

1. Look for the "Component Details" section at the bottom of a package card
2. Click on the section header or the chevron icon (▶) to expand it
3. The section will animate open, revealing the components inside the package
4. Click again to collapse the section when you're done

### Automatic Expansion

The details section will expand automatically when:

- Your search term matches text in a subcomponent
- This is the only condition for automatic expansion

### Details Section Badge

The details section may display a badge with additional information:

- **Match count**: When your search term matches subcomponents, a badge shows how many matches were found (e.g., "3 matches")
- This helps you quickly identify which packages contain relevant subcomponents

## Understanding Component Types

Components within packages are grouped by their type to make them easier to find and understand:

### Common Component Types

1. **Modes**

    - AI assistant personalities with specialized capabilities
    - Examples: Code Mode, Architect Mode, Debug Mode

2. **MCP Servers**

    - Model Context Protocol servers that provide additional functionality
    - Examples: File Analyzer, Data Validator, Image Generator

3. **Prompts**

    - Pre-configured instructions for specific tasks
    - Examples: Code Review, Documentation Generator, Test Case Creator

4. **Packages**
    - Nested collections of related components
    - Can contain any of the other component types

### Type Presentation

Each type section in the details view includes:

- A header with the type name (pluralized, e.g., "MCP Servers")
- A numbered list of components of that type
- Each component's name and description

## Viewing Subcomponents

The details section organizes subcomponents in a clear, structured format:

### Subcomponent List Format

```
Component Details
  Type Name:
  1. Component Name - Description text goes here
  2. Another Component - Its description

  Another Type:
  1. First Component - Description
  2. Second Component - Description
```

### Subcomponent Information

Each subcomponent in the list displays:

1. **Number**: Sequential number within its type group
2. **Name**: The name of the subcomponent
3. **Description**: A brief explanation of the subcomponent's purpose (if available)
4. **Match Indicator**: A "match" badge appears next to items that match your search term

### Navigating Subcomponents

- Scroll within the details section to see all subcomponents
- Components are grouped by type, making it easier to find specific functionality
- Long descriptions may be truncated with an ellipsis (...) to save space (limited to 100 characters)

## Matching Search Terms in Subcomponents

One of the most powerful features of the Marketplace is the ability to search within subcomponents:

### How Subcomponent Matching Works

1. Enter a search term in the search box
2. The Marketplace searches through all subcomponent names and descriptions
3. Packages with matching subcomponents remain visible in the results
4. The details section automatically expands for packages with matches
5. Matching subcomponents are highlighted and marked with a "match" badge

### Visual Indicators for Matches

When a subcomponent matches your search:

- The component name is highlighted in a different color
- A "match" badge appears next to the component
- The details section automatically expands
- A badge on the details section header shows the number of matches

### Search Implementation

The search uses a simple string contains match that is case-insensitive:

- "validator" will match "Data Validator", "Validator Tool", etc.
- "valid" will match "validation" or "validator"
- validator will not match "validation"
- The search will match any part of the name or description that contains the exact search term

### Example Scenario

If you search for "validator":

1. Packages containing components with "validator" in their name or description remain visible
2. The details section expands automatically for packages with matching subcomponents
3. Components like "Data Validator" or those with "validator" in their description are highlighted
4. A badge might show "2 matches" if two subcomponents match your search term

### Benefits of Subcomponent Matching

- Find functionality buried deep within packages
- Discover relationships between components
- Identify packages that contain specific tools or capabilities
- Locate similar components across different packages

---

**Previous**: [Searching and Filtering](./03-searching-and-filtering.md) | **Next**: [Adding Packages](./05-adding-packages.md)
