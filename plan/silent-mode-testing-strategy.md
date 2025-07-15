# Silent Mode Testing Strategy

## Testing Overview

This document outlines the comprehensive testing approach for Silent Mode, covering unit tests, integration tests, end-to-end scenarios, performance testing, and user acceptance testing.

## Testing Pyramid

```
                    ┌─────────────────┐
                    │   E2E Tests     │ ← User Workflows
                    │   (Manual +     │
                    │   Automated)    │
                    └─────────────────┘
                  ┌───────────────────────┐
                  │  Integration Tests    │ ← Component Interaction
                  │  (API + UI + System)  │
                  └───────────────────────┘
              ┌─────────────────────────────────┐
              │        Unit Tests               │ ← Individual Components
              │  (Logic + Components + Utils)   │
              └─────────────────────────────────┘
```

## Unit Testing

### Core Components Testing

#### Silent Mode Detector Tests

```typescript
// src/core/silent-mode/__tests__/SilentModeDetector.test.ts

describe("SilentModeDetector", () => {
	let detector: SilentModeDetector
	let mockVSCode: MockVSCodeAPI

	beforeEach(() => {
		mockVSCode = createMockVSCodeAPI()
		detector = new SilentModeDetector(mockVSCode)
	})

	describe("shouldActivateSilentMode", () => {
		it("should return false when global setting is disabled", () => {
			const result = detector.shouldActivateSilentMode("/path/to/file.ts", false)
			expect(result).toBe(false)
		})

		it("should return false when file is actively being edited", () => {
			mockVSCode.mockActiveDocument("/path/to/file.ts", { isDirty: true })
			const result = detector.shouldActivateSilentMode("/path/to/file.ts", true)
			expect(result).toBe(false)
		})

		it("should return true when file is not open and setting is enabled", () => {
			mockVSCode.mockNoActiveDocument()
			const result = detector.shouldActivateSilentMode("/path/to/file.ts", true)
			expect(result).toBe(true)
		})

		it("should return false when file is in focused editor", () => {
			mockVSCode.mockActiveEditor("/path/to/file.ts")
			const result = detector.shouldActivateSilentMode("/path/to/file.ts", true)
			expect(result).toBe(false)
		})
	})

	describe("edge cases", () => {
		it("should handle case-insensitive path comparison on Windows", () => {
			// Windows path handling test
		})

		it("should handle symlinks correctly", () => {
			// Symlink resolution test
		})

		it("should handle workspace-relative paths", () => {
			// Relative path test
		})
	})
})
```

#### Change Tracker Tests

```typescript
// src/core/silent-mode/__tests__/ChangeTracker.test.ts

describe("ChangeTracker", () => {
	let changeTracker: ChangeTracker

	beforeEach(() => {
		changeTracker = new ChangeTracker()
	})

	describe("trackChange", () => {
		it("should track file creation", () => {
			const change: FileChange = {
				filePath: "/path/to/new-file.ts",
				operation: "create",
				newContent: 'export const foo = "bar"',
				timestamp: Date.now(),
			}

			changeTracker.trackChange("task-123", change)
			const changes = changeTracker.getChangesForTask("task-123")

			expect(changes).toHaveLength(1)
			expect(changes[0]).toEqual(change)
		})

		it("should track multiple changes to same file", () => {
			const change1: FileChange = {
				filePath: "/path/to/file.ts",
				operation: "modify",
				originalContent: "const a = 1",
				newContent: "const a = 2",
				timestamp: Date.now(),
			}

			const change2: FileChange = {
				filePath: "/path/to/file.ts",
				operation: "modify",
				originalContent: "const a = 2",
				newContent: "const a = 3",
				timestamp: Date.now() + 1000,
			}

			changeTracker.trackChange("task-123", change1)
			changeTracker.trackChange("task-123", change2)

			const changes = changeTracker.getChangesForTask("task-123")
			expect(changes).toHaveLength(2)
		})
	})

	describe("generateSummary", () => {
		it("should generate accurate summary for mixed operations", () => {
			// Track various changes
			changeTracker.trackChange("task-123", createFileChange("create"))
			changeTracker.trackChange("task-123", modifyFileChange("modify"))
			changeTracker.trackChange("task-123", deleteFileChange("delete"))

			const summary = changeTracker.generateSummary("task-123")

			expect(summary.totalFiles).toBe(3)
			expect(summary.additions).toBe(1)
			expect(summary.modifications).toBe(1)
			expect(summary.deletions).toBe(1)
		})
	})
})
```

#### Buffer Manager Tests

```typescript
// src/core/silent-mode/__tests__/BufferManager.test.ts

describe("BufferManager", () => {
	let bufferManager: BufferManager

	beforeEach(() => {
		bufferManager = new BufferManager()
	})

	describe("bufferFileOperation", () => {
		it("should buffer file write operations", async () => {
			const operation: FileOperation = {
				type: "write",
				filePath: "/path/to/file.ts",
				content: 'export const foo = "bar"',
			}

			const result = await bufferManager.bufferFileOperation("/path/to/file.ts", operation)

			expect(result.success).toBe(true)
			expect(bufferManager.getBufferedContent("/path/to/file.ts")).toBe(operation.content)
		})

		it("should enforce memory limits", async () => {
			// Create large content that exceeds buffer limit
			const largeContent = "x".repeat(60 * 1024 * 1024) // 60MB

			const operation: FileOperation = {
				type: "write",
				filePath: "/path/to/large-file.ts",
				content: largeContent,
			}

			await expect(bufferManager.bufferFileOperation("/path/to/large-file.ts", operation)).rejects.toThrow(
				"Buffer size limit exceeded",
			)
		})
	})

	describe("flushBuffers", () => {
		it("should apply all buffered changes to file system", async () => {
			const mockFS = createMockFileSystem()
			bufferManager.setFileSystem(mockFS)

			// Buffer multiple operations
			await bufferManager.bufferFileOperation("/file1.ts", writeOperation("content1"))
			await bufferManager.bufferFileOperation("/file2.ts", writeOperation("content2"))

			const result = await bufferManager.flushBuffers(["/file1.ts", "/file2.ts"])

			expect(result.success).toHaveLength(2)
			expect(result.failed).toHaveLength(0)
			expect(mockFS.getContent("/file1.ts")).toBe("content1")
			expect(mockFS.getContent("/file2.ts")).toBe("content2")
		})
	})
})
```

### Tool Integration Tests

#### Silent Tool Wrapper Tests

```typescript
// src/core/silent-mode/__tests__/SilentToolWrapper.test.ts

describe("SilentToolWrapper", () => {
	let wrapper: SilentToolWrapper
	let mockController: MockSilentModeController

	beforeEach(() => {
		mockController = createMockSilentModeController()
		wrapper = new SilentToolWrapper(mockController)
	})

	describe("wrapFileTool", () => {
		it("should delegate to original tool when silent mode is not active", async () => {
			const originalTool = jest.fn().mockResolvedValue({ success: true })
			mockController.shouldOperateInSilentMode.mockReturnValue(false)

			const result = await wrapper.wrapFileTool(
				originalTool,
				{ operation: { type: "write", filePath: "/file.ts" } },
				"arg1",
				"arg2",
			)

			expect(originalTool).toHaveBeenCalledWith(
				{ operation: { type: "write", filePath: "/file.ts" } },
				"arg1",
				"arg2",
			)
			expect(result).toEqual({ success: true })
		})

		it("should execute in silent mode when conditions are met", async () => {
			const originalTool = jest.fn()
			mockController.shouldOperateInSilentMode.mockReturnValue(true)
			mockController.executeInSilentMode.mockResolvedValue({ success: true, silent: true })

			const result = await wrapper.wrapFileTool(
				originalTool,
				{ operation: { type: "write", filePath: "/file.ts" } },
				"arg1",
				"arg2",
			)

			expect(originalTool).not.toHaveBeenCalled()
			expect(mockController.executeInSilentMode).toHaveBeenCalled()
			expect(result).toEqual({ success: true, silent: true })
		})
	})
})
```

## Integration Testing

### File Tool Integration

#### Write to File Tool Integration Test

```typescript
// src/core/tools/__tests__/writeToFileTool.integration.test.ts

describe("writeToFileTool with Silent Mode", () => {
	let task: MockTask
	let silentController: SilentModeController

	beforeEach(async () => {
		task = createMockTask()
		silentController = new SilentModeController(task, { silentMode: true })
		task.setSilentModeController(silentController)
	})

	it("should write files silently when not actively editing", async () => {
		// Mock file not being actively edited
		jest.spyOn(vscode.window, "activeTextEditor", "get").mockReturnValue(undefined)

		const block: ToolUse = {
			params: {
				path: "src/new-file.ts",
				content: 'export const foo = "bar"',
			},
		}

		const pushToolResult = jest.fn()

		await writeToFileTool(task, block, mockAskApproval, mockHandleError, pushToolResult, mockRemoveClosingTag)

		// Verify file was not actually written to disk yet
		expect(fs.existsSync(path.resolve(task.cwd, "src/new-file.ts"))).toBe(false)

		// Verify change was tracked for review
		const changes = silentController.getTrackedChanges()
		expect(changes).toHaveLength(1)
		expect(changes[0].filePath).toBe("src/new-file.ts")
	})

	it("should fall back to interactive mode when file is being actively edited", async () => {
		// Mock file being actively edited
		const mockDocument = createMockTextDocument("src/active-file.ts")
		const mockEditor = createMockTextEditor(mockDocument)
		jest.spyOn(vscode.window, "activeTextEditor", "get").mockReturnValue(mockEditor)

		const block: ToolUse = {
			params: {
				path: "src/active-file.ts",
				content: 'export const foo = "updated"',
			},
		}

		const askApproval = jest.fn().mockResolvedValue(true)
		const pushToolResult = jest.fn()

		await writeToFileTool(task, block, askApproval, mockHandleError, pushToolResult, mockRemoveClosingTag)

		// Verify approval was requested (interactive mode)
		expect(askApproval).toHaveBeenCalled()

		// Verify no silent mode tracking
		const changes = silentController.getTrackedChanges()
		expect(changes).toHaveLength(0)
	})
})
```

### UI Integration Tests

#### Settings Integration Test

```typescript
// webview-ui/src/components/settings/__tests__/SettingsView.integration.test.tsx

describe('SettingsView Silent Mode Integration', () => {
    let mockVSCode: MockVSCodeAPI

    beforeEach(() => {
        mockVSCode = createMockVSCodeAPI()
        ;(window as any).vscode = mockVSCode
    })

    it('should toggle silent mode setting', async () => {
        const { getByTestId } = render(
            <SettingsView
                onDone={() => {}}
                targetSection={undefined}
            />
        )

        const silentModeCheckbox = getByTestId('silent-mode-checkbox')

        // Initially unchecked
        expect(silentModeCheckbox).not.toBeChecked()

        // Toggle on
        fireEvent.click(silentModeCheckbox)
        expect(silentModeCheckbox).toBeChecked()

        // Verify message sent to extension
        expect(mockVSCode.postMessage).toHaveBeenCalledWith({
            type: 'silentMode',
            bool: true
        })
    })

    it('should persist silent mode setting across sessions', async () => {
        // Test setting persistence
        const initialState = {
            silentMode: true,
            // ... other settings
        }

        const { rerender } = render(
            <ExtensionStateContextProvider>
                <SettingsView onDone={() => {}} />
            </ExtensionStateContextProvider>
        )

        // Simulate extension reload with persisted state
        rerender(
            <ExtensionStateContextProvider initialState={initialState}>
                <SettingsView onDone={() => {}} />
            </ExtensionStateContextProvider>
        )

        const silentModeCheckbox = screen.getByTestId('silent-mode-checkbox')
        expect(silentModeCheckbox).toBeChecked()
    })
})
```

## End-to-End Testing

### Complete Silent Mode Workflow Test

```typescript
// apps/vscode-e2e/src/suite/silent-mode/complete-workflow.test.ts

describe("Silent Mode Complete Workflow", function () {
	this.timeout(60000) // Extended timeout for E2E

	let workspaceDir: string
	let api: RooCodeAPI

	beforeEach(async () => {
		workspaceDir = await createTempWorkspace()
		api = await initializeRooCodeAPI()

		// Enable silent mode
		await api.setConfiguration({ silentMode: true })
	})

	afterEach(async () => {
		await cleanupTempWorkspace(workspaceDir)
	})

	it("should complete full silent mode workflow", async () => {
		// 1. Create initial file that user is working on
		const activeFile = path.join(workspaceDir, "user-work.ts")
		await fs.writeFile(activeFile, 'const userWork = "in progress"')

		// 2. Open the file in editor (simulate user actively working)
		await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(activeFile))

		// 3. Start a task that would normally interrupt the user
		const taskPromise = api.startNewTask({
			configuration: { silentMode: true },
			text: "Create a new utility file with helper functions",
		})

		// 4. Verify user's file remains active and unchanged
		await waitFor(() => {
			const activeEditor = vscode.window.activeTextEditor
			expect(activeEditor?.document.uri.fsPath).toBe(activeFile)
		})

		// 5. Wait for task completion notification
		await waitForNotification("Task completed silently")

		// 6. Verify new file was not opened automatically
		const visibleFiles = vscode.window.visibleTextEditors.map((e) => e.document.uri.fsPath)
		expect(visibleFiles).toEqual([activeFile])

		// 7. Open review interface
		await vscode.commands.executeCommand("roo-code.reviewSilentModeChanges")

		// 8. Verify review panel shows expected changes
		const reviewPanel = await waitForWebviewPanel("Silent Mode Review")
		expect(reviewPanel).toBeDefined()

		// 9. Approve changes
		await reviewPanel.webview.postMessage({ type: "approveAll" })

		// 10. Verify files were created after approval
		const utilityFile = path.join(workspaceDir, "utils.ts")
		expect(await fs.pathExists(utilityFile)).toBe(true)

		// 11. Verify user's original file is still active
		const finalActiveEditor = vscode.window.activeTextEditor
		expect(finalActiveEditor?.document.uri.fsPath).toBe(activeFile)
	})

	it("should handle memory overflow gracefully", async () => {
		// Test with task that would exceed buffer limits
		const largeTaskPromise = api.startNewTask({
			configuration: { silentMode: true },
			text: "Generate 100 large component files with detailed implementations",
		})

		// Should receive fallback notification
		await waitForNotification("Silent Mode switched to Interactive Mode")

		// Task should continue in interactive mode
		await waitFor(() => {
			const activeEditor = vscode.window.activeTextEditor
			return activeEditor?.document.uri.fsPath.includes("Component")
		})
	})

	it("should handle file conflicts", async () => {
		// Create a file
		const conflictFile = path.join(workspaceDir, "conflict.ts")
		await fs.writeFile(conflictFile, "original content")

		// Start silent task that modifies the file
		const taskPromise = api.startNewTask({
			configuration: { silentMode: true },
			text: "Modify conflict.ts to add new functions",
		})

		// Modify the file externally while task is running
		await fs.writeFile(conflictFile, "externally modified content")

		// Should receive conflict notification
		await waitForNotification("File conflict detected")

		// Review should show conflict resolution options
		await vscode.commands.executeCommand("roo-code.reviewSilentModeChanges")
		const reviewPanel = await waitForWebviewPanel("Silent Mode Review")

		// Should show conflict indicators
		expect(reviewPanel.webview.html).toContain("conflict detected")
	})
})
```

### Performance Testing

```typescript
// apps/vscode-e2e/src/suite/silent-mode/performance.test.ts

describe("Silent Mode Performance", function () {
	this.timeout(300000) // 5 minute timeout for performance tests

	it("should handle large file operations within memory limits", async () => {
		const startMemory = process.memoryUsage()

		// Task that creates many files
		await api.startNewTask({
			configuration: { silentMode: true },
			text: "Create 50 TypeScript modules with comprehensive interfaces and implementations",
		})

		await waitForNotification("Task completed silently")

		const endMemory = process.memoryUsage()
		const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed

		// Should not exceed 100MB additional memory
		expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024)
	})

	it("should complete typical tasks within time limits", async () => {
		const startTime = Date.now()

		await api.startNewTask({
			configuration: { silentMode: true },
			text: "Add TypeScript types to 10 existing JavaScript files",
		})

		await waitForNotification("Task completed silently")

		const duration = Date.now() - startTime

		// Should not add more than 20% overhead compared to interactive mode
		expect(duration).toBeLessThan(expectedInteractiveTime * 1.2)
	})

	it("should handle diff generation efficiently for large files", async () => {
		// Create large file
		const largeContent = generateLargeFile(1000000) // 1M characters
		const largeFile = path.join(workspaceDir, "large-file.ts")
		await fs.writeFile(largeFile, largeContent)

		const startTime = Date.now()

		await api.startNewTask({
			configuration: { silentMode: true },
			text: "Add error handling to all functions in large-file.ts",
		})

		await waitForNotification("Task completed silently")

		// Open review to trigger diff generation
		await vscode.commands.executeCommand("roo-code.reviewSilentModeChanges")

		const diffGenerationTime = Date.now() - startTime

		// Diff generation should complete within 5 seconds
		expect(diffGenerationTime).toBeLessThan(5000)
	})
})
```

## User Acceptance Testing

### Manual Test Scenarios

#### Scenario 1: Deep Work Protection

```
Test: User working on complex algorithm implementation
Steps:
1. Open complex algorithm file in editor
2. Start implementing new function
3. Ask Roo to "Add unit tests for the utility functions"
4. Continue working on algorithm without interruption
5. Receive notification when tests are ready
6. Review and approve test files
7. Verify original work was undisturbed

Expected Results:
- No interruption during algorithm implementation
- Test files created in background
- Clear notification when ready
- Easy review and approval process
- Context preserved throughout
```

#### Scenario 2: Multi-Project Workflow

```
Test: Developer working across multiple projects
Steps:
1. Have Project A open in main editor
2. Ask Roo to "Update documentation in Project B"
3. Continue working in Project A
4. Switch to Project B when convenient
5. Review Roo's documentation changes
6. Apply approved changes

Expected Results:
- No automatic project switching
- Work continues uninterrupted in Project A
- Documentation changes visible in review
- User controls when to engage with changes
```

#### Scenario 3: Code Review Assistance

```
Test: Developer reviewing pull request while Roo helps
Steps:
1. Open pull request for review
2. Start reviewing code changes
3. Ask Roo to "Fix linting issues in the PR files"
4. Continue code review without distraction
5. Complete review and provide feedback
6. Review Roo's lint fixes separately
7. Apply fixes after completing review

Expected Results:
- Code review flow uninterrupted
- Lint fixes available for separate review
- No confusion between PR changes and fixes
- Clear separation of concerns
```

### Automated Acceptance Tests

```typescript
// acceptance-tests/silent-mode.spec.ts

describe("Silent Mode Acceptance Tests", () => {
	test("AC1: Silent mode setting available in VS Code settings", async () => {
		const settings = vscode.workspace.getConfiguration("roo-cline")
		expect(settings.inspect("silentMode")).toBeDefined()
	})

	test("AC2: Tasks run without opening/switching files when enabled", async () => {
		await enableSilentMode()

		const originalActiveFile = vscode.window.activeTextEditor?.document.uri.fsPath

		await runTask("Create new helper functions in utils.ts")

		// Active file should remain unchanged
		expect(vscode.window.activeTextEditor?.document.uri.fsPath).toBe(originalActiveFile)

		// No new tabs should be opened
		const tabCountAfter = vscode.window.tabGroups.all.flatMap((g) => g.tabs).length
		expect(tabCountAfter).toBe(initialTabCount)
	})

	test("AC3: Task completion notification appears", async () => {
		await enableSilentMode()

		const notificationPromise = waitForNotification("Task completed silently")

		await runTask("Add error handling to API endpoints")

		await expect(notificationPromise).resolves.toBeDefined()
	})

	test("AC4: Diff review interface shows all changes", async () => {
		await enableSilentMode()
		await runTask("Refactor user authentication code")

		await vscode.commands.executeCommand("roo-code.reviewSilentModeChanges")

		const reviewPanel = await waitForWebviewPanel("Silent Mode Review")
		const changedFiles = await getChangedFilesFromReview(reviewPanel)

		expect(changedFiles.length).toBeGreaterThan(0)
		expect(changedFiles.every((f) => f.diff)).toBe(true)
	})

	test("AC5: User can approve/reject changes", async () => {
		await enableSilentMode()
		await runTask("Add TypeScript types to components")

		const reviewPanel = await openReviewPanel()

		// Test approve all
		await reviewPanel.webview.postMessage({ type: "approveAll" })
		await waitForApprovalCompletion()

		// Verify files were created/modified
		const expectedFiles = await getExpectedFiles()
		expect(expectedFiles.every((f) => fs.existsSync(f))).toBe(true)
	})

	test("AC6: Quick toggle command works", async () => {
		// Test command exists
		const commands = await vscode.commands.getCommands()
		expect(commands).toContain("roo-code.toggleSilentMode")

		// Test toggle functionality
		await vscode.commands.executeCommand("roo-code.toggleSilentMode")
		const silentModeEnabled = vscode.workspace.getConfiguration("roo-cline").get("silentMode")

		expect(silentModeEnabled).toBe(true)

		await vscode.commands.executeCommand("roo-code.toggleSilentMode")
		const silentModeDisabled = vscode.workspace.getConfiguration("roo-cline").get("silentMode")

		expect(silentModeDisabled).toBe(false)
	})

	test("AC7: No interference with existing workflows when disabled", async () => {
		await disableSilentMode()

		const taskBehavior = await runTaskAndMonitorBehavior("Create new components")

		// Should behave exactly like original implementation
		expect(taskBehavior.filesOpened).toBeGreaterThan(0)
		expect(taskBehavior.tabsSwitched).toBeGreaterThan(0)
		expect(taskBehavior.interactiveApproval).toBe(true)
	})
})
```

## Test Data and Utilities

### Mock Factories

```typescript
// test-utils/mocks.ts

export function createMockVSCodeAPI(): MockVSCodeAPI {
	return {
		window: {
			activeTextEditor: undefined,
			visibleTextEditors: [],
			tabGroups: { all: [] },
			showInformationMessage: jest.fn(),
			showErrorMessage: jest.fn(),
			createWebviewPanel: jest.fn(),
		},
		workspace: {
			workspaceFolders: [{ uri: { fsPath: "/mock/workspace" } }],
			getConfiguration: jest.fn(),
			textDocuments: [],
		},
		commands: {
			executeCommand: jest.fn(),
			registerCommand: jest.fn(),
		},
	}
}

export function createMockTask(options: Partial<TaskOptions> = {}): MockTask {
	return {
		taskId: "test-task-123",
		cwd: "/mock/workspace",
		silentModeEnabled: false,
		getSilentModeController: jest.fn(),
		setSilentModeController: jest.fn(),
		...options,
	}
}

export function createMockFileSystem(): MockFileSystem {
	const files = new Map<string, string>()

	return {
		readFile: (path: string) => files.get(path) || "",
		writeFile: (path: string, content: string) => files.set(path, content),
		exists: (path: string) => files.has(path),
		getContent: (path: string) => files.get(path),
		getAllFiles: () => Array.from(files.keys()),
	}
}
```

### Test Scenarios

```typescript
// test-utils/scenarios.ts

export const silentModeTestScenarios = {
	smallTask: {
		description: "Add error handling to single file",
		expectedFiles: 1,
		expectedMemoryUsage: "< 5MB",
		expectedDuration: "< 30s",
	},

	mediumTask: {
		description: "Refactor authentication system across 5 files",
		expectedFiles: 5,
		expectedMemoryUsage: "< 20MB",
		expectedDuration: "< 2min",
	},

	largeTask: {
		description: "Generate test suites for entire project",
		expectedFiles: 25,
		expectedMemoryUsage: "< 50MB",
		expectedDuration: "< 5min",
	},

	conflictScenario: {
		description: "Modify file that gets externally changed",
		expectedConflicts: 1,
		expectedResolution: "user_choice",
	},

	memoryOverflow: {
		description: "Task requiring > 50MB buffer space",
		expectedFallback: "interactive_mode",
		expectedNotification: "Buffer limit reached",
	},
}
```

## Continuous Integration

### Test Pipeline Configuration

```yaml
# .github/workflows/silent-mode-tests.yml

name: Silent Mode Tests

on:
    pull_request:
        paths:
            - "src/core/silent-mode/**"
            - "webview-ui/src/components/silent-mode/**"
            - "src/core/tools/**"

jobs:
    unit-tests:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v3
            - name: Setup Node.js
              uses: actions/setup-node@v3
              with:
                  node-version: "18"
            - name: Install dependencies
              run: npm ci
            - name: Run Silent Mode unit tests
              run: npm run test:silent-mode:unit
            - name: Upload coverage
              uses: codecov/codecov-action@v3

    integration-tests:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v3
            - name: Setup Node.js
              uses: actions/setup-node@v3
            - name: Install dependencies
              run: npm ci
            - name: Run Silent Mode integration tests
              run: npm run test:silent-mode:integration

    e2e-tests:
        runs-on: ${{ matrix.os }}
        strategy:
            matrix:
                os: [ubuntu-latest, windows-latest, macos-latest]
        steps:
            - uses: actions/checkout@v3
            - name: Setup Node.js
              uses: actions/setup-node@v3
            - name: Install dependencies
              run: npm ci
            - name: Run E2E tests
              run: npm run test:e2e:silent-mode
              env:
                  HEADLESS: true

    performance-tests:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v3
            - name: Setup Node.js
              uses: actions/setup-node@v3
            - name: Install dependencies
              run: npm ci
            - name: Run performance tests
              run: npm run test:performance:silent-mode
            - name: Store performance results
              uses: benchmark-action/github-action-benchmark@v1
```

## Test Metrics and Reporting

### Coverage Requirements

- Unit tests: 95% line coverage
- Integration tests: 90% path coverage
- E2E tests: 100% critical user journey coverage

### Performance Benchmarks

- Memory usage: < 50MB for typical tasks
- Task execution overhead: < 20% compared to interactive mode
- Diff generation: < 5 seconds for files up to 10,000 lines
- UI responsiveness: < 100ms for all user interactions

### Quality Gates

- All unit tests must pass
- No regression in existing functionality
- Performance benchmarks met
- Accessibility standards compliance
- Cross-platform compatibility verified

This comprehensive testing strategy ensures Silent Mode is robust, performant, and provides a seamless user experience across all scenarios.
