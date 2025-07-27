// npx vitest core/task/__tests__/Task.sticky-mode.spec.ts

import * as os from "os"
import * as path from "path"
import * as vscode from "vscode"
import { TelemetryService } from "@roo-code/telemetry"
import { Task } from "../Task"
import { ClineProvider } from "../../webview/ClineProvider"
import { ContextProxy } from "../../config/ContextProxy"

// Mock setup
vi.mock("delay", () => ({
	__esModule: true,
	default: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("fs/promises", async (importOriginal) => {
	const actual = (await importOriginal()) as Record<string, any>
	return {
		...actual,
		mkdir: vi.fn().mockResolvedValue(undefined),
		writeFile: vi.fn().mockResolvedValue(undefined),
		readFile: vi.fn().mockResolvedValue("[]"),
		unlink: vi.fn().mockResolvedValue(undefined),
		rmdir: vi.fn().mockResolvedValue(undefined),
	}
})

// Mock taskMetadata
vi.mock("../../task-persistence", () => ({
	readApiMessages: vi.fn().mockResolvedValue([]),
	saveApiMessages: vi.fn().mockResolvedValue(undefined),
	readTaskMessages: vi.fn().mockResolvedValue([]),
	saveTaskMessages: vi.fn().mockResolvedValue(undefined),
	taskMetadata: vi.fn().mockImplementation(async (options) => ({
		historyItem: {
			id: options.taskId,
			ts: Date.now(),
			task: "Test task",
			tokensIn: 0,
			tokensOut: 0,
			cacheWrites: 0,
			cacheReads: 0,
			totalCost: 0,
			size: 0,
			workspace: options.workspace,
			mode: options.mode,
		},
		tokenUsage: {
			totalTokensIn: 0,
			totalTokensOut: 0,
			totalCacheWrites: 0,
			totalCacheReads: 0,
			totalCost: 0,
			contextTokens: 0,
		},
	})),
}))

vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [
			{
				uri: { fsPath: "/mock/workspace/path" },
				name: "mock-workspace",
				index: 0,
			},
		],
		fs: {
			stat: vi.fn().mockResolvedValue({ type: 1 }), // FileType.File = 1
		},
		createFileSystemWatcher: vi.fn().mockReturnValue({
			onDidCreate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			onDidChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			onDidDelete: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			dispose: vi.fn(),
		}),
		onDidChangeWorkspaceFolders: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		getConfiguration: vi.fn().mockReturnValue({
			get: vi.fn().mockReturnValue([]),
			update: vi.fn(),
		}),
		onDidChangeConfiguration: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		onDidSaveTextDocument: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		onDidChangeTextDocument: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		onDidOpenTextDocument: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		onDidCloseTextDocument: vi.fn().mockReturnValue({ dispose: vi.fn() }),
	},
	window: {
		createTextEditorDecorationType: vi.fn().mockReturnValue({
			dispose: vi.fn(),
		}),
		showInformationMessage: vi.fn(),
		showWarningMessage: vi.fn(),
		showErrorMessage: vi.fn(),
		activeTextEditor: undefined,
		visibleTextEditors: [],
		onDidChangeActiveTextEditor: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		onDidChangeVisibleTextEditors: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		onDidChangeTextEditorSelection: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		onDidChangeTextEditorVisibleRanges: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		onDidChangeTextEditorOptions: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		onDidChangeTextEditorViewColumn: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		onDidCloseTerminal: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		onDidOpenTerminal: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		onDidChangeActiveTerminal: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		onDidChangeTerminalState: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		state: { focused: true },
		onDidChangeWindowState: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		showTextDocument: vi.fn(),
		showNotebookDocument: vi.fn(),
		showQuickPick: vi.fn(),
		showWorkspaceFolderPick: vi.fn(),
		showOpenDialog: vi.fn(),
		showSaveDialog: vi.fn(),
		showInputBox: vi.fn(),
		createTreeView: vi.fn(),
		createWebviewPanel: vi.fn(),
		setStatusBarMessage: vi.fn(),
		withScmProgress: vi.fn(),
		withProgress: vi.fn(),
		createStatusBarItem: vi.fn(),
		createOutputChannel: vi.fn(),
		createWebviewTextEditorInset: vi.fn(),
		createTerminal: vi.fn(),
		registerTreeDataProvider: vi.fn(),
		registerUriHandler: vi.fn(),
		registerWebviewPanelSerializer: vi.fn(),
		tabGroups: {
			all: [],
			activeTabGroup: undefined,
			onDidChangeTabGroups: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			onDidChangeTabs: vi.fn().mockReturnValue({ dispose: vi.fn() }),
		},
	},
	env: {
		uriScheme: "vscode",
		language: "en",
		appName: "Visual Studio Code",
		machineId: "test-machine-id",
	},
	Uri: {
		file: vi.fn().mockImplementation((path) => ({ fsPath: path, scheme: "file" })),
		parse: vi.fn().mockImplementation((str) => ({ fsPath: str, scheme: "file" })),
		joinPath: vi.fn().mockImplementation((base, ...paths) => ({
			fsPath: [base.fsPath, ...paths].join("/"),
			scheme: "file",
		})),
	},
	ExtensionMode: {
		Production: 1,
		Development: 2,
		Test: 3,
	},
	RelativePattern: vi.fn().mockImplementation((base, pattern) => ({
		base,
		pattern,
	})),
	version: "1.85.0",
	commands: {
		executeCommand: vi.fn().mockResolvedValue(undefined),
		registerCommand: vi.fn(),
		registerTextEditorCommand: vi.fn(),
		getCommands: vi.fn().mockResolvedValue([]),
	},
}))

vi.mock("../../mentions", () => ({
	parseMentions: vi.fn().mockImplementation((text) => {
		return Promise.resolve(`processed: ${text}`)
	}),
}))

vi.mock("../../../integrations/misc/extract-text", () => ({
	extractTextFromFile: vi.fn().mockResolvedValue("Mock file content"),
}))

vi.mock("../../environment/getEnvironmentDetails", () => ({
	getEnvironmentDetails: vi.fn().mockResolvedValue(""),
}))

vi.mock("../../../utils/storage", () => ({
	getTaskDirectoryPath: vi
		.fn()
		.mockImplementation((globalStoragePath, taskId) => Promise.resolve(`${globalStoragePath}/tasks/${taskId}`)),
}))

vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockResolvedValue(false),
}))

describe("Task - Sticky Mode", () => {
	let mockProvider: any
	let mockApiConfig: any
	let mockOutputChannel: any
	let mockExtensionContext: vscode.ExtensionContext

	beforeEach(() => {
		if (!TelemetryService.hasInstance()) {
			TelemetryService.createInstance([])
		}

		// Setup mock extension context
		const storageUri = {
			fsPath: path.join(os.tmpdir(), "test-storage"),
		}

		mockExtensionContext = {
			globalState: {
				get: vi.fn().mockImplementation((key) => {
					if (key === "mode") return "architect"
					return undefined
				}),
				update: vi.fn().mockImplementation(() => Promise.resolve()),
				keys: vi.fn().mockReturnValue([]),
			},
			globalStorageUri: storageUri,
			workspaceState: {
				get: vi.fn().mockImplementation(() => undefined),
				update: vi.fn().mockImplementation(() => Promise.resolve()),
				keys: vi.fn().mockReturnValue([]),
			},
			secrets: {
				get: vi.fn().mockImplementation(() => Promise.resolve(undefined)),
				store: vi.fn().mockImplementation(() => Promise.resolve()),
				delete: vi.fn().mockImplementation(() => Promise.resolve()),
			},
			extensionUri: {
				fsPath: "/mock/extension/path",
			},
			extension: {
				packageJSON: {
					version: "1.0.0",
				},
			},
		} as unknown as vscode.ExtensionContext

		// Setup mock output channel
		mockOutputChannel = {
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			show: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
		}

		// Setup mock provider
		mockProvider = new ClineProvider(
			mockExtensionContext,
			mockOutputChannel,
			"sidebar",
			new ContextProxy(mockExtensionContext),
		) as any

		// Mock provider methods
		mockProvider.postMessageToWebview = vi.fn().mockResolvedValue(undefined)
		mockProvider.postStateToWebview = vi.fn().mockResolvedValue(undefined)
		mockProvider.updateTaskHistory = vi.fn().mockResolvedValue([])
		mockProvider.getState = vi.fn().mockResolvedValue({
			mode: "architect",
		})

		// Setup mock API configuration
		mockApiConfig = {
			apiProvider: "anthropic",
			apiModelId: "claude-3-5-sonnet-20241022",
			apiKey: "test-api-key",
		}
	})

	describe("saveClineMessages", () => {
		it("should include task's own mode in task metadata", async () => {
			// Set provider mode
			mockProvider.getState.mockResolvedValue({
				mode: "architect",
			})

			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			// Wait for async mode initialization
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Import taskMetadata mock
			const { taskMetadata } = await import("../../task-persistence")

			// Save messages
			await (task as any).saveClineMessages()

			// Verify taskMetadata was called with the task's mode
			expect(taskMetadata).toHaveBeenCalledWith(
				expect.objectContaining({
					mode: "architect",
				}),
			)
		})

		it("should preserve task's initial mode across multiple saves", async () => {
			// Start with code mode
			mockProvider.getState.mockResolvedValue({
				mode: "code",
			})

			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			// Wait for async mode initialization
			await new Promise((resolve) => setTimeout(resolve, 10))

			const { taskMetadata } = await import("../../task-persistence")
			vi.mocked(taskMetadata).mockClear()

			// First save with code mode
			await (task as any).saveClineMessages()
			expect(taskMetadata).toHaveBeenCalledWith(
				expect.objectContaining({
					mode: "code",
				}),
			)

			// Change provider mode to debug
			mockProvider.getState.mockResolvedValue({
				mode: "debug",
			})

			// Save again - should still use task's original mode
			await (task as any).saveClineMessages()
			expect(taskMetadata).toHaveBeenLastCalledWith(
				expect.objectContaining({
					mode: "code", // Should still be code, not debug
				}),
			)
		})
	})

	describe("Task creation with history", () => {
		it("should restore mode from history metadata", async () => {
			const historyItem = {
				id: "test-task-id",
				number: 1,
				ts: Date.now(),
				task: "historical task",
				tokensIn: 100,
				tokensOut: 200,
				cacheWrites: 0,
				cacheReads: 0,
				totalCost: 0.001,
				size: 0,
				workspace: "/test",
				mode: "architect", // Saved mode
			}

			// Create task with history
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				historyItem,
			})

			// The task should have the mode from history
			expect((task as any).taskMode).toBe("architect")
		})
	})

	describe("Subtask handling", () => {
		it("should maintain parent task mode when creating subtasks", async () => {
			// Create parent task with architect mode
			mockProvider.getState.mockResolvedValue({
				mode: "architect",
			})

			const parentTask = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "parent task",
				startTask: false,
			})

			// Wait for async mode initialization
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Change provider mode to code
			mockProvider.getState.mockResolvedValue({
				mode: "code",
			})

			// Create subtask - should get current provider mode
			const childTask = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "child task",
				parentTask,
				rootTask: parentTask,
				startTask: false,
			})

			// Wait for async mode initialization
			await new Promise((resolve) => setTimeout(resolve, 10))

			const { taskMetadata } = await import("../../task-persistence")
			vi.mocked(taskMetadata).mockClear()

			// Save parent task - should have architect mode
			await (parentTask as any).saveClineMessages()
			expect(taskMetadata).toHaveBeenCalledWith(
				expect.objectContaining({
					mode: "architect",
				}),
			)

			// Save child task - should have code mode
			await (childTask as any).saveClineMessages()
			expect(taskMetadata).toHaveBeenCalledWith(
				expect.objectContaining({
					mode: "code",
				}),
			)

			// Parent task mode should remain architect when saved again
			await (parentTask as any).saveClineMessages()
			expect(taskMetadata).toHaveBeenLastCalledWith(
				expect.objectContaining({
					mode: "architect",
				}),
			)
		})
	})

	describe("Error handling", () => {
		it("should handle missing mode gracefully", async () => {
			// Provider returns state without mode
			mockProvider.getState.mockResolvedValue({})

			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			// Wait for async mode initialization
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Task should use defaultModeSlug when provider returns no mode
			expect((task as any).taskMode).toBe("architect")

			const { taskMetadata } = await import("../../task-persistence")
			vi.mocked(taskMetadata).mockClear()

			// Should not throw when saving without mode
			await expect((task as any).saveClineMessages()).resolves.not.toThrow()

			// Mode should be defaultModeSlug (architect) in metadata
			expect(taskMetadata).toHaveBeenCalledWith(
				expect.objectContaining({
					mode: "architect", // defaultModeSlug
				}),
			)
		})

		it("should handle provider.getState errors", async () => {
			// Provider throws error
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Create a new mock provider that will throw an error
			const errorProvider = {
				...mockProvider,
				getState: vi.fn().mockRejectedValue(new Error("Provider error")),
			}

			const task = new Task({
				provider: errorProvider as any,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			// Wait a bit for the promise rejection to settle
			await new Promise((resolve) => setTimeout(resolve, 20))

			// Task should still be created without throwing
			expect(task).toBeDefined()
			// Should fall back to defaultModeSlug
			expect((task as any).taskMode).toBe("architect")

			const { taskMetadata } = await import("../../task-persistence")
			vi.mocked(taskMetadata).mockClear()

			// Should not throw when saving
			await expect((task as any).saveClineMessages()).resolves.not.toThrow()

			// Verify it uses the default mode
			expect(taskMetadata).toHaveBeenCalledWith(
				expect.objectContaining({
					mode: "architect", // defaultModeSlug
				}),
			)

			// Restore console.error
			consoleErrorSpy.mockRestore()
		})
	})
})
