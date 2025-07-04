# Marketplace Data

This directory contains marketplace data files for Roo Code's marketplace system.

## Structure

- `mcps.yaml` - MCP (Model Context Protocol) servers available in the marketplace
- `modes.yaml` - Custom modes available in the marketplace (to be added)

## MCP Servers

The `mcps.yaml` file contains a list of MCP servers that can be installed through the Roo Code marketplace. Each MCP server entry includes:

- `id` - Unique identifier for the MCP server
- `name` - Display name
- `description` - Detailed description of functionality
- `author` - Author name
- `authorUrl` - Author's website or GitHub profile
- `url` - Repository or documentation URL
- `tags` - Array of tags for categorization
- `prerequisites` - Array of requirements needed before installation
- `content` - Installation methods (can be a single string or array of methods)

### Installation Methods

Each installation method can include:

- `name` - Method name (e.g., "uvx", "pip install")
- `content` - JSON configuration to be added to MCP settings
- `parameters` - Optional parameters that users can customize
- `prerequisites` - Method-specific prerequisites

### Parameters

Parameters allow users to customize the installation:

- `name` - Display name for the parameter
- `key` - Key used in the configuration template
- `placeholder` - Default value or example
- `optional` - Whether the parameter is optional (default: false)

## VoiceVox MCP Server

The VoiceVox MCP Server provides Japanese text-to-speech capabilities using the VoiceVox engine. It includes:

### Features

- Text-to-Speech conversion for Japanese text
- Multiple voice characters with different personalities
- Customizable speech speed and voice selection
- Automatic audio playback after generation
- WAV format audio file management

### Available Tools

1. `get_voices` - Retrieve list of available voices from VoiceVox
2. `text_to_speech` - Convert text to speech with customizable settings

### Use Cases

- Educational content creation with Japanese narration
- Accessibility improvements for Japanese content
- Podcast and video production
- Language learning applications
- Chatbot voice functionality

### Installation Options

1. **uvx (Recommended)** - Uses uvx to run the server directly
2. **pip install** - Install via pip and run with Python
3. **Custom Configuration** - Full customization with all available parameters

### Prerequisites

- VoiceVox Engine running (default: http://localhost:50021)
- Python 3.10+
- For uvx method: `pip install uvx`
- For pip method: `pip install mcp-server-voicevox`

## Usage

This marketplace data is used by the Roo Code extension to populate the marketplace UI. Users can browse, search, and install MCP servers directly from the extension.

## Contributing

To add a new MCP server to the marketplace:

1. Add an entry to `mcps.yaml` following the schema
2. Ensure all required fields are provided
3. Test the installation methods
4. Submit a pull request

## References

- [VoiceVox MCP Server Repository](https://github.com/Sunwood-ai-labs/mcp-voicevox)
- [VoiceVox MCP Server PyPI Package](https://pypi.org/project/mcp-server-voicevox/)
- [Model Context Protocol Documentation](https://docs.roocode.com/advanced-usage/mcp)
