# Roo Code Marketplace

This directory contains the marketplace configuration files for Roo Code extensions, including MCP servers and custom modes.

## Structure

- `mcps.yml` - Configuration for MCP (Model Context Protocol) servers
- `modes.yml` - Configuration for custom modes

## Adding New MCP Servers

To add a new MCP server to the marketplace, add an entry to `mcps.yml` following this structure:

```yaml
- id: "unique-server-id"
  name: "Display Name"
  description: "Detailed description of what the MCP server does"
  author: "Author Name"
  authorUrl: "https://github.com/author"
  url: "https://github.com/author/repo"
  tags: ["tag1", "tag2", "tag3"]
  prerequisites: ["Node.js 18+", "npm"]
  content:
      - name: "Installation Method Name"
        content: |
            {
              "mcpServers": {
                "server-name": {
                  "command": "npx",
                  "args": ["package-name"],
                  "env": {}
                }
              }
            }
        parameters: []
        prerequisites: ["Node.js 18+"]
```

## Adding New Modes

To add a new custom mode to the marketplace, add an entry to `modes.yml` following this structure:

```yaml
- id: "unique-mode-id"
  name: "Mode Display Name"
  description: "Description of what the mode does"
  author: "Author Name"
  authorUrl: "https://github.com/author"
  tags: ["tag1", "tag2"]
  prerequisites: ["Required MCP Server"]
  content: |
      name: Mode Name
      slug: mode-slug
      description: Brief mode description

      instructions: |
        Detailed instructions for the mode...
```

## Daft.ie MCP Server

The Daft.ie MCP Server has been added to the marketplace as requested in GitHub issue #4756. This server provides:

- Property search functionality for Irish rental market
- Integration with Daft.ie's property database
- Filtering by location, price, property type, and amenities
- Real-time property data and availability

### Installation

The Daft.ie MCP server can be installed via:

1. **NPM Installation** (Recommended)

    ```bash
    npx daft-ie-mcp
    ```

2. **Local Development**
    - Clone the repository from https://github.com/amineremache/daft-ie-mcp
    - Build and run locally

### Related Mode

A complementary "Property Search Mode" has also been added to help users effectively utilize the Daft.ie MCP server for property searches and market analysis.

## Contributing

To contribute new marketplace items:

1. Fork the repository
2. Add your item to the appropriate YAML file
3. Test the configuration
4. Submit a pull request

## Validation

All marketplace items should follow the schema defined in `packages/types/src/marketplace.ts` to ensure compatibility with the Roo Code extension.
