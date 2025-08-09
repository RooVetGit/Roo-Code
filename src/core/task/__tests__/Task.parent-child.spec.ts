// npx vitest core/task/__tests__/Task.parent-child.spec.ts

import * as os from "os"
import * as path from "path"

import * as vscode from "vscode"
import { vi, describe, it, expect, beforeEach } from "vitest"

import type { ProviderSettings } from "@roo-code/types"
import { RooCodeEventName } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import { Task } from "../Task"
import { ClineProvider } from "../../webview/ClineProvider"
import { ContextProxy } from "../../config/ContextProxy"

// Mock delay before any imports that might use it
vi.mock("delay", () => ({
	__esModule: true,
	default: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("fs/promises", async (importOriginal) => {
	const actual = (await importOriginal()) as Record<string, any>
	const mockFunctions = {
		mkdir: vi.fn().mockResolvedValue(undefined),
		writeFile: vi.fn().mockResolvedValue(undefined),
		readFile: vi.fn().mockResolvedValue("[]"),
		unlink: vi.fn().mockResolvedValue(undefined),
		rmdir: vi.fn().mockResolvedValue(undefined),
	}

	return {
		...actual,
		...mockFunctions,
		default: mockFunctions,
	}
})

vi.mock("p-wait-for", () => ({
	default: vi.fn().mockImplementation(async () => Promise.resolve()),
}))

vi.mock("vscode", () => {
	const mockDisposable = { dispose: vi.fn() }
	const mockEventEmitter = { event: vi.fn(), fire: vi.fn() }
	const mockTextDocument = { uri: { fsPath: "/mock/workspace/path/file.ts" } }
	const mockTextEditor = { document: mockTextDocument }
	const mockTab = { input: { uri: { fsPath: "/mock/workspace/path/file.ts" } } }
	const mockTabGroup = { tabs: [mockTab] }

	return {
		TabInputTextDiff: vi.fn(),
		CodeActionKind: {
			QuickFix: { value: "quickfix" },
			RefactorRewrite: { value: "refactor.rewrite" },
		},
		window: {
			createTextEditorDecorationType: vi.fn().mockReturnValue({
				dispose: vi.fn(),
			}),
			visibleTextEditors: [mockTextEditor],
			tabGroups: {
				all: [mockTabGroup],
				close: vi.fn(),
				onDidChangeTabs: vi.fn(() => ({ dispose: vi.fn() })),
			},
			showErrorMessage: vi.fn(),
		},
		workspace: {
			workspaceFolders: [
				{
					uri: { fsPath: "/mock/workspace/path" },
					name: "mock-workspace",
					index: 0,
				},
			],
			createFileSystemWatcher: vi.fn(() => ({
				onDidCreate: vi.fn(() => mockDisposable),
				onDidDelete: vi.fn(() => mockDisposable),
				onDidChange: vi.fn(() => mockDisposable),
				dispose: vi.fn(),
			})),
			fs: {
				stat: vi.fn().mockResolvedValue({ type: 1 }), // FileType.File = 1
			},
			onDidSaveTextDocument: vi.fn(() => mockDisposable),
			getConfiguration: vi.fn(() => ({ get: (key: string, defaultValue: any) => defaultValue })),
		},
		env: {
			uriScheme: "vscode",
			language: "en",
		},
		EventEmitter: vi.fn().mockImplementation(() => mockEventEmitter),
		Disposable: {
			from: vi.fn(),
		},
		TabInputText: vi.fn(),
	}
})

vi.mock("../../environment/getEnvironmentDetails", () => ({
	getEnvironmentDetails: vi.fn().mockResolvedValue(""),
}))

vi.mock("../../ignore/RooIgnoreController")

vi.mock("../../protect/RooProtectedController")

vi.mock("../../context-tracking/FileContextTracker")

vi.mock("../../../services/browser/UrlContentFetcher")

vi.mock("../../../services/browser/BrowserSession")

vi.mock("../../../integrations/editor/DiffViewProvider")

vi.mock("../../diff/strategies/multi-search-replace")

vi.mock("../../diff/strategies/multi-file-search-replace")

vi.mock("../../../integrations/terminal/TerminalRegistry", () => ({
	TerminalRegistry: {
		releaseTerminalsForTask: vi.fn(),
	},
}))

vi.mock("../../prompts/system", () => ({
	SYSTEM_PROMPT: vi.fn().mockResolvedValue("Mock system prompt"),
}))

vi.mock("../../../api", () => ({
	buildApiHandler: vi.fn().mockReturnValue({
		getModel: vi.fn().mockReturnValue({
			id: "test-model",
			info: {
				supportsComputerUse: false,
				contextWindow: 100000,
			},
		}),
		createMessage: vi.fn().mockReturnValue({
			[Symbol.asyncIterator]: vi.fn().mockReturnValue({
				next: vi.fn().mockResolvedValue({ done: true }),
			}),
		}),
	}),
}))

vi.mock("../../tools/updateTodoListTool", () => ({
	restoreTodoListForTask: vi.fn(),
}))

vi.mock("../../mentions/processUserContentMentions", () => ({
	processUserContentMentions: vi.fn().mockImplementation(({ userContent }) => Promise.resolve(userContent)),
}))

vi.mock("../../../shared/api", () => ({
	getModelMaxOutputTokens: vi.fn().mockReturnValue(4096),
}))

vi.mock("../../sliding-window", () => ({
	truncateConversationIfNeeded: vi
		.fn()
		.mockImplementation(({ messages }) => Promise.resolve({ messages, error: null, summary: null })),
}))

vi.mock("../../condense", () => ({
	getMessagesSinceLastSummary: vi.fn().mockImplementation((messages) => messages),
	summarizeConversation: vi.fn().mockResolvedValue({
		messages: [],
		summary: null,
		cost: 0,
		newContextTokens: 0,
		error: null,
	}),
}))

vi.mock("../../../api/transform/image-cleaning", () => ({
	maybeRemoveImageBlocks: vi.fn().mockImplementation((messages) => messages),
}))

vi.mock("../../checkpoints", () => ({
	getCheckpointService: vi.fn(),
	checkpointSave: vi.fn().mockResolvedValue(undefined),
	checkpointRestore: vi.fn().mockResolvedValue(undefined),
	checkpointDiff: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../../../services/mcp/McpServerManager", () => ({
	McpServerManager: {
		getInstance: vi.fn().mockResolvedValue(null),
	},
}))

vi.mock("get-folder-size", () => ({
	loose: vi.fn().mockResolvedValue(0),
}))

vi.mock("../../i18n", () => ({
	t: vi.fn().mockImplementation((key, params) => key),
}))

vi.mock("../../../shared/combineApiRequests", () => ({
	combineApiRequests: vi.fn().mockImplementation((messages) => messages),
}))

vi.mock("../../../shared/combineCommandSequences", () => ({
	combineCommandSequences: vi.fn().mockImplementation((messages) => messages),
}))

vi.mock("../../../shared/getApiMetrics", () => ({
	getApiMetrics: vi.fn().mockReturnValue({
		totalTokensIn: 0,
		totalTokensOut: 0,
		totalCacheWrites: 0,
		totalCacheReads: 0,
		totalCost: 0,
		contextTokens: 0,
	}),
}))

vi.mock("../../../shared/array", () => ({
	findLastIndex: vi.fn().mockImplementation((arr, predicate) => {
		for (let i = arr.length - 1; i >= 0; i--) {
			if (predicate(arr[i])) return i
		}
		return -1
	}),
}))

vi.mock("../../task-persistence", () => ({
	readApiMessages: vi.fn().mockResolvedValue([]),
	saveApiMessages: vi.fn().mockResolvedValue(undefined),
	readTaskMessages: vi.fn().mockResolvedValue([]),
	saveTaskMessages: vi.fn().mockResolvedValue(undefined),
	taskMetadata: vi
		.fn()
		.mockImplementation(async ({ taskId, parentTaskId, messages, taskNumber, workspace, mode }) => {
			const historyItem = {
				id: taskId,
				number: taskNumber,
				ts: Date.now(),
				task: messages?.[0]?.text || "Test task",
				tokensIn: 0,
				tokensOut: 0,
				cacheWrites: 0,
				cacheReads: 0,
				totalCost: 0,
				size: 0,
				workspace,
				mode,
				parentTaskId,
			}
			return { historyItem, tokenUsage: {} }
		}),
}))

vi.mock("../../../utils/storage", () => ({
	getTaskDirectoryPath: vi
		.fn()
		.mockImplementation((globalStoragePath, taskId) => Promise.resolve(`${globalStoragePath}/tasks/${taskId}`)),
	getSettingsDirectoryPath: vi
		.fn()
		.mockImplementation((globalStoragePath) => Promise.resolve(`${globalStoragePath}/settings`)),
}))

vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockResolvedValue(false),
}))

describe("Task Parent-Child Coordination", () => {
	let mockProvider: any
	let mockApiConfig: ProviderSettings
	let mockOutputChannel: any
	let mockExtensionContext: vscode.ExtensionContext

	beforeEach(() => {
		vi.clearAllMocks()

		if (!TelemetryService.hasInstance()) {
			TelemetryService.createInstance([])
		}

		// Setup mock extension context
		const storageUri = {
			fsPath: path.join(os.tmpdir(), "test-storage"),
		}

		mockExtensionContext = {
			globalState: {
				get: vi.fn().mockImplementation(() => undefined),
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

		// Setup mock provider with output channel
		mockProvider = new ClineProvider(
			mockExtensionContext,
			mockOutputChannel,
			"sidebar",
			new ContextProxy(mockExtensionContext),
		) as any

		// Setup mock API configuration
		mockApiConfig = {
			apiProvider: "anthropic",
			apiModelId: "claude-3-5-sonnet-20241022",
			apiKey: "test-api-key",
		}

		// Mock provider methods
		mockProvider.postMessageToWebview = vi.fn().mockResolvedValue(undefined)
		mockProvider.postStateToWebview = vi.fn().mockResolvedValue(undefined)
		mockProvider.updateTaskHistory = vi.fn().mockResolvedValue(undefined)
		mockProvider.getState = vi.fn().mockResolvedValue({
			mode: "code",
			experiments: {},
		})
	})

	describe("Parent Task ID Persistence", () => {
		it("should persist parent task ID in history item", async () => {
			// Create parent task
			const parentTask = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "parent task",
				startTask: false,
			})

			// Create child task with parent
			const childTask = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "child task",
				parentTask: parentTask,
				startTask: false,
			})

			// Track if updateTaskHistory was called
			let historyItemCaptured: any = null
			mockProvider.updateTaskHistory = vi.fn().mockImplementation((historyItem) => {
				historyItemCaptured = historyItem
				return Promise.resolve()
			})

			// Add a message to trigger saving
			await childTask.say("text", "test message")

			// Give some time for async operations
			await new Promise((resolve) => setTimeout(resolve, 100))

			// Verify parent task ID was included in the history item
			expect(mockProvider.updateTaskHistory).toHaveBeenCalled()
			expect(historyItemCaptured).toBeDefined()
			expect(historyItemCaptured.parentTaskId).toBe(parentTask.taskId)
		})

		it("should not include parentTaskId when there is no parent", async () => {
			// Create task without parent
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "standalone task",
				startTask: false,
			})

			// Track if updateTaskHistory was called
			let historyItemCaptured: any = null
			mockProvider.updateTaskHistory = vi.fn().mockImplementation((historyItem) => {
				historyItemCaptured = historyItem
				return Promise.resolve()
			})

			// Add a message to trigger saving
			await task.say("text", "test message")

			// Give some time for async operations
			await new Promise((resolve) => setTimeout(resolve, 100))

			// Verify parentTaskId is undefined
			expect(mockProvider.updateTaskHistory).toHaveBeenCalled()
			expect(historyItemCaptured).toBeDefined()
			expect(historyItemCaptured.parentTaskId).toBeUndefined()
		})
	})

	describe("Event-Driven Task Resumption", () => {
		it("should use event listener instead of polling for task resumption", async () => {
			// Create parent task
			const parentTask = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "parent task",
				startTask: false,
			})

			// Set up to track event listeners
			const eventListeners: { [key: string]: Array<() => void> } = {}
			parentTask.once = vi.fn().mockImplementation((event, listener) => {
				if (!eventListeners[event]) {
					eventListeners[event] = []
				}
				eventListeners[event].push(listener)
				return () => {} // Return unsubscribe function
			})

			// Pause the parent task
			parentTask.isPaused = true

			// Start waiting for resume
			const waitPromise = parentTask.waitForResume()

			// Verify event listener was registered
			expect(parentTask.once).toHaveBeenCalledWith(RooCodeEventName.TaskUnpaused, expect.any(Function))
			expect(eventListeners[RooCodeEventName.TaskUnpaused]).toHaveLength(1)

			// Simulate task being unpaused by emitting the event
			parentTask.isPaused = false
			parentTask.emit(RooCodeEventName.TaskUnpaused)

			// Call the registered listener
			if (eventListeners[RooCodeEventName.TaskUnpaused]?.[0]) {
				eventListeners[RooCodeEventName.TaskUnpaused][0]()
			}

			// Wait should complete
			await expect(waitPromise).resolves.toBeUndefined()
		})

		it("should not have pauseInterval property", () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			// Verify pauseInterval doesn't exist
			expect((task as any).pauseInterval).toBeUndefined()
		})

		it("should clean up event listener on dispose", async () => {
			const parentTask = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "parent task",
				startTask: false,
			})

			// Track if pauseResolve is called
			let resolveWasCalled = false
			parentTask.once = vi.fn().mockImplementation((event, listener) => {
				return () => {} // Return unsubscribe function
			})

			// Pause the parent task
			parentTask.isPaused = true

			// Start waiting for resume (don't await it)
			const waitPromise = parentTask.waitForResume()
			waitPromise.then(() => {
				resolveWasCalled = true
			})

			// Give the promise a chance to set up
			await new Promise((resolve) => setTimeout(resolve, 0))

			// Dispose the task
			parentTask.dispose()

			// Give dispose a chance to resolve the promise
			await new Promise((resolve) => setTimeout(resolve, 0))

			// Verify the promise was resolved
			expect(resolveWasCalled).toBe(true)
		})
	})

	describe("Task Lifecycle Integration", () => {
		it("should properly handle parent-child task coordination", async () => {
			// Create parent task
			const parentTask = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "parent task",
				startTask: false,
			})

			// Create child task
			const childTask = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "child task",
				parentTask: parentTask,
				rootTask: parentTask,
				startTask: false,
			})

			// Verify parent-child relationship
			expect(childTask.parentTask).toBe(parentTask)
			expect(childTask.rootTask).toBe(parentTask)

			// Mock resumePausedTask method
			parentTask.resumePausedTask = vi.fn()

			// Simulate child task completion
			await childTask.say("text", "Child task completed")

			// Parent can now be resumed
			expect(parentTask.isPaused).toBe(false)
		})

		it("should handle nested task hierarchies", async () => {
			// Create root task
			const rootTask = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "root task",
				startTask: false,
			})

			// Create middle task
			const middleTask = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "middle task",
				parentTask: rootTask,
				rootTask: rootTask,
				startTask: false,
			})

			// Create leaf task
			const leafTask = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "leaf task",
				parentTask: middleTask,
				rootTask: rootTask,
				startTask: false,
			})

			// Verify hierarchy
			expect(leafTask.parentTask).toBe(middleTask)
			expect(leafTask.rootTask).toBe(rootTask)
			expect(middleTask.parentTask).toBe(rootTask)
			expect(middleTask.rootTask).toBe(rootTask)
			expect(rootTask.parentTask).toBeUndefined()
			expect(rootTask.rootTask).toBeUndefined()
		})
	})
})
