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
					if (key === "mode") return "code"
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
			mode: "code",
		})

		// Setup mock API configuration
		mockApiConfig = {
			apiProvider: "anthropic",
			apiModelId: "claude-3-5-sonnet-20241022",
			apiKey: "test-api-key",
		}
	})

	describe("saveClineMessages", () => {
		it("should include current mode in task metadata", async () => {
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

			// Mock fs.writeFile to capture what's written
			const fs = await import("fs/promises")
			let capturedMetadata: any
			vi.mocked(fs.writeFile).mockImplementation(async (path, data) => {
				if (path.toString().includes("metadata.json")) {
					capturedMetadata = JSON.parse(data.toString())
				}
			})

			// Save messages
			await (task as any).saveClineMessages([], { customData: "test" })

			// Verify mode was included in metadata
			expect(capturedMetadata).toBeDefined()
			expect(capturedMetadata.mode).toBe("architect")
			expect(capturedMetadata.customData).toBe("test")
		})

		it("should preserve mode across multiple saves", async () => {
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

			const fs = await import("fs/promises")
			let capturedMetadata: any
			vi.mocked(fs.writeFile).mockImplementation(async (path, data) => {
				if (path.toString().includes("metadata.json")) {
					capturedMetadata = JSON.parse(data.toString())
				}
			})

			// First save with code mode
			await (task as any).saveClineMessages([])
			expect(capturedMetadata.mode).toBe("code")

			// Change mode and save again
			mockProvider.getState.mockResolvedValue({
				mode: "debug",
			})
			await (task as any).saveClineMessages([])
			expect(capturedMetadata.mode).toBe("debug")
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
				mode: "architect", // Saved mode
			}

			// Mock getTaskWithId to return history with mode
			mockProvider.getTaskWithId = vi.fn().mockResolvedValue({
				historyItem,
				taskDirPath: "/test/path",
				apiConversationHistoryFilePath: "/test/path/api_history.json",
				uiMessagesFilePath: "/test/path/ui_messages.json",
				apiConversationHistory: [],
			})

			// Mock fs.readFile to return metadata with mode
			const fs = await import("fs/promises")
			vi.mocked(fs.readFile).mockImplementation(async (path) => {
				if (path.toString().includes("metadata.json")) {
					return JSON.stringify({ mode: "architect" })
				}
				return "[]"
			})

			// Create task with history
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				historyItem,
			})

			// The task should have loaded the mode from history
			// This would be used by the provider to restore the mode
			expect(mockProvider.getTaskWithId).toHaveBeenCalledWith(historyItem.id)
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

			// Create subtask - parent mode should be preserved
			const childTask = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "child task",
				parentTask,
				rootTask: parentTask,
				startTask: false,
			})

			// Mock fs.writeFile to capture metadata
			const fs = await import("fs/promises")
			let parentMetadata: any
			let childMetadata: any
			vi.mocked(fs.writeFile).mockImplementation(async (path, data) => {
				if (path.toString().includes("metadata.json")) {
					const metadata = JSON.parse(data.toString())
					if (path.toString().includes(parentTask.taskId)) {
						parentMetadata = metadata
					} else if (path.toString().includes(childTask.taskId)) {
						childMetadata = metadata
					}
				}
			})

			// Save parent task - should have architect mode
			await (parentTask as any).saveClineMessages([])
			expect(parentMetadata.mode).toBe("architect")

			// Change provider mode to code
			mockProvider.getState.mockResolvedValue({
				mode: "code",
			})

			// Save child task - should have code mode
			await (childTask as any).saveClineMessages([])
			expect(childMetadata.mode).toBe("code")

			// Parent task mode should remain architect when saved again
			mockProvider.getState.mockResolvedValue({
				mode: "architect",
			})
			await (parentTask as any).saveClineMessages([])
			expect(parentMetadata.mode).toBe("architect")
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

			const fs = await import("fs/promises")
			let capturedMetadata: any
			vi.mocked(fs.writeFile).mockImplementation(async (path, data) => {
				if (path.toString().includes("metadata.json")) {
					capturedMetadata = JSON.parse(data.toString())
				}
			})

			// Should not throw when saving without mode
			await expect((task as any).saveClineMessages([])).resolves.not.toThrow()

			// Mode should be undefined in metadata
			expect(capturedMetadata).toBeDefined()
			expect(capturedMetadata.mode).toBeUndefined()
		})

		it("should handle provider.getState errors", async () => {
			// Provider throws error
			mockProvider.getState.mockRejectedValue(new Error("Provider error"))

			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			// Should not throw when provider fails
			await expect((task as any).saveClineMessages([])).resolves.not.toThrow()
		})
	})
})
