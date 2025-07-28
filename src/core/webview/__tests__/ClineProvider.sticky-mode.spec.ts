// npx vitest core/webview/__tests__/ClineProvider.sticky-mode.spec.ts

import * as vscode from "vscode"
import { TelemetryService } from "@roo-code/telemetry"
import { ClineProvider } from "../ClineProvider"
import { ContextProxy } from "../../config/ContextProxy"
import { Task } from "../../task/Task"
import type { HistoryItem, ProviderName } from "@roo-code/types"

// Mock setup
vi.mock("vscode", () => ({
	ExtensionContext: vi.fn(),
	OutputChannel: vi.fn(),
	WebviewView: vi.fn(),
	Uri: {
		joinPath: vi.fn(),
		file: vi.fn(),
	},
	CodeActionKind: {
		QuickFix: { value: "quickfix" },
		RefactorRewrite: { value: "refactor.rewrite" },
	},
	commands: {
		executeCommand: vi.fn().mockResolvedValue(undefined),
	},
	window: {
		showInformationMessage: vi.fn(),
		showWarningMessage: vi.fn(),
		showErrorMessage: vi.fn(),
	},
	workspace: {
		getConfiguration: vi.fn().mockReturnValue({
			get: vi.fn().mockReturnValue([]),
			update: vi.fn(),
		}),
		onDidChangeConfiguration: vi.fn().mockImplementation(() => ({
			dispose: vi.fn(),
		})),
		onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidOpenTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidCloseTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
	},
	env: {
		uriScheme: "vscode",
		language: "en",
		appName: "Visual Studio Code",
	},
	ExtensionMode: {
		Production: 1,
		Development: 2,
		Test: 3,
	},
	version: "1.85.0",
}))
// Create a counter for unique task IDs
let taskIdCounter = 0

vi.mock("../../task/Task", () => ({
	Task: vi.fn().mockImplementation((options) => ({
		taskId: options.taskId || `test-task-id-${++taskIdCounter}`,
		saveClineMessages: vi.fn(),
		clineMessages: [],
		apiConversationHistory: [],
		overwriteClineMessages: vi.fn(),
		overwriteApiConversationHistory: vi.fn(),
		abortTask: vi.fn(),
		handleWebviewAskResponse: vi.fn(),
		getTaskNumber: vi.fn().mockReturnValue(0),
		setTaskNumber: vi.fn(),
		setParentTask: vi.fn(),
		setRootTask: vi.fn(),
		emit: vi.fn(),
		parentTask: options.parentTask,
	})),
}))
vi.mock("../../prompts/sections/custom-instructions")
vi.mock("../../../utils/safeWriteJson")
vi.mock("../../../api", () => ({
	buildApiHandler: vi.fn().mockReturnValue({
		getModel: vi.fn().mockReturnValue({
			id: "claude-3-sonnet",
			info: { supportsComputerUse: false },
		}),
	}),
}))
vi.mock("../../../integrations/workspace/WorkspaceTracker", () => ({
	default: vi.fn().mockImplementation(() => ({
		initializeFilePaths: vi.fn(),
		dispose: vi.fn(),
	})),
}))
vi.mock("../../diff/strategies/multi-search-replace", () => ({
	MultiSearchReplaceDiffStrategy: vi.fn().mockImplementation(() => ({
		getToolDescription: () => "test",
		getName: () => "test-strategy",
		applyDiff: vi.fn(),
	})),
}))
vi.mock("@roo-code/cloud", () => ({
	CloudService: {
		hasInstance: vi.fn().mockReturnValue(true),
		get instance() {
			return {
				isAuthenticated: vi.fn().mockReturnValue(false),
			}
		},
	},
	getRooCodeApiUrl: vi.fn().mockReturnValue("https://app.roocode.com"),
}))
vi.mock("../../../shared/modes", () => ({
	modes: [
		{
			slug: "code",
			name: "Code Mode",
			roleDefinition: "You are a code assistant",
			groups: ["read", "edit", "browser"],
		},
		{
			slug: "architect",
			name: "Architect Mode",
			roleDefinition: "You are an architect",
			groups: ["read", "edit"],
		},
	],
	getModeBySlug: vi.fn().mockReturnValue({
		slug: "code",
		name: "Code Mode",
		roleDefinition: "You are a code assistant",
		groups: ["read", "edit", "browser"],
	}),
	defaultModeSlug: "code",
}))
vi.mock("../../prompts/system", () => ({
	SYSTEM_PROMPT: vi.fn().mockResolvedValue("mocked system prompt"),
	codeMode: "code",
}))
vi.mock("../../../api/providers/fetchers/modelCache", () => ({
	getModels: vi.fn().mockResolvedValue({}),
	flushModels: vi.fn(),
}))
vi.mock("../../../integrations/misc/extract-text", () => ({
	extractTextFromFile: vi.fn().mockResolvedValue("Mock file content"),
}))
vi.mock("p-wait-for", () => ({
	default: vi.fn().mockImplementation(async () => Promise.resolve()),
}))
vi.mock("fs/promises", () => ({
	mkdir: vi.fn().mockResolvedValue(undefined),
	writeFile: vi.fn().mockResolvedValue(undefined),
	readFile: vi.fn().mockResolvedValue(""),
	unlink: vi.fn().mockResolvedValue(undefined),
	rmdir: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		hasInstance: vi.fn().mockReturnValue(true),
		createInstance: vi.fn(),
		get instance() {
			return {
				trackEvent: vi.fn(),
				trackError: vi.fn(),
				setProvider: vi.fn(),
				captureModeSwitch: vi.fn(),
			}
		},
	},
}))

describe("ClineProvider - Sticky Mode", () => {
	let provider: ClineProvider
	let mockContext: vscode.ExtensionContext
	let mockOutputChannel: vscode.OutputChannel
	let mockWebviewView: vscode.WebviewView
	let mockPostMessage: any

	beforeEach(() => {
		vi.clearAllMocks()

		if (!TelemetryService.hasInstance()) {
			TelemetryService.createInstance([])
		}

		const globalState: Record<string, string | undefined> = {
			mode: "code",
			currentApiConfigName: "test-config",
		}

		const secrets: Record<string, string | undefined> = {}

		mockContext = {
			extensionPath: "/test/path",
			extensionUri: {} as vscode.Uri,
			globalState: {
				get: vi.fn().mockImplementation((key: string) => globalState[key]),
				update: vi.fn().mockImplementation((key: string, value: string | undefined) => {
					globalState[key] = value
					return Promise.resolve()
				}),
				keys: vi.fn().mockImplementation(() => Object.keys(globalState)),
			},
			secrets: {
				get: vi.fn().mockImplementation((key: string) => secrets[key]),
				store: vi.fn().mockImplementation((key: string, value: string | undefined) => {
					secrets[key] = value
					return Promise.resolve()
				}),
				delete: vi.fn().mockImplementation((key: string) => {
					delete secrets[key]
					return Promise.resolve()
				}),
			},
			subscriptions: [],
			extension: {
				packageJSON: { version: "1.0.0" },
			},
			globalStorageUri: {
				fsPath: "/test/storage/path",
			},
		} as unknown as vscode.ExtensionContext

		mockOutputChannel = {
			appendLine: vi.fn(),
			clear: vi.fn(),
			dispose: vi.fn(),
		} as unknown as vscode.OutputChannel

		mockPostMessage = vi.fn()

		mockWebviewView = {
			webview: {
				postMessage: mockPostMessage,
				html: "",
				options: {},
				onDidReceiveMessage: vi.fn(),
				asWebviewUri: vi.fn(),
				cspSource: "vscode-webview://test-csp-source",
			},
			visible: true,
			onDidDispose: vi.fn().mockImplementation((callback) => {
				callback()
				return { dispose: vi.fn() }
			}),
			onDidChangeVisibility: vi.fn().mockImplementation(() => ({ dispose: vi.fn() })),
		} as unknown as vscode.WebviewView

		provider = new ClineProvider(mockContext, mockOutputChannel, "sidebar", new ContextProxy(mockContext))

		// Mock getMcpHub method
		provider.getMcpHub = vi.fn().mockReturnValue({
			listTools: vi.fn().mockResolvedValue([]),
			callTool: vi.fn().mockResolvedValue({ content: [] }),
			listResources: vi.fn().mockResolvedValue([]),
			readResource: vi.fn().mockResolvedValue({ contents: [] }),
			getAllServers: vi.fn().mockReturnValue([]),
		})
	})

	describe("handleModeSwitch", () => {
		beforeEach(async () => {
			await provider.resolveWebviewView(mockWebviewView)
		})

		it("should save mode to task metadata when switching modes", async () => {
			// Create a mock task
			const mockTask = new Task({
				provider,
				apiConfiguration: { apiProvider: "openrouter" },
			})

			// Get the actual taskId from the mock
			const taskId = (mockTask as any).taskId || "test-task-id"

			// Mock getGlobalState to return task history
			vi.spyOn(provider as any, "getGlobalState").mockReturnValue([
				{
					id: taskId,
					ts: Date.now(),
					task: "Test task",
					number: 1,
					tokensIn: 0,
					tokensOut: 0,
					cacheWrites: 0,
					cacheReads: 0,
					totalCost: 0,
				},
			])

			// Mock updateTaskHistory to track calls
			const updateTaskHistorySpy = vi
				.spyOn(provider, "updateTaskHistory")
				.mockImplementation(() => Promise.resolve([]))

			// Add task to provider stack
			await provider.addClineToStack(mockTask)

			// Switch mode
			await provider.handleModeSwitch("architect")

			// Verify mode was updated in global state
			expect(mockContext.globalState.update).toHaveBeenCalledWith("mode", "architect")

			// Verify task history was updated with new mode
			expect(updateTaskHistorySpy).toHaveBeenCalledWith(
				expect.objectContaining({
					id: taskId,
					mode: "architect",
				}),
			)
		})

		it("should update task's taskMode property when switching modes", async () => {
			// Create a mock task with initial mode
			const mockTask = {
				taskId: "test-task-id",
				taskMode: "code", // Initial mode
				emit: vi.fn(),
				saveClineMessages: vi.fn(),
				clineMessages: [],
				apiConversationHistory: [],
			}

			// Add task to provider stack
			await provider.addClineToStack(mockTask as any)

			// Mock getGlobalState to return task history
			vi.spyOn(provider as any, "getGlobalState").mockReturnValue([
				{
					id: mockTask.taskId,
					ts: Date.now(),
					task: "Test task",
					number: 1,
					tokensIn: 0,
					tokensOut: 0,
					cacheWrites: 0,
					cacheReads: 0,
					totalCost: 0,
				},
			])

			// Mock updateTaskHistory
			vi.spyOn(provider, "updateTaskHistory").mockImplementation(() => Promise.resolve([]))

			// Switch mode
			await provider.handleModeSwitch("architect")

			// Verify task's taskMode property was updated
			expect(mockTask.taskMode).toBe("architect")

			// Verify emit was called with taskModeSwitched event
			expect(mockTask.emit).toHaveBeenCalledWith("taskModeSwitched", mockTask.taskId, "architect")
		})

		it("should update task history with new mode when active task exists", async () => {
			// Create a mock task with history
			const mockTask = new Task({
				provider,
				apiConfiguration: { apiProvider: "openrouter" },
			})

			// Get the actual taskId from the mock
			const taskId = (mockTask as any).taskId || "test-task-id"

			// Mock getGlobalState to return task history
			vi.spyOn(provider as any, "getGlobalState").mockReturnValue([
				{
					id: taskId,
					ts: Date.now(),
					task: "Test task",
					number: 1,
					tokensIn: 0,
					tokensOut: 0,
					cacheWrites: 0,
					cacheReads: 0,
					totalCost: 0,
				},
			])

			// Mock updateTaskHistory to track calls
			const updateTaskHistorySpy = vi
				.spyOn(provider, "updateTaskHistory")
				.mockImplementation(() => Promise.resolve([]))

			// Add task to provider stack
			await provider.addClineToStack(mockTask)

			// Switch mode
			await provider.handleModeSwitch("architect")

			// Verify updateTaskHistory was called with mode in the history item
			expect(updateTaskHistorySpy).toHaveBeenCalledWith(
				expect.objectContaining({
					id: taskId,
					mode: "architect",
				}),
			)
		})
	})

	describe("initClineWithHistoryItem", () => {
		it("should restore mode from history item when reopening task", async () => {
			await provider.resolveWebviewView(mockWebviewView)

			// Create a history item with saved mode
			const historyItem: HistoryItem = {
				id: "test-task-id",
				number: 1,
				ts: Date.now(),
				task: "Test task",
				tokensIn: 100,
				tokensOut: 200,
				cacheWrites: 0,
				cacheReads: 0,
				totalCost: 0.001,
				mode: "architect", // Saved mode
			}

			// Mock updateGlobalState to track mode updates
			const updateGlobalStateSpy = vi.spyOn(provider as any, "updateGlobalState").mockResolvedValue(undefined)

			// Initialize task with history item
			await provider.initClineWithHistoryItem(historyItem)

			// Verify mode was restored via updateGlobalState
			expect(updateGlobalStateSpy).toHaveBeenCalledWith("mode", "architect")
		})

		it("should use current mode if history item has no saved mode", async () => {
			await provider.resolveWebviewView(mockWebviewView)

			// Set current mode
			mockContext.globalState.get = vi.fn().mockImplementation((key: string) => {
				if (key === "mode") return "code"
				return undefined
			})

			// Create a history item without saved mode
			const historyItem: HistoryItem = {
				id: "test-task-id",
				number: 1,
				ts: Date.now(),
				task: "Test task",
				tokensIn: 100,
				tokensOut: 200,
				cacheWrites: 0,
				cacheReads: 0,
				totalCost: 0.001,
				// No mode field
			}

			// Mock getTaskWithId
			vi.spyOn(provider, "getTaskWithId").mockResolvedValue({
				historyItem,
				taskDirPath: "/test/path",
				apiConversationHistoryFilePath: "/test/path/api_history.json",
				uiMessagesFilePath: "/test/path/ui_messages.json",
				apiConversationHistory: [],
			})

			// Mock handleModeSwitch to track calls
			const handleModeSwitchSpy = vi.spyOn(provider, "handleModeSwitch").mockResolvedValue()

			// Initialize task with history item
			await provider.initClineWithHistoryItem(historyItem)

			// Verify mode was not changed (should use current mode)
			expect(handleModeSwitchSpy).not.toHaveBeenCalled()
		})
	})

	describe("Task metadata persistence", () => {
		it("should include mode in task metadata when creating history items", async () => {
			await provider.resolveWebviewView(mockWebviewView)

			// Set current mode
			await provider.setValue("mode", "debug")

			// Create a mock task
			const mockTask = new Task({
				provider,
				apiConfiguration: { apiProvider: "openrouter" },
			})

			// Get the actual taskId from the mock
			const taskId = (mockTask as any).taskId || "test-task-id"

			// Mock getGlobalState to return task history with our task
			vi.spyOn(provider as any, "getGlobalState").mockReturnValue([
				{
					id: taskId,
					ts: Date.now(),
					task: "Test task",
					number: 1,
					tokensIn: 0,
					tokensOut: 0,
					cacheWrites: 0,
					cacheReads: 0,
					totalCost: 0,
				},
			])

			// Mock updateTaskHistory to capture the updated history item
			let updatedHistoryItem: any
			vi.spyOn(provider, "updateTaskHistory").mockImplementation((item) => {
				updatedHistoryItem = item
				return Promise.resolve([item])
			})

			// Add task to provider stack
			await provider.addClineToStack(mockTask)

			// Trigger a mode switch
			await provider.handleModeSwitch("debug")

			// Verify mode was included in the updated history item
			expect(updatedHistoryItem).toBeDefined()
			expect(updatedHistoryItem.mode).toBe("debug")
		})
	})

	describe("Integration with new_task tool", () => {
		it("should preserve parent task mode when creating subtasks", async () => {
			await provider.resolveWebviewView(mockWebviewView)

			// This test verifies that when using the new_task tool to create a subtask,
			// the parent task's mode is preserved and not changed by the subtask's mode switch

			// Set initial mode to architect
			await provider.setValue("mode", "architect")

			// Create parent task
			const parentTask = new Task({
				provider,
				apiConfiguration: { apiProvider: "openrouter" },
			})

			// Get the actual taskId from the mock
			const parentTaskId = (parentTask as any).taskId || "parent-task-id"

			// Create a simple task history tracking object
			const taskModes: Record<string, string> = {
				[parentTaskId]: "architect", // Parent starts with architect mode
			}

			// Mock getGlobalState to return task history
			const getGlobalStateMock = vi.spyOn(provider as any, "getGlobalState")
			getGlobalStateMock.mockImplementation((key) => {
				if (key === "taskHistory") {
					return Object.entries(taskModes).map(([id, mode]) => ({
						id,
						ts: Date.now(),
						task: `Task ${id}`,
						number: 1,
						tokensIn: 0,
						tokensOut: 0,
						cacheWrites: 0,
						cacheReads: 0,
						totalCost: 0,
						mode,
					}))
				}
				// Return empty array for other keys
				return []
			})

			// Mock updateTaskHistory to track mode changes
			const updateTaskHistoryMock = vi.spyOn(provider, "updateTaskHistory")
			updateTaskHistoryMock.mockImplementation((item) => {
				// The handleModeSwitch method updates the task history for the current task
				// We should only update the task that matches the item.id
				if (item.id && item.mode !== undefined) {
					taskModes[item.id] = item.mode
				}
				return Promise.resolve([])
			})

			// Add parent task to stack
			await provider.addClineToStack(parentTask)

			// Create a subtask (simulating new_task tool behavior)
			const subtask = new Task({
				provider,
				apiConfiguration: { apiProvider: "openrouter" },
				parentTask: parentTask,
			})
			const subtaskId = (subtask as any).taskId || "subtask-id"

			// Initialize subtask with parent's mode
			taskModes[subtaskId] = "architect"

			// Mock getCurrentCline to return the parent task initially
			const getCurrentClineMock = vi.spyOn(provider, "getCurrentCline")
			getCurrentClineMock.mockReturnValue(parentTask as any)

			// Add subtask to stack
			await provider.addClineToStack(subtask)

			// Now mock getCurrentCline to return the subtask (simulating stack behavior)
			getCurrentClineMock.mockReturnValue(subtask as any)

			// Switch subtask to code mode - this should only affect the subtask
			await provider.handleModeSwitch("code")

			// Verify that the parent task's mode is still architect
			expect(taskModes[parentTaskId]).toBe("architect")

			// Verify the subtask has code mode
			expect(taskModes[subtaskId]).toBe("code")
		})
	})

	describe("Error handling", () => {
		it("should handle errors gracefully when saving mode fails", async () => {
			await provider.resolveWebviewView(mockWebviewView)

			// Create a mock task that throws on save
			const mockTask = new Task({
				provider,
				apiConfiguration: { apiProvider: "openrouter" },
			})
			vi.spyOn(mockTask as any, "saveClineMessages").mockRejectedValue(new Error("Save failed"))

			// Add task to provider stack
			await provider.addClineToStack(mockTask)

			// Switch mode - should not throw
			await expect(provider.handleModeSwitch("architect")).resolves.not.toThrow()

			// Verify mode was still updated in global state
			expect(mockContext.globalState.update).toHaveBeenCalledWith("mode", "architect")
		})

		it("should handle null/undefined mode gracefully", async () => {
			await provider.resolveWebviewView(mockWebviewView)

			// Create a history item with null mode
			const historyItem: HistoryItem = {
				id: "test-task-id",
				number: 1,
				ts: Date.now(),
				task: "Test task",
				tokensIn: 100,
				tokensOut: 200,
				cacheWrites: 0,
				cacheReads: 0,
				totalCost: 0.001,
				mode: null as any, // Invalid mode
			}

			// Mock getTaskWithId
			vi.spyOn(provider, "getTaskWithId").mockResolvedValue({
				historyItem,
				taskDirPath: "/test/path",
				apiConversationHistoryFilePath: "/test/path/api_history.json",
				uiMessagesFilePath: "/test/path/ui_messages.json",
				apiConversationHistory: [],
			})

			// Mock handleModeSwitch to track calls
			const handleModeSwitchSpy = vi.spyOn(provider, "handleModeSwitch").mockResolvedValue()

			// Initialize task with history item - should not throw
			await expect(provider.initClineWithHistoryItem(historyItem)).resolves.not.toThrow()

			// Verify mode switch was not called with null
			expect(handleModeSwitchSpy).not.toHaveBeenCalledWith(null)
		})

		it("should restore API configuration when restoring task from history with mode", async () => {
			// Setup: Configure different API configs for different modes
			const codeApiConfig = { apiProvider: "anthropic" as ProviderName, anthropicApiKey: "code-key" }
			const architectApiConfig = { apiProvider: "openai" as ProviderName, openAiApiKey: "architect-key" }

			// Save API configs
			await provider.upsertProviderProfile("code-config", codeApiConfig)
			await provider.upsertProviderProfile("architect-config", architectApiConfig)

			// Get the config IDs
			const codeConfigId = provider.getProviderProfileEntry("code-config")?.id
			const architectConfigId = provider.getProviderProfileEntry("architect-config")?.id

			// Associate configs with modes
			await provider.providerSettingsManager.setModeConfig("code", codeConfigId!)
			await provider.providerSettingsManager.setModeConfig("architect", architectConfigId!)

			// Start in code mode with code config
			await provider.handleModeSwitch("code")

			// Create a history item with architect mode
			const historyItem: HistoryItem = {
				id: "test-task-id",
				number: 1,
				ts: Date.now(),
				task: "Test task",
				tokensIn: 100,
				tokensOut: 200,
				cacheWrites: 0,
				cacheReads: 0,
				totalCost: 0.001,
				mode: "architect", // Task was created in architect mode
			}

			// Restore the task from history
			await provider.initClineWithHistoryItem(historyItem)

			// Verify that the mode was restored
			const state = await provider.getState()
			expect(state.mode).toBe("architect")

			// Verify that the API configuration was also restored
			expect(state.currentApiConfigName).toBe("architect-config")
			expect(state.apiConfiguration.apiProvider).toBe("openai")
		})
	})
})
