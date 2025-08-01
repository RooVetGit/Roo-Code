// Use doMock to apply the mock dynamically
vitest.doMock("../../utils/path", () => ({
	getWorkspacePath: vitest.fn(() => {
		console.log("getWorkspacePath mock called, returning:", "/mock/workspace")
		return "/mock/workspace"
	}),
}))

// Mock the RepoPerTaskCheckpointService
vitest.mock("../../../services/checkpoints", () => ({
	RepoPerTaskCheckpointService: {
		create: vitest.fn(),
	},
}))

import { describe, it, expect, beforeEach, afterEach, vitest } from "vitest"
import * as path from "path"
import * as fs from "fs/promises"
import * as os from "os"
import { EventEmitter } from "events"

// Import these modules after mocks are set up
let getCheckpointService: any
let RepoPerTaskCheckpointService: any

// Set up the imports after mocks
beforeAll(async () => {
	const checkpointsModule = await import("../index")
	const checkpointServiceModule = await import("../../../services/checkpoints")
	getCheckpointService = checkpointsModule.getCheckpointService
	RepoPerTaskCheckpointService = checkpointServiceModule.RepoPerTaskCheckpointService
})

// Mock the FileChangeManager to avoid complex dependencies
const mockFileChangeManager = {
	_baseline: "HEAD" as string,
	getChanges: vitest.fn(),
	updateBaseline: vitest.fn(),
	setFiles: vitest.fn(),
	getLLMOnlyChanges: vitest.fn(),
}

// Create a temporary directory for mock global storage
let mockGlobalStorageDir: string

// Mock the provider
const mockProvider = {
	getFileChangeManager: vitest.fn(() => mockFileChangeManager),
	log: vitest.fn(),
	get context() {
		return {
			globalStorageUri: {
				fsPath: mockGlobalStorageDir,
			},
		}
	},
}

// Mock the Task object with proper typing
const createMockTask = (options: { taskId: string; hasExistingCheckpoints: boolean; enableCheckpoints?: boolean }) => {
	const mockTask = {
		taskId: options.taskId,
		instanceId: "test-instance",
		rootTask: undefined as any,
		parentTask: undefined as any,
		taskNumber: 1,
		workspacePath: "/mock/workspace",
		enableCheckpoints: options.enableCheckpoints ?? true,
		checkpointService: null as any,
		checkpointServiceInitializing: false,
		clineMessages: options.hasExistingCheckpoints
			? [{ say: "checkpoint_saved", ts: Date.now(), text: "existing-checkpoint-hash" }]
			: [],
		providerRef: {
			deref: () => mockProvider,
		},
		fileContextTracker: {},
		// Add minimal required properties to satisfy Task interface
		todoList: undefined,
		userMessageContent: "",
		apiConversationHistory: [],
		customInstructions: "",
		alwaysAllowReadOnly: false,
		alwaysAllowWrite: false,
		alwaysAllowExecute: false,
		alwaysAllowBrowser: false,
		alwaysAllowMcp: false,
		createdAt: Date.now(),
		historyErrors: [],
		askResponse: undefined,
		askResponseText: "",
		abort: vitest.fn(),
		isAborting: false,
	} as any // Cast to any to avoid needing to implement all Task methods
	return mockTask
}

describe("getCheckpointService orchestration", () => {
	let tmpDir: string
	let mockService: any

	beforeEach(async () => {
		tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "checkpoint-test-"))
		mockGlobalStorageDir = path.join(tmpDir, "global-storage")
		await fs.mkdir(mockGlobalStorageDir, { recursive: true })

		// Reset mocks
		vitest.clearAllMocks()

		// Override the global vscode mock to have a workspace folder
		const vscode = await import("vscode")
		// @ts-ignore - Mock the workspace.workspaceFolders
		vscode.workspace.workspaceFolders = [
			{
				uri: {
					fsPath: "/mock/workspace",
				},
			},
		]

		// Mock the checkpoint service
		mockService = new EventEmitter()
		mockService.baseHash = "mock-base-hash-abc123"
		mockService.getCurrentCheckpoint = vitest.fn(() => "mock-current-checkpoint-def456")
		mockService.isInitialized = true
		mockService.initShadowGit = vitest.fn(() => {
			// Simulate the initialize event being emitted after initShadowGit completes
			setImmediate(() => {
				mockService.emit("initialize")
			})
			return Promise.resolve()
		})

		// Mock the service creation
		;(RepoPerTaskCheckpointService.create as any).mockReturnValue(mockService)
	})

	afterEach(async () => {
		await fs.rm(tmpDir, { recursive: true, force: true })
		vitest.restoreAllMocks()
	})

	describe("Service creation and caching", () => {
		it("should create and return a new checkpoint service", async () => {
			const task = createMockTask({
				taskId: "new-task-123",
				hasExistingCheckpoints: false,
			})

			const service = getCheckpointService(task)
			console.log("Service returned:", service)
			expect(service).toBe(mockService)
			expect(RepoPerTaskCheckpointService.create).toHaveBeenCalledWith({
				taskId: "new-task-123",
				shadowDir: mockGlobalStorageDir,
				workspaceDir: "/mock/workspace",
				log: expect.any(Function),
			})
		})

		it("should return existing service if already initialized", async () => {
			const task = createMockTask({
				taskId: "existing-service-task",
				hasExistingCheckpoints: false,
			})

			// Set existing checkpoint service
			task.checkpointService = mockService

			const service = getCheckpointService(task)
			expect(service).toBe(mockService)

			// Should not create a new service
			expect(RepoPerTaskCheckpointService.create).not.toHaveBeenCalled()
		})

		it("should return undefined when checkpoints are disabled", async () => {
			const task = createMockTask({
				taskId: "disabled-task",
				hasExistingCheckpoints: false,
				enableCheckpoints: false,
			})

			const service = getCheckpointService(task)
			expect(service).toBeUndefined()
		})
	})

	describe("Service initialization", () => {
		it("should call initShadowGit and set up event handlers", async () => {
			const task = createMockTask({
				taskId: "init-test-task",
				hasExistingCheckpoints: false,
			})

			const service = getCheckpointService(task)
			expect(service).toBe(mockService)

			// initShadowGit should be called
			expect(mockService.initShadowGit).toHaveBeenCalled()

			// Wait for the initialize event to be emitted and the service to be assigned
			await new Promise((resolve) => setImmediate(resolve))

			// Service should be assigned to task after initialization
			expect(task.checkpointService).toBe(mockService)
		})
	})
})
