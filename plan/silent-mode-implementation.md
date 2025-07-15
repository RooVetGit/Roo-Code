# Silent Mode Implementation Plan

## Overview

Silent Mode allows Roo to work in the background without opening files or switching tabs, maintaining the user's current context while performing tasks. When complete, users receive a notification and can review changes via a diff interface.

## Requirements Summary

From the GitHub issue:

- Roo runs tasks silently in the background without visual changes
- No file opening or tab switching during task execution
- Task completion notification with review option
- Diff/summary interface for reviewing changes
- Toggle setting: `silentMode: true/false`
- Quick toggle command for on-demand activation
- Should activate when files are not actively being edited

## Architecture Overview

### Core Components

1. **Silent Mode Detection Engine** - Determines when to activate silent mode
2. **Background File Operations** - Handles file changes without UI updates
3. **Change Buffering System** - Tracks and stores modifications for review
4. **Notification System** - Alerts user when tasks complete
5. **Diff Review Interface** - Shows changes for user approval
6. **Settings Integration** - Configuration and toggle functionality

## Detailed Implementation Plan

### 1. Settings and Configuration

#### 1.1 Add Silent Mode Setting

**Files to modify:**

- `packages/types/src/global-settings.ts`
- `src/package.json` (VS Code settings)
- `webview-ui/src/context/ExtensionStateContext.tsx`
- `webview-ui/src/components/settings/SettingsView.tsx`

**Implementation:**

```typescript
// Add to global-settings.ts
silentMode: z.boolean().optional(),

// Add to package.json configuration
"roo-cline.silentMode": {
    "type": "boolean",
    "default": false,
    "description": "Enable Silent Mode - Roo works in background without opening files or switching tabs"
}
```

#### 1.2 Add Quick Toggle Command

**Files to modify:**

- `src/package.json` (commands)
- `src/activate/registerCommands.ts`
- `src/core/webview/webviewMessageHandler.ts`

### 2. Silent Mode Detection Engine

#### 2.1 File Activity Detection

**New file:** `src/core/silent-mode/SilentModeDetector.ts`

```typescript
export class SilentModeDetector {
	/**
	 * Determines if Silent Mode should activate for a given file
	 * Based on:
	 * - Global silentMode setting
	 * - Whether file is currently open and focused
	 * - Whether file is being actively edited
	 */
	public shouldActivateSilentMode(filePath: string): boolean

	/**
	 * Checks if a file is currently active in the editor
	 */
	private isFileActivelyBeingEdited(filePath: string): boolean

	/**
	 * Checks if a file is open in any tab
	 */
	private isFileOpenInTabs(filePath: string): boolean
}
```

**Integration points:**

- Called before any file operation in tools
- Used in `DiffViewProvider` to determine behavior mode

### 3. Background File Operations System

#### 3.1 Silent DiffViewProvider Mode

**Files to modify:**

- `src/integrations/editor/DiffViewProvider.ts`

**Key changes:**

```typescript
export class DiffViewProvider {
	private silentMode: boolean = false
	private bufferedChanges: Map<string, BufferedFileChange> = new Map()

	// New method to enable silent operations
	public enableSilentMode(): void

	// Modified to support silent operations
	public async open(relPath: string): Promise<void>

	// Silent version that doesn't show UI
	public async openSilent(relPath: string): Promise<void>

	// Buffers changes instead of applying immediately
	public async updateSilent(content: string): Promise<void>
}

interface BufferedFileChange {
	originalContent: string
	newContent: string
	filePath: string
	editType: "create" | "modify"
	timestamp: number
}
```

#### 3.2 Tool Wrapper for Silent Operations

**New file:** `src/core/silent-mode/SilentToolWrapper.ts`

```typescript
export class SilentToolWrapper {
	/**
	 * Wraps file writing tools to operate in silent mode
	 */
	public static async wrapFileWriteTool(originalTool: Function, cline: Task, ...args: any[]): Promise<void>

	/**
	 * Wraps diff application tools for silent mode
	 */
	public static async wrapDiffTool(originalTool: Function, cline: Task, ...args: any[]): Promise<void>
}
```

#### 3.3 Change Tracking System

**New file:** `src/core/silent-mode/ChangeTracker.ts`

```typescript
export class ChangeTracker {
	private changes: Map<string, FileChange[]> = new Map()

	public trackChange(taskId: string, change: FileChange): void
	public getChangesForTask(taskId: string): FileChange[]
	public clearChangesForTask(taskId: string): void
	public generateDiffSummary(taskId: string): DiffSummary
}

interface FileChange {
	filePath: string
	operation: "create" | "modify" | "delete"
	originalContent?: string
	newContent?: string
	diff?: string
	timestamp: number
}

interface DiffSummary {
	filesChanged: number
	linesAdded: number
	linesRemoved: number
	changes: FileChange[]
}
```

### 4. Task Completion Notification System

#### 4.1 Enhanced Task Completion Detection

**Files to modify:**

- `src/core/task/Task.ts`
- `src/core/assistant-message/presentAssistantMessage.ts`

**Key changes:**

```typescript
// In Task.ts
export class Task extends EventEmitter<ClineEvents> {
	private silentModeChanges: ChangeTracker = new ChangeTracker()

	// Enhanced completion that checks for silent mode
	private async handleTaskCompletion(): Promise<void> {
		if (this.isSilentMode && this.silentModeChanges.hasChanges()) {
			await this.showSilentModeCompletion()
		}
		// ... existing completion logic
	}

	private async showSilentModeCompletion(): Promise<void> {
		// Show notification and prepare diff review
	}
}
```

#### 4.2 Notification Integration

**Files to modify:**

- `src/core/webview/webviewMessageHandler.ts`
- `webview-ui/src/components/chat/ChatView.tsx`

**Implementation:**

- Leverage existing sound notification system (already implemented)
- Add new notification type for silent mode completion
- Show non-intrusive popup with review option

### 5. Diff Review Interface

#### 5.1 Silent Mode Review Component

**New file:** `webview-ui/src/components/silent-mode/SilentModeReview.tsx`

```typescript
interface SilentModeReviewProps {
	taskId: string
	changes: FileChange[]
	onApprove: () => void
	onReject: () => void
	onApprovePartial: (approvedFiles: string[]) => void
}

export const SilentModeReview: React.FC<SilentModeReviewProps> = ({
	taskId,
	changes,
	onApprove,
	onReject,
	onApprovePartial,
}) => {
	// Component for reviewing changes
	// Shows file-by-file diff
	// Allows selective approval
	// Integrates with existing diff viewing system
}
```

#### 5.2 Integration with Existing Diff System

**Files to modify:**

- `src/integrations/editor/DiffViewProvider.ts`
- `webview-ui/src/components/chat/ChatView.tsx`

**Key features:**

- Reuse existing diff rendering logic
- Support for reviewing multiple files
- Option to approve all, reject all, or selective approval
- Preview changes before applying

### 6. Tool Integration Points

#### 6.1 File Writing Tools

**Files to modify:**

- `src/core/tools/writeToFileTool.ts`
- `src/core/tools/multiApplyDiffTool.ts`
- `src/core/tools/insertContentTool.ts`

**Integration pattern:**

```typescript
export async function writeToFileTool(
	cline: Task,
	block: ToolUse,
	// ... other params
) {
	const silentModeDetector = new SilentModeDetector()
	const shouldUseSilentMode = cline.silentModeEnabled && silentModeDetector.shouldActivateSilentMode(relPath)

	if (shouldUseSilentMode) {
		return await SilentToolWrapper.wrapFileWriteTool(originalWriteToFileTool, cline, block, ...args)
	}

	// ... existing implementation
}
```

#### 6.2 File Opening Integration

**Files to modify:**

- `src/integrations/misc/open-file.ts`

**Changes:**

- Check silent mode before opening files
- Skip file opening when in silent mode
- Track file paths for later review

### 7. Settings UI Integration

#### 7.1 Settings Panel

**Files to modify:**

- `webview-ui/src/components/settings/SettingsView.tsx`

**Add to settings:**

```typescript
<VSCodeCheckbox
    checked={silentMode}
    onChange={(e: any) => setCachedStateField("silentMode", e.target.checked)}
    data-testid="silent-mode-checkbox">
    <span className="font-medium">Silent Mode</span>
</VSCodeCheckbox>
<div className="text-vscode-descriptionForeground text-sm mt-1">
    Run tasks in background without opening files or switching tabs
</div>
```

#### 7.2 Quick Toggle Command

**Add VS Code command:**

- Command: `roo-cline.toggleSilentMode`
- Keybinding: Configurable by user
- Shows current state in status bar

## Implementation Sequence

### Phase 1: Core Infrastructure (Tasks 1-2)

1. ✅ Add settings and configuration
2. ✅ Implement silent mode detection logic

### Phase 2: Background Operations (Tasks 3-4)

3. ✅ Modify DiffViewProvider for silent operations
4. ✅ Create tool wrapper system for silent mode

### Phase 3: Completion & Review (Tasks 5-6)

5. ✅ Implement completion notification system
6. ✅ Create diff review interface

### Phase 4: Polish & Commands (Task 7)

7. ✅ Add toggle command and final integration

## Technical Considerations

### Memory Management

- Buffer changes efficiently to avoid memory leaks
- Clean up buffered changes after task completion
- Limit number of concurrent silent tasks

### Error Handling

- Graceful fallback to normal mode if silent mode fails
- Clear error messages for silent mode issues
- Preserve user work if silent mode encounters problems

### Performance

- Minimal impact on normal mode operations
- Efficient change tracking and diff generation
- Lazy loading of diff review components

### User Experience

- Clear indication when silent mode is active
- Non-intrusive notifications
- Easy way to review and approve changes
- Fallback to interactive mode when needed

## Testing Strategy

### Unit Tests

- Silent mode detection logic
- Change tracking and buffering
- Tool wrapper functionality

### Integration Tests

- End-to-end silent mode workflows
- Interaction with existing diff system
- Settings persistence and toggle functionality

### Edge Cases

- Large file operations in silent mode
- Multiple concurrent tasks
- System interruptions during silent operations
- File conflicts and permission issues

## Compatibility & Migration

### Backward Compatibility

- Silent mode is opt-in (disabled by default)
- No changes to existing workflows when disabled
- Existing settings and configurations unaffected

### Migration Path

- No migration needed - new feature
- Users can gradually adopt silent mode
- Easy rollback if issues encountered

## Future Enhancements

### Potential Improvements

- Selective silent mode per file type
- Smart detection of user activity
- Batch operation optimization
- Integration with version control systems
- Advanced diff review features

### Extension Points

- Plugin system for custom silent mode behaviors
- API for external tools to integrate with silent mode
- Configuration profiles for different silent mode strategies

## Success Metrics

### Acceptance Criteria

- ✅ Silent mode setting available in VS Code settings
- ✅ Tasks run without opening/switching files when enabled
- ✅ Task completion notification appears
- ✅ Diff review interface shows all changes
- ✅ User can approve/reject changes
- ✅ Quick toggle command works
- ✅ No interference with existing workflows when disabled

### Performance Benchmarks

- Silent mode adds <5% overhead to task execution
- Change tracking uses <10MB additional memory
- Diff generation completes in <1 second for typical changes
- UI remains responsive during silent operations
