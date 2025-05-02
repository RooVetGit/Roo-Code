# Adding Packages to the Marketplace

This guide explains how to create and contribute your own packages to the Roo Code Marketplace. By following these steps, you can share your work with the community and help expand the ecosystem.

## Package Structure and Metadata

Each package in the Marketplace requires specific metadata files and follows a consistent directory structure.

### Directory Structure

The basic structure for a package is:

```
package-name/
├── metadata.en.yml       # Required metadata file (English)
├── metadata.fr.yml       # Optional localized metadata (French)
├── README.md             # Documentation for the package
├── modes/                # Directory for mode components
│   └── my-mode/
│       └── metadata.en.yml
├── mcp/          # Directory for MCP server components
│   └── my-server/
│       └── metadata.en.yml
└── prompts/              # Directory for prompt components
    └── my-prompt/
        └── metadata.en.yml
```

### Metadata File Format

Metadata files use YAML format and must include specific fields:

```yaml
name: "My Package"
description: "A detailed description of what this package does"
version: "1.0.0"
type: "package" # One of: package, mode, mcp, prompt
tags:
    - tag1
    - tag2
items: # Only for packages AND when a subcomponent isn't located in the packages directory tree
    - type: "prompt"
      path: "../shared-prompts/data-analysis" # Reference to component outside package directory
author: "your name" # optional
authorUrl: "http://your.profile.url/" #optional
```

### Package Example in Source Tree

Here's how a package might look in the actual source tree:

```
Roo-Code-Marketplace/
├── shared-prompts/                # Shared prompts directory
│   └── data-analysis/
│       └── metadata.en.yml
│
└── packages/
    └──data-toolkit/                  # Your package directory
        ├── metadata.en.yml            # Package metadata
        ├── metadata.fr.yml            # Localized metadata
        ├── README.md                  # Documentation
        ├── modes/                     # Modes directory
        │   └── data-analyst/
        │       └── metadata.en.yml
        └── mcp/               # MCP servers directory
            └── data-processor/
                └── metadata.en.yml
```

### Required Fields

- **name**: A clear, descriptive name for your component
- **description**: A detailed explanation of what your component does
- **version**: Semantic version number (e.g., "1.0.0")
- **type**: Component type (one of: "package", "mode", "mcp", "prompt")
- **tags**: (Optional) Array of relevant tags for filtering
- **items**: (Only for `package`) Array of subcomponents with their type and path - when the path is not in the packages directory
  tree
- **author**: Your name
- **authorUrl**: A proile Url that you want people to see. GitHub profile, or linked-in profile for example
- **sourceUrl**: optional destination Url to your item's source if you haven't included it directly in the Marketplace.

### The Items Array and External References

The `items` array in a package's metadata serves only one important purposes:

**External Component References**: It allows referencing components that exist outside the package's directory tree.

Components that are within the package's directory tree are implicitly included and will be found at runtime.

#### Referencing External Components

You can reference components from anywhere in the repository by using relative paths:

```yaml
items:
    # Component within the package directory
    - type: "mode"
      path: "modes/my-mode"

    # Component outside the package directory (using relative path)
    - type: "prompt"
      path: "../shared-prompts/data-analysis"

    # Component from a completely different part of the repository
    - type: "mcp"
      path: "../../other-category/useful-server"
```

This allows you to:

- Create shared components that can be used by multiple packages
- Organize components logically while maintaining package relationships
- Reference existing components without duplicating them

#### How It Works

- The `path` is relative to the package's directory
- The Marketplace resolves these paths when loading the package
- Components referenced this way appear as part of the package in the UI
- The same component can be included in multiple packages

### Localization Support

You can provide metadata in multiple languages by using locale-specific files:

**Important Notes on Localization:**

- Only files with the pattern `metadata.{locale}.yml` are supported
- The Marketplace will display metadata in the user's locale if available
- If the user's locale is not available, it will fall back to English
- The English locale (`metadata.en.yml`) is required as a fallback
- Files without a locale code (e.g., just `metadata.yml`) are not supported

## Contributing Process

To contribute your package to the official repository, follow these steps:

### 1. Fork the Repository

1. Visit the official Roo Code Packages repository: [https://github.com/RooVetGit/Roo-Code-Marketplace](https://github.com/RooVetGit/Roo-Code-Marketplace)
2. Click the "Fork" button in the top-right corner
3. This creates your own copy of the repository where you can make changes

### 2. Clone Your Fork

Clone your forked repository to your local machine:

```bash
git clone https://github.com/YOUR-USERNAME/Roo-Code-Marketplace.git
cd Roo-Code-Marketplace
```

### 3. Create Your Package

1. Create a new directory for your package with an appropriate name
2. Add the required metadata files and component directories
3. Follow the structure and format described above
4. Add documentation in a README.md file

Example of creating a simple package:

```bash
mkdir -p my-package/modes/my-mode
touch my-package/metadata.en.yml
touch my-package/README.md
touch my-package/modes/my-mode/metadata.en.yml
```

### 4. Test Your Package

Before submitting, test your package by adding your fork as a custom source in the Marketplace:

1. In VS Code, open the Marketplace
2. Go to the "Settings" tab
3. Click "Add Source"
4. Enter your fork's URL (e.g., `https://github.com/YOUR-USERNAME/Roo-Code-Marketplace`)
5. Click "Add"
6. Verify that your package appears and functions correctly

### 5. Commit and Push Your Changes

Once you're satisfied with your package:

```bash
git add .
git commit -m "Add my-package with mode component"
git push origin main
```

### 6. Create a Pull Request

1. Go to the original repository: [https://github.com/RooVetGit/Roo-Code-Marketplace](https://github.com/RooVetGit/Roo-Code-Marketplace)
2. Click "Pull Requests" and then "New Pull Request"
3. Click "Compare across forks"
4. Select your fork as the head repository
5. Click "Create Pull Request"
6. Provide a clear title and description of your package
7. Submit the pull request

### 7. Review Process

After submitting your pull request:

1. Maintainers will review your package
2. They may request changes or improvements
3. Once approved, your package will be merged into the main repository
4. Your package will be available to all users of the Marketplace

## Best Practices

- **Clear Documentation**: Include detailed documentation in your README.md
- **Descriptive Metadata**: Write clear, informative descriptions
- **Appropriate Tags**: Use relevant tags to make your package discoverable
- **Testing**: Thoroughly test your package before submitting
- **Localization**: Consider providing metadata in multiple languages
- **Semantic Versioning**: Follow semantic versioning for version numbers
- **Consistent Naming**: Use clear, descriptive names for components

## Example Package

Here's a comprehensive example of a data science package that includes both internal components and references to external components:

**data-science-toolkit/metadata.en.yml**:

```yaml
name: "Data Science Toolkit"
description: "A comprehensive collection of tools for data science workflows"
version: "1.0.0"
type: "package"
tags:
    - data
    - science
    - analysis
    - visualization
    - machine learning
items:
    # External components (outside this package directory)
    - type: "prompt"
      path: "../shared-prompts/data-cleaning"
    - type: "mcp"
      path: "../../ml-tools/model-trainer"
    - type: "mode"
      path: "../visualization-tools/chart-creator-mode"
```

**data-science-toolkit/modes/data-scientist-mode/metadata.en.yml**:

```yaml
name: "Data Scientist Mode"
description: "A specialized mode for data science tasks"
version: "1.0.0"
type: "mode"
tags:
    - data
    - science
    - analysis
```

**shared-prompts/data-cleaning/metadata.en.yml**:

```yaml
name: "Data Cleaning Prompt"
description: "A prompt for cleaning and preprocessing datasets"
version: "1.0.0"
type: "prompt"
tags:
    - data
    - cleaning
    - preprocessing
```

---

**Previous**: [Working with Package Details](./04-working-with-details.md) | **Next**: [Adding Custom Sources](./06-adding-custom-sources.md)
