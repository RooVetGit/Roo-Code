# Community MCP Servers

This document lists community-contributed MCP servers that extend Roo Code's functionality.

## Codebase Indexing MCP Server

**Repository**: [anrgct/autodev-codebase](https://github.com/anrgct/autodev-codebase)  
**Author**: [@anrgct](https://github.com/anrgct)  
**Description**: A standalone MCP server that provides codebase indexing and semantic search capabilities, extracted from Roo Code's built-in codebase indexing module.

### Features

- **Semantic Code Search**: Search your codebase using natural language queries
- **Independent Operation**: Runs as a separate process, reducing the risk of VS Code crashes
- **Reusable Indexing**: Index data can be shared across different tools and applications
- **Better Observability**: Easier to debug and monitor indexing processes

### Benefits

- **Decoupled Architecture**: The indexing process runs independently of VS Code, improving stability
- **Cross-Tool Compatibility**: Works with Claude Code, Gemini CLI, and other MCP-compatible tools
- **Enhanced Debugging**: Easier to observe and troubleshoot indexing issues
- **Resource Efficiency**: Prevents indexing operations from freezing VS Code

### Installation

1. Install the MCP server:

    ```bash
    npm install -g autodev-codebase
    ```

2. Add to your MCP settings configuration:
    ```json
    {
    	"mcpServers": {
    		"autodev-codebase": {
    			"command": "autodev-codebase",
    			"args": ["--workspace", "${workspaceFolder}"]
    		}
    	}
    }
    ```

### Use Cases

This MCP server is particularly useful when:

- You want to use codebase indexing with multiple AI tools
- You experience stability issues with built-in indexing
- You need better observability of the indexing process
- You want to share indexed data across different development environments

### Acknowledgments

Special thanks to [@anrgct](https://github.com/anrgct) for extracting this functionality and making it available to the community. The original codebase indexing implementation was developed by [@daniel-lxs](https://github.com/daniel-lxs).

---

_Want to add your MCP server to this list? Create an issue or submit a pull request!_
