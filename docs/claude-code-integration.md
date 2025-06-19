# Claude Code Integration

This document describes how to use Claude Code CLI integration with Roo Code.

## Overview

The Claude Code integration allows Roo Code to use the Claude Code CLI instead of directly calling the Anthropic API. This provides several benefits:

- **Local CLI Control**: Use your locally installed Claude Code CLI
- **Custom Configuration**: Configure Claude Code CLI path and settings
- **Consistent Experience**: Same interface as other providers
- **No API Key Required**: Uses Claude Code's authentication

## Prerequisites

1. **Install Claude Code CLI**

    ```bash
    # Follow Claude Code installation instructions
    # Ensure 'claude' command is available in PATH
    ```

2. **Verify Installation**
    ```bash
    claude --version
    ```

## Configuration

### 1. Select Provider

1. Open Roo Code settings
2. Go to "Providers" section
3. Select "Claude Code" from the API Provider dropdown

### 2. Configure CLI Path

- **Default**: `claude` (uses system PATH)
- **Custom Path**: Specify full path to Claude Code CLI
    ```
    /usr/local/bin/claude
    /path/to/custom/claude
    ```

### 3. Select Model

Choose from available Claude Code models:

- `claude-sonnet-4-20250514` (default)
- `claude-opus-4-20250514`
- `claude-3-7-sonnet-20250219`
- `claude-3-5-sonnet-20241022`
- `claude-3-5-haiku-20241022`

## Usage

Once configured, Claude Code integration works seamlessly:

1. **Start Conversation**: Ask Roo Code any question
2. **CLI Execution**: Roo Code executes Claude Code CLI
3. **Streaming Response**: Receive real-time streaming responses
4. **Usage Tracking**: Monitor token usage and costs

## Verification

To verify Claude Code is being used:

### Console Logs (Development)

Open Developer Tools → Console and look for:

```
Claude Code Handler: Starting Claude Code CLI execution
Claude Code CLI: Process started with PID: 12345
```

### System Process Monitoring

```bash
# Linux/macOS
ps aux | grep claude

# Windows
tasklist | findstr claude
```

### Test Script

Run the integration test:

```bash
npm test -- claude-code.spec.ts
```

## Troubleshooting

### Common Issues

1. **"claude: command not found"**

    - Solution: Install Claude Code CLI or specify full path

2. **"Permission denied"**

    - Solution: Make Claude Code CLI executable

    ```bash
    chmod +x /path/to/claude
    ```

3. **Model not available**
    - Solution: Check Claude Code CLI version and available models
    ```bash
    claude --help
    ```

### Debug Mode

For development debugging, check console logs in Developer Tools.

## Implementation Details

### Architecture

```
Roo Code → ClaudeCodeHandler → runClaudeCode() → Claude Code CLI
```

### Key Components

- **ClaudeCodeHandler**: Main API handler class
- **runClaudeCode()**: CLI execution function
- **ClaudeCodeMessage**: Type definitions for CLI output
- **Stream Processing**: Real-time response handling

### CLI Arguments

The integration uses these Claude Code CLI arguments:

```bash
claude -p <messages> --system-prompt <prompt> --verbose --output-format stream-json --max-turns 1 --model <model>
```

## API Compatibility

The Claude Code integration maintains full compatibility with Roo Code's provider interface:

- ✅ Streaming responses
- ✅ Token usage tracking
- ✅ Cost calculation
- ✅ Error handling
- ✅ Model selection
- ✅ System prompts

## Security Considerations

- Claude Code CLI runs locally with user permissions
- No API keys stored in Roo Code settings
- Authentication handled by Claude Code CLI
- Process isolation and error handling

## Contributing

To contribute to Claude Code integration:

1. **Tests**: Run `npm test -- claude-code.test.ts`
2. **Types**: Update types in `packages/types/src/providers/claude-code.ts`
3. **Handler**: Modify `src/api/providers/claude-code.ts`
4. **UI**: Update `webview-ui/src/components/settings/providers/ClaudeCode.tsx`

## Support

For issues with Claude Code integration:

1. Check Claude Code CLI installation
2. Verify configuration settings
3. Review console logs for errors
4. Test with integration script
5. Report issues with detailed logs
