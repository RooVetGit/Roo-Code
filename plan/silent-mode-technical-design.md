# Silent Mode Technical Design

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     User Interface Layer                        │
├─────────────────────────────────────────────────────────────────┤
│  Settings Panel  │  Quick Toggle  │  Notification System       │
│                  │  Command       │  │ Diff Review UI           │
└─────────────────────────────────────────────────────────────────┘
                                     │
┌─────────────────────────────────────────────────────────────────┐
│                   Silent Mode Controller                        │
├─────────────────────────────────────────────────────────────────┤
│  • Mode Detection Engine                                        │
│  • Task Orchestration                                           │
│  • Change Coordination                                           │
└─────────────────────────────────────────────────────────────────┘
                                     │
┌─────────────────────────────────────────────────────────────────┐
│                   Core Systems Layer                            │
├─────────────────────────────────────────────────────────────────┤
│  File Operations  │  Change Tracker  │  Diff Generator          │
│  Buffer Manager   │  State Manager   │  Tool Wrappers           │
└─────────────────────────────────────────────────────────────────┘
                                     │
┌─────────────────────────────────────────────────────────────────┐
│                   Integration Layer                             │
├─────────────────────────────────────────────────────────────────┤
│  VS Code API     │  File System     │  Editor Integration       │
│  Event System    │  Diff Provider   │  Task System              │
└─────────────────────────────────────────────────────────────────┘
```

## Core Classes and Interfaces

### Silent Mode Controller

```typescript
/**
 * Main controller that orchestrates silent mode operations
 */
export class SilentModeController {
	private detector: SilentModeDetector
	private changeTracker: ChangeTracker
	private bufferManager: BufferManager
	private notificationService: NotificationService

	constructor(task: Task, settings: SilentModeSettings)

	/**
	 * Determines if an operation should run in silent mode
	 */
	public shouldOperateInSilentMode(operation: FileOperation): boolean

	/**
	 * Executes a file operation in silent mode
	 */
	public async executeInSilentMode(operation: FileOperation): Promise<SilentResult>

	/**
	 * Shows completion notification and diff review
	 */
	public async showCompletionReview(): Promise<ReviewResult>

	/**
	 * Applies approved changes to the file system
	 */
	public async applyChanges(approvedChanges: FileChange[]): Promise<void>
}
```

### Silent Mode Detector

```typescript
/**
 * Determines when to activate silent mode based on file state and user activity
 */
export class SilentModeDetector {
    constructor(private vscode: typeof import('vscode'))

    /**
     * Core detection logic for silent mode activation
     */
    public shouldActivateSilentMode(filePath: string, globalSetting: boolean): boolean {
        if (!globalSetting) return false

        return !this.isFileActivelyBeingEdited(filePath) &&
               !this.isFileInFocusedEditor(filePath)
    }

    /**
     * Checks if a file is currently being edited by the user
     */
    private isFileActivelyBeingEdited(filePath: string): boolean {
        const document = this.findOpenDocument(filePath)
        if (!document) return false

        return document.isDirty ||
               this.isDocumentInActiveEditor(document) ||
               this.hasRecentUserActivity(document)
    }

    /**
     * Checks if file is in the currently focused editor
     */
    private isFileInFocusedEditor(filePath: string): boolean {
        const activeEditor = vscode.window.activeTextEditor
        if (!activeEditor) return false

        return this.pathsMatch(activeEditor.document.uri.fsPath, filePath)
    }

    /**
     * Detects recent user activity on a document
     */
    private hasRecentUserActivity(document: vscode.TextDocument): boolean {
        // Implementation would track recent edits, cursor movements, etc.
        return false // Placeholder
    }
}
```

### Change Tracker

```typescript
/**
 * Tracks and manages file changes during silent mode operations
 */
export class ChangeTracker {
	private changes = new Map<string, FileChangeSet>()
	private taskChanges = new Map<string, string[]>() // taskId -> fileIds

	/**
	 * Records a file change during silent mode
	 */
	public trackChange(taskId: string, change: FileChange): void {
		const changeSet = this.getOrCreateChangeSet(change.filePath)
		changeSet.addChange(change)

		this.addToTaskChanges(taskId, change.filePath)
	}

	/**
	 * Gets all changes for a specific task
	 */
	public getChangesForTask(taskId: string): FileChange[] {
		const filePaths = this.taskChanges.get(taskId) || []
		return filePaths.flatMap((path) => this.getChangesForFile(path))
	}

	/**
	 * Generates a summary of changes for review
	 */
	public generateSummary(taskId: string): ChangeSummary {
		const changes = this.getChangesForTask(taskId)

		return {
			totalFiles: new Set(changes.map((c) => c.filePath)).size,
			totalChanges: changes.length,
			additions: changes.filter((c) => c.operation === "create").length,
			modifications: changes.filter((c) => c.operation === "modify").length,
			deletions: changes.filter((c) => c.operation === "delete").length,
			changes: changes,
		}
	}
}

interface FileChangeSet {
	filePath: string
	changes: FileChange[]
	currentContent: string
	originalContent: string

	addChange(change: FileChange): void
	generateDiff(): string
	canApply(): boolean
}
```

### Buffer Manager

```typescript
/**
 * Manages buffered file content during silent mode operations
 */
export class BufferManager {
	private buffers = new Map<string, FileBuffer>()
	private maxBufferSize = 50 * 1024 * 1024 // 50MB limit

	/**
	 * Creates or updates a file buffer
	 */
	public async bufferFileOperation(filePath: string, operation: FileOperation): Promise<BufferResult> {
		const buffer = await this.getOrCreateBuffer(filePath)

		try {
			const result = await buffer.applyOperation(operation)
			this.enforceMemoryLimits()
			return result
		} catch (error) {
			this.releaseBuffer(filePath)
			throw error
		}
	}

	/**
	 * Gets the current buffered content for a file
	 */
	public getBufferedContent(filePath: string): string | null {
		return this.buffers.get(filePath)?.content || null
	}

	/**
	 * Applies all buffered changes to the file system
	 */
	public async flushBuffers(filePaths: string[]): Promise<FlushResult> {
		const results: FlushResult = { success: [], failed: [] }

		for (const filePath of filePaths) {
			try {
				await this.flushBuffer(filePath)
				results.success.push(filePath)
			} catch (error) {
				results.failed.push({ filePath, error })
			}
		}

		return results
	}

	/**
	 * Releases buffers and cleans up memory
	 */
	public cleanup(taskId?: string): void {
		if (taskId) {
			// Release buffers for specific task
			this.releaseTaskBuffers(taskId)
		} else {
			// Full cleanup
			this.buffers.clear()
		}
	}
}

interface FileBuffer {
	filePath: string
	content: string
	originalContent: string
	operations: FileOperation[]
	timestamp: number

	applyOperation(operation: FileOperation): Promise<BufferResult>
	generateDiff(): string
	getSize(): number
}
```

## File Operation Integration

### Tool Wrapper System

```typescript
/**
 * Wraps existing file tools to support silent mode operations
 */
export class SilentToolWrapper {
	private controller: SilentModeController

	constructor(controller: SilentModeController)

	/**
	 * Generic wrapper for file writing tools
	 */
	public async wrapFileTool<T extends FileToolFunction>(
		tool: T,
		context: ToolContext,
		...args: Parameters<T>
	): Promise<ReturnType<T>> {
		if (!this.controller.shouldOperateInSilentMode(context.operation)) {
			// Delegate to original tool
			return await tool.apply(context, args)
		}

		// Execute in silent mode
		return await this.executeInSilentMode(tool, context, ...args)
	}

	/**
	 * Silent mode execution logic
	 */
	private async executeInSilentMode<T extends FileToolFunction>(
		tool: T,
		context: ToolContext,
		...args: Parameters<T>
	): Promise<ReturnType<T>> {
		// 1. Prepare silent environment
		const silentContext = await this.prepareSilentContext(context)

		// 2. Execute tool with modified context
		const result = await this.executeTool(tool, silentContext, ...args)

		// 3. Track changes
		await this.trackChanges(context, result)

		// 4. Return appropriate response
		return this.formatSilentResponse(result)
	}
}
```

### Integration Points

```typescript
/**
 * Integration points for existing tools
 */

// Write to File Tool Integration
export async function writeToFileTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	// Check if silent mode should be used
	const silentController = cline.getSilentModeController()

	if (
		silentController?.shouldOperateInSilentMode({
			type: "write",
			filePath: block.params.path,
			content: block.params.content,
		})
	) {
		return await silentController.executeFileWrite(block, pushToolResult)
	}

	// Fall back to original implementation
	return await originalWriteToFileTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
}

// Apply Diff Tool Integration
export async function applyDiffTool(
	cline: Task,
	block: ToolUse,
	// ... other parameters
) {
	const silentController = cline.getSilentModeController()

	if (
		silentController?.shouldOperateInSilentMode({
			type: "diff",
			filePath: block.params.path,
			diff: block.params.diff,
		})
	) {
		return await silentController.executeDiffApplication(block, pushToolResult)
	}

	// Fall back to original implementation
	return await originalApplyDiffTool(cline, block /* ... */)
}
```

## State Management

### Silent Mode State

```typescript
/**
 * Manages silent mode state throughout task execution
 */
export interface SilentModeState {
	enabled: boolean
	taskId: string
	activeFiles: Set<string>
	pendingChanges: Map<string, FileChange[]>
	bufferSizeLimit: number
	currentBufferSize: number
	startTime: number
	operations: SilentOperation[]
}

export class SilentModeStateManager {
	private state: SilentModeState
	private listeners: StateChangeListener[] = []

	constructor(initialState: Partial<SilentModeState>)

	public updateState(changes: Partial<SilentModeState>): void
	public getState(): Readonly<SilentModeState>
	public addListener(listener: StateChangeListener): void
	public removeListener(listener: StateChangeListener): void

	// State transitions
	public activateSilentMode(taskId: string): void
	public deactivateSilentMode(): void
	public addPendingChange(filePath: string, change: FileChange): void
	public commitChanges(filePaths: string[]): void
	public rollbackChanges(filePaths: string[]): void
}
```

## Error Handling and Recovery

### Error Scenarios

```typescript
/**
 * Handles errors during silent mode operations
 */
export class SilentModeErrorHandler {
	/**
	 * Handles buffer overflow situations
	 */
	public async handleBufferOverflow(
		operation: FileOperation,
		currentSize: number,
		limit: number,
	): Promise<RecoveryAction> {
		// Option 1: Fall back to normal mode
		if (operation.priority === "high") {
			return { action: "fallback", reason: "buffer_overflow" }
		}

		// Option 2: Flush some buffers
		await this.flushLeastRecentBuffers()
		return { action: "retry", reason: "buffer_cleared" }
	}

	/**
	 * Handles file conflicts during silent operations
	 */
	public async handleFileConflict(
		filePath: string,
		bufferedContent: string,
		currentContent: string,
	): Promise<ConflictResolution> {
		// For silent mode, we need to defer conflict resolution
		return {
			action: "defer",
			conflictInfo: {
				filePath,
				bufferedContent,
				currentContent,
				timestamp: Date.now(),
			},
		}
	}

	/**
	 * Handles permission errors
	 */
	public async handlePermissionError(operation: FileOperation, error: PermissionError): Promise<RecoveryAction> {
		// Silent mode can't prompt user, so we track for later resolution
		return {
			action: "track_for_review",
			error: error,
			operation: operation,
		}
	}
}
```

## Performance Considerations

### Memory Management

```typescript
/**
 * Memory-efficient operations for silent mode
 */
export class MemoryManager {
	private readonly MAX_BUFFER_SIZE = 50 * 1024 * 1024 // 50MB
	private readonly MAX_FILES_BUFFERED = 100

	/**
	 * Enforces memory limits during operations
	 */
	public enforceMemoryLimits(bufferManager: BufferManager): void {
		const currentSize = bufferManager.getTotalBufferSize()
		const fileCount = bufferManager.getBufferedFileCount()

		if (currentSize > this.MAX_BUFFER_SIZE) {
			this.flushLargestBuffers(bufferManager)
		}

		if (fileCount > this.MAX_FILES_BUFFERED) {
			this.flushOldestBuffers(bufferManager)
		}
	}

	/**
	 * Optimizes diff generation for large files
	 */
	public async generateOptimizedDiff(originalContent: string, newContent: string): Promise<OptimizedDiff> {
		// For very large files, use streaming diff generation
		if (originalContent.length > 1024 * 1024) {
			// 1MB
			return await this.generateStreamingDiff(originalContent, newContent)
		}

		// Standard diff for smaller files
		return this.generateStandardDiff(originalContent, newContent)
	}
}
```

### Performance Monitoring

```typescript
/**
 * Monitors performance during silent mode operations
 */
export class SilentModePerformanceMonitor {
	private metrics: PerformanceMetrics = {
		operationsProcessed: 0,
		averageProcessingTime: 0,
		memoryUsage: 0,
		bufferHitRate: 0,
	}

	public startOperation(operation: FileOperation): OperationTimer
	public endOperation(timer: OperationTimer): void
	public recordMemoryUsage(usage: number): void
	public getMetrics(): PerformanceMetrics

	/**
	 * Determines if performance is degrading
	 */
	public isPerformanceDegrading(): boolean {
		return (
			this.metrics.averageProcessingTime > 5000 || // 5 second threshold
			this.metrics.memoryUsage > 100 * 1024 * 1024
		) // 100MB threshold
	}
}
```

## Security Considerations

### File Access Control

```typescript
/**
 * Ensures silent mode operations respect file access controls
 */
export class SilentModeSecurityManager {
	/**
	 * Validates that a file operation is allowed in silent mode
	 */
	public validateOperation(operation: FileOperation): ValidationResult {
		// Check if file is in a protected directory
		if (this.isProtectedPath(operation.filePath)) {
			return { allowed: false, reason: "protected_path" }
		}

		// Check if operation exceeds size limits
		if (this.exceedsSizeLimits(operation)) {
			return { allowed: false, reason: "size_limit" }
		}

		// Check file permissions
		if (!this.hasRequiredPermissions(operation)) {
			return { allowed: false, reason: "insufficient_permissions" }
		}

		return { allowed: true }
	}

	/**
	 * Sanitizes file paths to prevent directory traversal
	 */
	public sanitizeFilePath(filePath: string, basePath: string): string {
		const normalized = path.normalize(filePath)
		const resolved = path.resolve(basePath, normalized)

		// Ensure the resolved path is within the base path
		if (!resolved.startsWith(path.resolve(basePath))) {
			throw new SecurityError("Path traversal attempt detected")
		}

		return resolved
	}
}
```

## Testing Architecture

### Unit Test Structure

```typescript
/**
 * Test utilities for silent mode functionality
 */
export class SilentModeTestUtils {
	/**
	 * Creates a mock silent mode environment
	 */
	public static createMockEnvironment(): MockSilentEnvironment {
		return {
			mockFileSystem: new MockFileSystem(),
			mockVSCode: new MockVSCodeAPI(),
			mockBufferManager: new MockBufferManager(),
			mockChangeTracker: new MockChangeTracker(),
		}
	}

	/**
	 * Simulates file operations for testing
	 */
	public static async simulateFileOperations(
		operations: FileOperation[],
		environment: MockSilentEnvironment,
	): Promise<SimulationResult> {
		const controller = new SilentModeController(environment.mockTask, environment.mockSettings)

		const results = []
		for (const operation of operations) {
			const result = await controller.executeInSilentMode(operation)
			results.push(result)
		}

		return { results, finalState: controller.getState() }
	}
}
```

This technical design provides the detailed architecture and implementation specifications needed to build the Silent Mode feature effectively. Each component is designed to be testable, maintainable, and integrate smoothly with the existing Roo codebase.
