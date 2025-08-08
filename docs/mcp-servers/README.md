# MCP Server Integrations

This directory contains documentation for integrating various MCP (Model Context Protocol) servers with Roo-Code.

## Available MCP Servers

### Security & Testing

- [BurpSuite](./burpsuite.md) - Web application security testing and vulnerability scanning

## What are MCP Servers?

MCP servers extend Roo-Code's capabilities by providing access to external tools and services through the Model Context Protocol. They enable AI assistants to:

- Interact with specialized tools and applications
- Access domain-specific functionality
- Automate complex workflows
- Integrate with existing development and testing infrastructure

## Adding MCP Servers

MCP servers can be configured in two ways:

1. **Project-level**: Add configuration to `.roo/mcp.json` in your project
2. **Global**: Configure in the system-wide MCP settings file

For detailed instructions on configuring specific MCP servers, refer to their individual documentation pages.

## Contributing

To add documentation for a new MCP server:

1. Create a new markdown file in this directory
2. Follow the structure used in existing documentation
3. Include prerequisites, installation steps, configuration examples, and troubleshooting
4. Add a link to your documentation in this README

## Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [Roo-Code MCP Documentation](https://docs.roocode.com/advanced-usage/mcp)
- [MCP Server Registry](https://github.com/modelcontextprotocol/servers)
