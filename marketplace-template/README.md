# Marketplace Template

This template provides a basic structure for creating a marketplace source repository. The structure follows the required format for Roo Code's marketplace.

## Structure

```
/
├── metadata.en.yml         # Required: Repository metadata
└── mcp servers/           # Required: At least one of: mcp servers, roles, storage systems, or items
    └── example-server/
        └── metadata.en.yml
```

## Required Files

### Root metadata.en.yml

```yaml
name: "Your Repository Name"
description: "Your repository description"
version: "1.0.0"
```

### MCP Server metadata.en.yml

```yaml
name: "Your MCP Server Name"
description: "Your MCP server description"
type: "mcp server"
version: "1.0.0"
```

## Usage

1. Copy this template to create your own marketplace repository
2. Update the metadata.en.yml with your repository information
3. Add your MCP servers, roles, or other components
4. Each component must have its own metadata.en.yml file with the required fields

## Validation Requirements

- The root metadata.en.yml must have name, description, and version fields
- Version must be in semver format (e.g., 1.0.0)
- The repository must have at least one of: mcp servers, roles, storage systems, or items directories
- Each component must have a metadata.en.yml with the required fields including the correct type
