import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { CodeIndexManager } from "../manager"
import * as vscode from "vscode"
import { ContextProxy } from "../../../core/config/ContextProxy"

// Mock dependencies
vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [{ uri: { fsPath: "/test/workspace" } }],
	},
	ExtensionContext: vi.fn(),
	EventEmitter: vi.fn().mockImplementation(() => ({
		fire: vi.fn(),
		event: vi.fn(),
		dispose: vi.fn(),
	})),
	Uri: {
		joinPath: vi.fn().mockImplementation((base, ...paths) => ({
			fsPath: [base?.fsPath || base, ...paths].join("/"),
		})),
		file: vi.fn().mockImplementation((path) => ({ fsPath: path })),
	},
}))

vi.mock("../../../utils/path", () => ({
	getWorkspacePath: vi.fn(() => "/test/workspace"),
}))

vi.mock("fs/promises", () => ({
	default: {
		readFile: vi.fn().mockRejectedValue(new Error("File not found")),
	},
}))

// Track mock instances
let mockStateManagerInstance: any
let mockServiceFactoryInstance: any

vi.mock("../state-manager", () => ({
	CodeIndexStateManager: vi.fn().mockImplementation(() => {
		mockStateManagerInstance = {
			onProgressUpdate: vi.fn(),
			getCurrentStatus: vi.fn().mockReturnValue({ state: "Idle", error: null }),
			dispose: vi.fn(),
			setSystemState: vi.fn(),
		}
		return mockStateManagerInstance
	}),
}))

vi.mock("../service-factory", () => ({
	CodeIndexServiceFactory: vi.fn().mockImplementation(() => {
		mockServiceFactoryInstance = {
			createServices: vi.fn().mockReturnValue({
				embedder: { embedderInfo: { name: "ollama" } },
				vectorStore: {},
				scanner: {},
				fileWatcher: {
					onDidStartBatchProcessing: vi.fn(),
					onBatchProgressUpdate: vi.fn(),
					watch: vi.fn(),
					stopWatcher: vi.fn(),
					dispose: vi.fn(),
				},
			}),
			validateEmbedder: vi.fn().mockResolvedValue({ valid: true }), // Default to valid
		}
		return mockServiceFactoryInstance
	}),
}))

vi.mock("../search-service", () => ({
	CodeIndexSearchService: vi.fn().mockImplementation(() => ({
		searchIndex: vi.fn(),
	})),
}))

vi.mock("../orchestrator", () => ({
	CodeIndexOrchestrator: vi.fn().mockImplementation(() => ({
		state: "Idle",
		startIndexing: vi.fn(),
		stopWatcher: vi.fn(),
		clearIndexData: vi.fn(),
	})),
}))

describe("Proactive Embedder Validation", () => {
	let manager: CodeIndexManager
	let mockContext: vscode.ExtensionContext
	let mockContextProxy: ContextProxy

	beforeEach(() => {
		// Clear all instances before each test
		;(CodeIndexManager as any).instances.clear()

		mockContext = {
			subscriptions: [],
			extensionPath: "/test/extension",
			globalState: {
				get: vi.fn(),
				update: vi.fn(),
			},
			secrets: {
				get: vi.fn(),
				store: vi.fn(),
			},
			globalStorageUri: { fsPath: "/test/global-storage" },
		} as any

		mockContextProxy = {
			getValue: vi.fn().mockImplementation((key) => {
				if (key === "codebaseIndexConfig") {
					return {
						codebaseIndexEnabled: true,
						codebaseIndexQdrantUrl: "http://localhost:6333",
						codebaseIndexEmbedderProvider: "ollama",
						codebaseIndexEmbedderModelId: "nomic-embed-text",
					}
				}
				return undefined
			}),
			setValue: vi.fn(),
			getSecret: vi.fn().mockImplementation((key) => {
				if (key === "codeIndexOpenAiKey") return "test-key"
				return undefined
			}),
			storeSecret: vi.fn(),
			getGlobalState: vi.fn().mockImplementation((key) => {
				if (key === "codebaseIndexConfig") {
					return {
						codebaseIndexEnabled: true,
						codebaseIndexQdrantUrl: "http://localhost:6333",
						codebaseIndexEmbedderProvider: "ollama",
						codebaseIndexEmbedderModelId: "nomic-embed-text",
					}
				}
				return undefined
			}),
			setGlobalState: vi.fn(),
			refreshSecrets: vi.fn().mockResolvedValue(undefined),
		} as any

		// Create manager instance
		manager = CodeIndexManager.getInstance(mockContext)!
	})

	afterEach(() => {
		vi.clearAllMocks()
		CodeIndexManager.disposeAll()
	})

	it("should validate embedder when provider changes during handleSettingsChange", async () => {
		// Initialize manager first
		await manager.initialize(mockContextProxy)

		// Mock the config manager to simulate a provider change that requires restart
		const configManager = (manager as any)._configManager
		vi.spyOn(configManager, "loadConfiguration").mockResolvedValue({ requiresRestart: true })
		vi.spyOn(configManager, "isFeatureEnabled", "get").mockReturnValue(true)
		vi.spyOn(configManager, "isFeatureConfigured", "get").mockReturnValue(true)

		// Clear all previous calls to track new calls
		mockServiceFactoryInstance.validateEmbedder.mockClear()

		// Call handleSettingsChange
		try {
			await manager.handleSettingsChange()
		} catch (error) {
			// We expect this to potentially throw, but we're mainly interested in whether validation was called
		}

		// Verify validation was called during handleSettingsChange
		expect(mockServiceFactoryInstance.validateEmbedder).toHaveBeenCalled()
	})

	it("should start indexing when validation succeeds after provider change", async () => {
		// Initialize manager first
		await manager.initialize(mockContextProxy)

		// Mock the config manager to simulate a provider change that requires restart
		const configManager = (manager as any)._configManager
		vi.spyOn(configManager, "loadConfiguration").mockResolvedValue({ requiresRestart: true })
		vi.spyOn(configManager, "isFeatureEnabled", "get").mockReturnValue(true)
		vi.spyOn(configManager, "isFeatureConfigured", "get").mockReturnValue(true)

		// Mock the service factory to simulate validation success
		mockServiceFactoryInstance.validateEmbedder.mockResolvedValue({
			valid: true,
		})

		// Mock startIndexing
		const startIndexingSpy = vi.spyOn(manager, "startIndexing").mockResolvedValue(undefined)

		// Call handleSettingsChange should succeed
		await manager.handleSettingsChange()

		// Verify indexing was started
		expect(startIndexingSpy).toHaveBeenCalled()

		// Verify no error state was set
		expect(mockStateManagerInstance.setSystemState).not.toHaveBeenCalledWith("Error", expect.any(String))
	})
})
