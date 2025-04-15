import * as vscode from "vscode"
import { activate, deactivate } from "../extension"
import { WebSocketServer } from "../services/extend/websocket-server"
import { writeWebSocketConfig } from "../utils/websocket-config"

// Mock dependencies
jest.mock("vscode")
jest.mock("../services/extend/websocket-server")
jest.mock("../utils/websocket-config")
jest.mock("../core/webview/ClineProvider")
jest.mock("../services/telemetry/TelemetryService", () => ({
	telemetryService: {
		initialize: jest.fn(),
		setProvider: jest.fn(),
		shutdown: jest.fn(),
	},
}))
jest.mock("../integrations/terminal/TerminalRegistry", () => ({
	TerminalRegistry: {
		initialize: jest.fn(),
		cleanup: jest.fn(),
	},
}))
jest.mock("../services/mcp/McpServerManager", () => ({
	McpServerManager: {
		cleanup: jest.fn(),
	},
}))

describe("Extension", () => {
	let mockContext: vscode.ExtensionContext
	let mockOutputChannel: vscode.OutputChannel
	let mockWorkspaceConfig: any

	beforeEach(() => {
		jest.clearAllMocks()

		// Mock extension context
		mockContext = {
			subscriptions: [],
			globalState: {
				get: jest.fn(),
				update: jest.fn(),
				keys: jest.fn().mockReturnValue([]),
				setKeysForSync: jest.fn(),
			} as unknown as vscode.Memento & { setKeysForSync(keys: readonly string[]): void },
			workspaceState: {
				get: jest.fn(),
				update: jest.fn(),
				keys: jest.fn().mockReturnValue([]),
			} as unknown as vscode.Memento,
			extensionPath: "/mock/extension/path",
			extensionUri: {} as vscode.Uri,
			environmentVariableCollection: {
				getScoped: jest.fn(),
			} as unknown as vscode.GlobalEnvironmentVariableCollection,
			extensionMode: vscode.ExtensionMode.Development,
			logPath: "/mock/log/path",
			storageUri: {} as vscode.Uri,
			globalStorageUri: {} as vscode.Uri,
			logUri: {} as vscode.Uri,
			asAbsolutePath: jest.fn().mockImplementation((relativePath) => `/mock/extension/path/${relativePath}`),
			secrets: {} as vscode.SecretStorage,
			// Add missing properties required by TypeScript
			storagePath: "/mock/storage/path",
			globalStoragePath: "/mock/global/storage/path",
			extension: {} as vscode.Extension<any>,
			languageModelAccessInformation: {} as vscode.LanguageModelAccessInformation,
		}

		// Mock output channel
		mockOutputChannel = {
			appendLine: jest.fn(),
			append: jest.fn(),
			clear: jest.fn(),
			show: jest.fn(),
			hide: jest.fn(),
			dispose: jest.fn(),
			name: "Test Output Channel",
			replace: jest.fn(),
		}

		// Mock vscode.window.createOutputChannel
		;(vscode.window.createOutputChannel as jest.Mock).mockReturnValue(mockOutputChannel)

		// Mock workspace configuration
		mockWorkspaceConfig = {
			get: jest.fn(),
		}

		// Mock vscode.workspace.getConfiguration
		;(vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockWorkspaceConfig)

		// Mock WebSocketServer
		;(WebSocketServer.prototype.start as jest.Mock).mockImplementation(function (this: any) {
			this.getPort = jest.fn().mockReturnValue(12345)
		})
	})

	describe("activate", () => {
		it("should initialize the WebSocket server when enabled", async () => {
			// Mock configuration to enable WebSocket server
			mockWorkspaceConfig.get.mockImplementation((key: string, defaultValue: any) => {
				if (key === "websocket.enabled") {
					return true
				}
				return defaultValue
			})

			// Activate the extension
			await activate(mockContext)

			// Verify that the WebSocketServer constructor was called
			expect(WebSocketServer).toHaveBeenCalledWith(
				expect.anything(), // API
				expect.any(String), // Token
				mockOutputChannel,
				0, // Port 0 for random port assignment
			)

			// Verify that the WebSocketServer.start method was called
			expect(WebSocketServer.prototype.start).toHaveBeenCalled()

			// Verify that writeWebSocketConfig was called with the correct parameters
			expect(writeWebSocketConfig).toHaveBeenCalledWith({
				port: 12345,
				token: expect.any(String),
			})
		})

		it("should not initialize the WebSocket server when disabled", async () => {
			// Mock configuration to disable WebSocket server
			mockWorkspaceConfig.get.mockImplementation((key: string, defaultValue: any) => {
				if (key === "websocket.enabled") {
					return false
				}
				return defaultValue
			})

			// Activate the extension
			await activate(mockContext)

			// Verify that the WebSocketServer constructor was not called
			expect(WebSocketServer).not.toHaveBeenCalled()

			// Verify that writeWebSocketConfig was not called
			expect(writeWebSocketConfig).not.toHaveBeenCalled()
		})
	})

	describe("deactivate", () => {
		it("should dispose the WebSocket server when deactivated", async () => {
			// Mock configuration to enable WebSocket server
			mockWorkspaceConfig.get.mockImplementation((key: string, defaultValue: any) => {
				if (key === "websocket.enabled") {
					return true
				}
				return defaultValue
			})

			// Activate the extension
			await activate(mockContext)

			// Mock WebSocketServer.prototype.dispose
			const mockDispose = jest.fn()
			;(WebSocketServer.prototype as any).dispose = mockDispose

			// Deactivate the extension
			await deactivate()

			// Verify that the WebSocketServer.dispose method was called
			expect(mockDispose).toHaveBeenCalled()
		})
	})
})
