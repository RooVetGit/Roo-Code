import { describe, it, expect, beforeEach, vi } from "vitest"
import { ClineProvider } from "../ClineProvider"
import { ContextProxy } from "../../config/ContextProxy"
import {
	DEFAULT_INCLUDE_DIAGNOSTIC_MESSAGES,
	DEFAULT_MAX_DIAGNOSTIC_MESSAGES,
} from "../../constants/diagnosticSettings"
import { TelemetryService } from "@roo-code/telemetry"

// Mock fs/promises to avoid file system operations
vi.mock("fs/promises", () => ({
	mkdir: vi.fn().mockResolvedValue(undefined),
	writeFile: vi.fn().mockResolvedValue(undefined),
	readFile: vi.fn().mockResolvedValue("{}"),
	unlink: vi.fn().mockResolvedValue(undefined),
	rmdir: vi.fn().mockResolvedValue(undefined),
}))

// Mock WorkspaceTracker to avoid vscode.window dependencies
vi.mock("../../../integrations/workspace/WorkspaceTracker", () => {
	return {
		default: vi.fn().mockImplementation(() => ({
			initializeFilePaths: vi.fn(),
			dispose: vi.fn(),
		})),
	}
})

// Mock vscode module
vi.mock("vscode", () => ({
	window: {
		tabGroups: {
			onDidChangeTabs: vi.fn(() => ({ dispose: vi.fn() })),
		},
		createTextEditorDecorationType: vi.fn(() => ({ dispose: vi.fn() })),
		showErrorMessage: vi.fn(),
		showInformationMessage: vi.fn(),
		showWarningMessage: vi.fn(),
	},
	workspace: {
		workspaceFolders: [],
		onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
		onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidOpenTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidCloseTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		getConfiguration: vi.fn(() => ({
			get: vi.fn(),
			update: vi.fn(),
		})),
	},
	Uri: {
		file: vi.fn(),
		joinPath: vi.fn(),
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

describe("Diagnostic Settings Persistence", () => {
	let provider: ClineProvider
	let mockContextProxy: ContextProxy
	let mockContext: any
	let mockOutputChannel: any

	beforeEach(() => {
		// Initialize TelemetryService if not already initialized
		if (!TelemetryService.hasInstance()) {
			TelemetryService.createInstance([])
		}

		// Mock VSCode context
		mockContext = {
			extension: {
				packageJSON: {
					version: "1.0.0",
				},
			},
			globalState: {
				get: vi.fn(),
				update: vi.fn(),
				keys: vi.fn().mockReturnValue([]),
			},
			secrets: {
				get: vi.fn(),
				store: vi.fn(),
				delete: vi.fn(),
			},
			globalStorageUri: {
				fsPath: "/test/path",
			},
		}

		// Mock output channel
		mockOutputChannel = {
			appendLine: vi.fn(),
		}

		// Create mock context proxy
		mockContextProxy = new ContextProxy(mockContext)

		// Create provider instance
		provider = new ClineProvider(mockContext, mockOutputChannel, "sidebar", mockContextProxy)
	})

	describe("getState", () => {
		it("should return default values when includeDiagnosticMessages is not set", async () => {
			const state = await provider.getState()

			expect(state.includeDiagnosticMessages).toBe(DEFAULT_INCLUDE_DIAGNOSTIC_MESSAGES)
			expect(state.maxDiagnosticMessages).toBe(DEFAULT_MAX_DIAGNOSTIC_MESSAGES)
		})

		it("should return saved false value for includeDiagnosticMessages", async () => {
			// Set the value to false
			await mockContextProxy.setValue("includeDiagnosticMessages", false)

			const state = await provider.getState()

			expect(state.includeDiagnosticMessages).toBe(false)
		})

		it("should return saved values for diagnostic settings", async () => {
			// Set custom values
			await mockContextProxy.setValue("includeDiagnosticMessages", false)
			await mockContextProxy.setValue("maxDiagnosticMessages", 25)

			const state = await provider.getState()

			expect(state.includeDiagnosticMessages).toBe(false)
			expect(state.maxDiagnosticMessages).toBe(25)
		})
	})

	describe("getStateToPostToWebview", () => {
		it("should include diagnostic settings in webview state", async () => {
			// Set custom values
			await mockContextProxy.setValue("includeDiagnosticMessages", false)
			await mockContextProxy.setValue("maxDiagnosticMessages", 30)

			const webviewState = await provider.getStateToPostToWebview()

			// Verify the settings are included in the webview state
			expect(webviewState.includeDiagnosticMessages).toBe(false)
			expect(webviewState.maxDiagnosticMessages).toBe(30)
		})

		it("should use default values when settings are not saved", async () => {
			const webviewState = await provider.getStateToPostToWebview()

			// Verify defaults are used
			expect(webviewState.includeDiagnosticMessages).toBe(DEFAULT_INCLUDE_DIAGNOSTIC_MESSAGES)
			expect(webviewState.maxDiagnosticMessages).toBe(DEFAULT_MAX_DIAGNOSTIC_MESSAGES)
		})

		it("should persist false value correctly", async () => {
			// This is the key test - ensure false values are not overridden by defaults
			await mockContextProxy.setValue("includeDiagnosticMessages", false)

			// Get state multiple times to simulate navigation
			const state1 = await provider.getStateToPostToWebview()
			expect(state1.includeDiagnosticMessages).toBe(false)

			// Simulate navigating away and back
			const state2 = await provider.getStateToPostToWebview()
			expect(state2.includeDiagnosticMessages).toBe(false)
		})
	})
})
