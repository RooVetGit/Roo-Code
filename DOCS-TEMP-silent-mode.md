# Silent Mode

Silent Mode is an innovative feature that allows Roo Code to work in the background without interrupting your current workflow. When enabled, Roo performs file operations in memory and presents a comprehensive review interface when the task completes, letting you stay focused on your work.

### Key Features

- **Zero Interruption**: Continue coding without file tabs opening or switching
- **Background Processing**: All changes happen in memory until you're ready to review
- **Smart Activation**: Automatically detects when files aren't actively being edited
- **Comprehensive Review**: See all changes in a unified diff interface before applying
- **Full Control**: Approve, reject, or modify changes individually or in bulk
- **Graceful Fallback**: Seamlessly switches to interactive mode when needed

---

## Use Case

**Before**: Roo interrupts your workflow by constantly opening files and switching tabs:

- "Can I write to `src/utils/helper.ts`?" → File opens, disrupting your current work
- "Can I modify `package.json`?" → Another tab switch and context loss
- "Can I create `src/components/NewWidget.tsx`?" → More interruptions

**With Silent Mode**: Roo works quietly in the background while you stay focused on your current task. When complete, you get a single notification with all changes ready for review.

## How it Works

1. **Automatic Detection**: Silent Mode activates when Roo detects that target files aren't being actively edited
2. **Memory Operations**: All file changes are buffered in memory rather than immediately written to disk
3. **Change Tracking**: Every modification is tracked with detailed diff information
4. **Completion Notification**: A non-intrusive notification appears when the task finishes
5. **Review Interface**: A comprehensive diff viewer shows all proposed changes
6. **Apply Changes**: You can approve all changes at once or review them individually

![Silent Mode Workflow Diagram](silent-mode-workflow.png)

---

## Configuration

### Global Setting

Enable or disable Silent Mode globally in VS Code settings:

1. **Setting**: `roo-cline.silentMode`

    - **Description**: Enables Silent Mode for all compatible tasks
    - **Default**: `false` (disabled by default for compatibility)
    - **Type**: `boolean`

2. **Auto-Activation Threshold**: `roo-cline.silentMode.autoActivateDelay`

    - **Description**: How long (in seconds) a file must be inactive before Silent Mode can activate
    - **Default**: `30` seconds
    - **Type**: `number`

3. **Memory Limit**: `roo-cline.silentMode.maxBufferSize`
    - **Description**: Maximum memory (in MB) to use for buffering changes
    - **Default**: `50` MB
    - **Type**: `number`

### Per-Task Control

Control Silent Mode on a per-task basis using commands:

- **Toggle Silent Mode**: `Ctrl+Shift+P` → "Roo: Toggle Silent Mode"
- **Enable Silent Mode**: `Ctrl+Shift+P` → "Roo: Enable Silent Mode"
- **Disable Silent Mode**: `Ctrl+Shift+P` → "Roo: Disable Silent Mode"

---

## Getting Started

### Step 1: Enable Silent Mode

```json
// In VS Code settings.json
{
	"roo-cline.silentMode": true
}
```

Or use the Settings UI:

1. Open VS Code Settings (`Ctrl+,`)
2. Search for "Silent Mode"
3. Check "Enable Silent Mode"

### Step 2: Start a Task

Give Roo a task that involves multiple file operations:

```
Create a new React component called UserProfile with TypeScript.
Include a props interface, styling with CSS modules, and unit tests.
```

### Step 3: Continue Your Work

Keep working on your current files. Silent Mode will activate automatically when Roo detects you're not actively editing the target files.

### Step 4: Review Changes

When Roo completes the task, you'll see a notification:

> 🎉 **Roo completed silently**: 4 files modified with 127 changes
>
> [Review Changes] [Apply All] [Dismiss]

### Step 5: Apply Changes

Use the review interface to:

- See a unified diff of all changes
- Approve or reject individual files
- Apply all changes at once
- Make additional modifications before applying

---

## Review Interface

The Silent Mode review interface provides comprehensive change management:

### Features

- **File Tree**: Navigate through all modified files
- **Unified Diff**: See all changes in a single view
- **Individual Review**: Examine each file's changes separately
- **Selective Apply**: Choose which changes to apply
- **Edit Before Apply**: Modify changes before applying them
- **Change Statistics**: See additions, deletions, and modifications at a glance

### Controls

- **Apply All**: Apply all changes immediately
- **Apply Selected**: Apply only checked changes
- **Reject All**: Discard all changes
- **Edit**: Open specific changes for modification
- **Export Diff**: Save the diff to a file for later review

---

## Advanced Usage

### Manual Activation

Force Silent Mode for specific tasks:

```typescript
// Using the Roo API (for extension developers)
await roo.startTask({
	prompt: "Refactor the authentication system",
	silentMode: true,
})
```

### Conditional Activation

Set up rules for when Silent Mode should activate:

```json
{
	"roo-cline.silentMode.autoActivate": {
		"filePatterns": ["**/*.test.ts", "**/docs/**"],
		"excludePatterns": ["**/src/index.ts"],
		"minFileCount": 3
	}
}
```

### Integration with Custom Modes

Silent Mode works seamlessly with all Roo Code modes:

- **Code Mode**: Background refactoring and feature implementation
- **Architect Mode**: System-wide changes and structural modifications
- **Debug Mode**: Fix application without disrupting testing workflow

---

## Best Practices

### When to Use Silent Mode

✅ **Ideal for:**

- Large refactoring tasks
- Creating multiple related files
- Background maintenance tasks
- Non-urgent feature development
- Documentation generation

❌ **Not recommended for:**

- Debugging urgent issues
- Single file edits
- Interactive exploration
- Learning new codebases

### Productivity Tips

1. **Plan Ahead**: Give Roo comprehensive tasks that benefit from batch processing
2. **Stay Focused**: Use Silent Mode to maintain flow state during deep work
3. **Review Thoroughly**: Always review changes before applying, especially for critical code
4. **Use Descriptive Prompts**: Clear instructions lead to better automated results
5. **Combine with Auto-Approval**: Set up auto-approval for trusted file types

---

## Troubleshooting

### Silent Mode Not Activating

**Issue**: Silent Mode doesn't activate even when enabled

**Solutions:**

- Check that `roo-cline.silentMode` is set to `true`
- Ensure target files aren't open in active editors
- Wait for the auto-activation delay period (default: 30 seconds)
- Verify memory limits haven't been exceeded

### Memory Usage Warnings

**Issue**: "Silent Mode memory limit exceeded" notification

**Solutions:**

- Increase `roo-cline.silentMode.maxBufferSize` setting
- Break large tasks into smaller chunks
- Review and apply pending changes before starting new tasks
- Check for memory leaks in the Silent Mode system

### Review Interface Issues

**Issue**: Can't see changes in review interface

**Solutions:**

- Refresh the review panel
- Check VS Code developer console for errors
- Restart VS Code if the interface becomes unresponsive
- Ensure all files are saved before starting Silent Mode tasks

### Fallback to Interactive Mode

**Issue**: Silent Mode switches to interactive mode unexpectedly

**Solutions:**

- This is normal behavior for complex tasks requiring user input
- Review the task logs to understand why fallback occurred
- Adjust task instructions to be more specific
- Use auto-approval settings for routine operations

---

## FAQ

**"How do I know when Silent Mode is active?"**

- Look for the "🔇" indicator in the Roo status bar
- Silent Mode tasks show different progress indicators
- You'll receive a completion notification instead of immediate file changes

**"Can I cancel a Silent Mode task?"**

- Yes, use `Ctrl+Shift+P` → "Roo: Cancel Current Task"
- All buffered changes will be discarded
- You'll return to interactive mode for the next task

**"What happens if VS Code crashes during Silent Mode?"**

- Buffered changes are periodically saved to disk as temporary files
- On restart, you'll be prompted to recover pending changes
- Recovery files are automatically cleaned up after successful recovery

**"Does Silent Mode work with all file types?"**

- Yes, Silent Mode supports all file types that Roo can modify
- Binary files and large files (>10MB) may automatically fall back to interactive mode
- Special handling for package.json, configuration files, and other critical files

**"How much memory does Silent Mode use?"**

- Default limit is 50MB for buffered changes
- Memory usage is displayed in the status bar during active tasks
- Large tasks automatically split into chunks to stay within limits

---

## Performance Considerations

### Memory Usage

- **Default Limit**: 50MB for buffered changes
- **Monitoring**: Real-time memory usage in status bar
- **Optimization**: Automatic compression for large text files
- **Cleanup**: Automatic cleanup of old buffer data

### File System Impact

- **Read Operations**: Cached to reduce disk I/O
- **Write Operations**: Batched for optimal performance
- **Temporary Files**: Minimal temporary file usage
- **Recovery**: Efficient recovery system for crash scenarios

### Network Considerations

- **API Calls**: No additional network overhead
- **Token Usage**: Same token consumption as interactive mode
- **Streaming**: Efficient streaming for large responses
- **Caching**: Intelligent caching of unchanged file content

---

## Security

### Data Protection

- **Memory Security**: Sensitive data encrypted in memory buffers
- **Temporary Files**: Secure cleanup of temporary files
- **Access Control**: Respects existing file permissions
- **Audit Trail**: Complete logging of all file operations

### Privacy Considerations

- **Local Processing**: All buffering happens locally
- **No Data Transmission**: Buffered content never sent to external services
- **User Control**: Complete control over when changes are applied
- **Transparency**: Full visibility into all proposed changes

---

## Integration Examples

### With GitHub Workflows

```yaml
# .github/workflows/roo-silent-refactor.yml
name: Automated Refactoring
on:
    issue_comment:
        types: [created]
jobs:
    refactor:
        if: contains(github.event.comment.body, '/roo-refactor')
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v3
            - name: Run Roo Silent Mode
              env:
                  ROO_SILENT_MODE: true
              run: |
                  roo-cli "${{ github.event.comment.body }}"
```

### With Pre-commit Hooks

```bash
#!/bin/sh
# .git/hooks/pre-commit
# Auto-format code with Roo in Silent Mode

if [ "$ROO_AUTO_FORMAT" = "true" ]; then
  roo-cli --silent "Format and optimize all staged files"
fi
```

### With VS Code Tasks

```json
{
	"version": "2.0.0",
	"tasks": [
		{
			"label": "Roo: Silent Refactor",
			"type": "shell",
			"command": "roo-cli",
			"args": ["--silent", "Refactor current file for better performance"],
			"group": "build"
		}
	]
}
```

---

## Migration Guide

### From Interactive Mode

If you're used to interactive mode, Silent Mode offers these improvements:

1. **Batch Approval**: Instead of approving each file individually, review all changes together
2. **Context Preservation**: Your current editor state remains unchanged during tasks
3. **Better Focus**: Eliminate interruptions during complex development work
4. **Comprehensive Review**: See the full scope of changes before applying anything

### Settings Migration

```json
// Old interactive settings
{
  "roo-cline.autoApprove": ["*.md", "*.txt"],
  "roo-cline.alwaysAllowWrite": true
}

// New Silent Mode settings
{
  "roo-cline.silentMode": true,
  "roo-cline.silentMode.autoActivate": {
    "filePatterns": ["*.md", "*.txt"]
  }
}
```

### Workflow Changes

| Interactive Mode       | Silent Mode              |
| ---------------------- | ------------------------ |
| Immediate file changes | Buffered changes         |
| Per-file approval      | Batch review             |
| Context switching      | Context preservation     |
| Reactive workflow      | Proactive workflow       |
| Immediate feedback     | Completion notifications |

---

## API Reference

### Commands

- `roo-cline.toggleSilentMode`: Toggle Silent Mode on/off
- `roo-cline.enableSilentMode`: Enable Silent Mode for current session
- `roo-cline.disableSilentMode`: Disable Silent Mode for current session
- `roo-cline.reviewSilentChanges`: Open the Silent Mode review interface
- `roo-cline.applySilentChanges`: Apply all pending Silent Mode changes

### Events

```typescript
// Extension API events
roo.onSilentModeActivated((taskId: string) => {
	console.log(`Silent Mode activated for task ${taskId}`)
})

roo.onSilentModeCompleted((summary: ChangeSummary) => {
	console.log(`Task completed: ${summary.filesChanged} files changed`)
})

roo.onSilentModeError((error: SilentModeError) => {
	console.error(`Silent Mode error: ${error.message}`)
})
```

### Configuration Schema

```typescript
interface SilentModeSettings {
	enabled: boolean
	autoActivateDelay: number // seconds
	maxBufferSize: number // MB
	autoActivate: {
		filePatterns: string[]
		excludePatterns: string[]
		minFileCount: number
	}
	notifications: {
		onActivation: boolean
		onCompletion: boolean
		onError: boolean
	}
}
```

---

## Changelog

### Version 3.24.0 (Current)

- Initial Silent Mode release
- Basic file operation buffering
- Review interface
- Auto-activation based on file activity

### Planned Features

- **3.25.0**: Enhanced review interface with inline editing
- **3.26.0**: Silent Mode analytics and usage insights
- **3.27.0**: Integration with version control systems
- **Future**: Machine learning-based auto-approval suggestions

---

## Support

For Silent Mode questions and issues:

- **Documentation**: [docs.roocode.com/silent-mode](https://docs.roocode.com/silent-mode)
- **Discord**: [Join our Discord](https://discord.gg/roocode) #silent-mode channel
- **GitHub Issues**: [Report bugs or request features](https://github.com/RooCodeInc/Roo-Code/issues)
- **Reddit**: [r/RooCode Silent Mode discussions](https://reddit.com/r/RooCode)

### Getting Help

When reporting issues, please include:

- Silent Mode settings configuration
- Task description that triggered the issue
- Memory usage at time of issue
- VS Code version and operating system
- Relevant log files from the developer console

---

## Related Features

> 📌 **Related Features**
>
> - [Custom Modes](https://docs.roocode.com/advanced-usage/custom-modes): Create specialized Silent Mode configurations
> - [Auto-Approval Settings](https://docs.roocode.com/advanced-usage/auto-approving-actions): Configure automatic approval for trusted operations
> - [MCP Integration](https://docs.roocode.com/advanced-usage/mcp): Extend Silent Mode with custom tools and integrations

> 👉 **See Also**
>
> - [Performance Optimization Guide](performance.md)
> - [VS Code Integration Best Practices](vscode-integration.md)
> - [Advanced Configuration Examples](advanced-config.md)
