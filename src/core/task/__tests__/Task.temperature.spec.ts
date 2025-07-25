// npx vitest core/task/__tests__/Task.temperature.spec.ts

import { Task } from "../Task"
import { ApiStreamChunk } from "../../../api/transform/stream"
import { buildApiHandler } from "../../../api"

vi.mock("delay", () => ({
	__esModule: true,
	default: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../../../api", () => ({
	buildApiHandler: vi.fn(),
}))

vi.mock("../../ignore/RooIgnoreController", () => ({
	RooIgnoreController: vi.fn().mockImplementation(() => ({
		initialize: vi.fn().mockResolvedValue(undefined),
		dispose: vi.fn(),
		getInstructions: vi.fn().mockReturnValue(""),
	})),
}))

vi.mock("../../protect/RooProtectedController", () => ({
	RooProtectedController: vi.fn().mockImplementation(() => ({
		initialize: vi.fn().mockResolvedValue(undefined),
		dispose: vi.fn(),
	})),
}))

vi.mock("../../context-tracking/FileContextTracker", () => ({
	FileContextTracker: vi.fn().mockImplementation(() => ({
		dispose: vi.fn(),
		getAndClearCheckpointPossibleFile: vi.fn().mockReturnValue([]),
	})),
}))

vi.mock("../../services/browser/UrlContentFetcher", () => ({
	UrlContentFetcher: vi.fn().mockImplementation(() => ({
		closeBrowser: vi.fn(),
	})),
}))

vi.mock("../../services/browser/BrowserSession", () => ({
	BrowserSession: vi.fn().mockImplementation(() => ({
		closeBrowser: vi.fn(),
	})),
}))

vi.mock("../../integrations/editor/DiffViewProvider", () => ({
	DiffViewProvider: vi.fn().mockImplementation(() => ({
		isEditing: false,
		revertChanges: vi.fn().mockResolvedValue(undefined),
		reset: vi.fn().mockResolvedValue(undefined),
	})),
}))

vi.mock("../../tools/ToolRepetitionDetector", () => ({
	ToolRepetitionDetector: vi.fn().mockImplementation(() => ({
		check: vi.fn().mockReturnValue({ allowExecution: true }),
	})),
}))

vi.mock("../../../integrations/terminal/TerminalRegistry", () => ({
	TerminalRegistry: {
		releaseTerminalsForTask: vi.fn(),
	},
}))

vi.mock("@roo-code/telemetry", async (importOriginal) => {
	const actual = (await importOriginal()) as any
	return {
		...actual,
		TelemetryService: {
			instance: {
				captureTaskCreated: vi.fn(),
				captureTaskRestarted: vi.fn(),
			},
			hasInstance: vi.fn().mockReturnValue(true),
			createInstance: vi.fn(),
		},
		BaseTelemetryClient: actual.BaseTelemetryClient || class BaseTelemetryClient {},
	}
})

vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn().mockReturnValue({
			get: vi.fn().mockReturnValue(true),
		}),
		createFileSystemWatcher: vi.fn().mockReturnValue({
			onDidCreate: vi.fn(),
			onDidDelete: vi.fn(),
			onDidChange: vi.fn(),
			dispose: vi.fn(),
		}),
		onDidChangeWorkspaceFolders: vi.fn().mockReturnValue({
			dispose: vi.fn(),
		}),
		workspaceFolders: [],
	},
	window: {
		createTextEditorDecorationType: vi.fn().mockReturnValue({
			dispose: vi.fn(),
		}),
	},
	env: {
		language: "en",
		shell: "/bin/bash",
	},
	RelativePattern: vi.fn(),
	Uri: {
		file: vi.fn().mockImplementation((path) => ({ fsPath: path })),
	},
}))

vi.mock("../../services/mcp/McpServerManager", () => ({
	McpServerManager: {
		getInstance: vi.fn().mockResolvedValue(null),
	},
}))

vi.mock("../../services/mcp/McpHub", () => ({
	McpHub: vi.fn().mockImplementation(() => ({
		isConnecting: false,
		dispose: vi.fn(),
	})),
}))

vi.mock("../../../utils/path", () => ({
	getWorkspacePath: vi.fn().mockReturnValue("/test/workspace"),
}))

describe("Temperature Reduction on Tool Failure", () => {
	let mockProvider: any
	let mockApiConfig: any

	beforeEach(() => {
		vi.clearAllMocks()

		mockApiConfig = {
			apiProvider: "anthropic",
			apiKey: "test-key",
			modelTemperature: 0.8,
		}

		mockProvider = {
			context: {
				globalStorageUri: { fsPath: "/test/storage" },
				globalState: {
					update: vi.fn().mockResolvedValue(undefined),
					get: vi.fn().mockResolvedValue(undefined),
				},
			},
			getState: vi.fn().mockResolvedValue({
				apiConfiguration: mockApiConfig,
				mcpEnabled: false, // Disable MCP for tests
			}),
			postStateToWebview: vi.fn().mockResolvedValue(undefined),
			postMessageToWebview: vi.fn().mockResolvedValue(undefined),
			updateTaskHistory: vi.fn().mockResolvedValue(undefined),
			ensureSettingsDirectoryExists: vi.fn().mockResolvedValue("/test/settings"),
		}

		// Mock buildApiHandler
		const mockApi = {
			createMessage: vi.fn(),
			getModel: vi.fn().mockReturnValue({
				id: "test-model",
				info: {
					contextWindow: 100000,
					maxTokens: 4096,
				},
			}),
		}
		;(buildApiHandler as any).mockReturnValue(mockApi)
	})

	it("should track original temperature on first API request", async () => {
		const task = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			task: "test task",
			startTask: false,
		})

		// Mock the API stream response
		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text", text: "response" } as ApiStreamChunk
			},
			async next() {
				return { done: true, value: { type: "text", text: "response" } as ApiStreamChunk }
			},
			async return() {
				return { done: true as const, value: undefined }
			},
			async throw(e: any) {
				throw e
			},
			[Symbol.asyncDispose]: async () => {},
		} as AsyncGenerator<ApiStreamChunk>

		vi.spyOn(task.api, "createMessage").mockReturnValue(mockStream)

		// Make an API request
		const iterator = task.attemptApiRequest(0)
		await iterator.next()

		// Verify original temperature was stored
		expect((task as any).originalTemperature).toBe(0.8)
		expect((task as any).currentTemperature).toBe(0.8)
	})

	it("should reduce temperature when retryWithReducedTemperature is called", async () => {
		const task = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			task: "test task",
			startTask: false,
		})

		// Set initial temperature
		;(task as any).originalTemperature = 0.8
		;(task as any).currentTemperature = 0.8

		// Mock say method
		const saySpy = vi.spyOn(task, "say").mockResolvedValue(undefined)

		// Call retryWithReducedTemperature
		const canRetry = await task.retryWithReducedTemperature()

		// Verify temperature was reduced
		expect(canRetry).toBe(true)
		expect((task as any).currentTemperature).toBe(0.4) // 0.8 * 0.5
		expect((task as any).temperatureReductionAttempts).toBe(1)

		// Verify message was logged
		expect(saySpy).toHaveBeenCalledWith(
			"text",
			"Reducing temperature from 0.80 to 0.40 due to tool failure (attempt 1/3)",
		)
	})

	it("should set shouldReduceTemperature flag when recordToolError is called", async () => {
		const task = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			task: "test task",
			startTask: false,
		})

		// Initially should be false
		expect((task as any).shouldReduceTemperature).toBe(false)

		// Record a tool error
		task.recordToolError("write_to_file", "File write failed")

		// Flag should be set
		expect((task as any).shouldReduceTemperature).toBe(true)
	})

	it("should not allow temperature reduction beyond max attempts", async () => {
		const task = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			task: "test task",
			startTask: false,
		})

		// Set temperature reduction attempts to max
		;(task as any).temperatureReductionAttempts = 3
		;(task as any).currentTemperature = 0.1

		// Mock say method
		const saySpy = vi.spyOn(task, "say").mockResolvedValue(undefined)

		// Call retryWithReducedTemperature
		const canRetry = await task.retryWithReducedTemperature()

		// Should not allow retry
		expect(canRetry).toBe(false)
		expect((task as any).temperatureReductionAttempts).toBe(3) // No increment

		// Verify error message
		expect(saySpy).toHaveBeenCalledWith(
			"error",
			"Maximum temperature reduction attempts (3) reached. Cannot reduce temperature further.",
		)
	})

	it("should handle temperature reduction to minimum value", async () => {
		const task = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			task: "test task",
			startTask: false,
		})

		// Set very low temperature
		;(task as any).currentTemperature = 0.1

		// Mock say method
		vi.spyOn(task, "say").mockResolvedValue(undefined)

		// Call retryWithReducedTemperature
		const canRetry = await task.retryWithReducedTemperature()

		// Should allow retry but temperature should be at minimum
		expect(canRetry).toBe(true)
		expect((task as any).currentTemperature).toBe(0.05) // 0.1 * 0.5
	})

	it("should use temperature override in attemptApiRequest", async () => {
		const task = new Task({
			provider: mockProvider,
			apiConfiguration: mockApiConfig,
			task: "test task",
			startTask: false,
		})

		// Mock the API stream response
		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text", text: "response" } as ApiStreamChunk
			},
			async next() {
				return { done: true, value: { type: "text", text: "response" } as ApiStreamChunk }
			},
			async return() {
				return { done: true as const, value: undefined }
			},
			async throw(e: any) {
				throw e
			},
			[Symbol.asyncDispose]: async () => {},
		} as AsyncGenerator<ApiStreamChunk>

		vi.spyOn(task.api, "createMessage").mockReturnValue(mockStream)

		// Make an API request with temperature override
		const iterator = task.attemptApiRequest(0, 0.3)
		await iterator.next()

		// Verify temperature was set
		expect((task as any).currentTemperature).toBe(0.3)

		// Verify buildApiHandler was called with modified config
		expect(buildApiHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				modelTemperature: 0.3,
			}),
		)
	})

	it("should handle undefined temperature gracefully", async () => {
		const task = new Task({
			provider: mockProvider,
			apiConfiguration: { ...mockApiConfig, modelTemperature: undefined },
			task: "test task",
			startTask: false,
		})

		// Mock say method
		vi.spyOn(task, "say").mockResolvedValue(undefined)

		// Call retryWithReducedTemperature
		const canRetry = await task.retryWithReducedTemperature()

		// Should handle undefined temperature
		expect(canRetry).toBe(true)
		expect((task as any).currentTemperature).toBe(0.5) // 1.0 (default) * 0.5
	})
})
