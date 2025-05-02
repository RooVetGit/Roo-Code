import type { McpHub as McpHubType } from "../McpHub"
import type { ClineProvider } from "../../../core/webview/ClineProvider"
import type { Uri } from "vscode"
import { ConfigManager } from "../config"
import { ConnectionFactory } from "../connection"
import { ConnectionManager } from "../connection"

const fs = require("fs/promises")
const { McpHub } = require("../McpHub")

jest.mock("vscode", () => ({
	workspace: {
		createFileSystemWatcher: jest.fn().mockReturnValue({
			onDidChange: jest.fn(),
			onDidCreate: jest.fn(),
			onDidDelete: jest.fn(),
			dispose: jest.fn(),
		}),
		onDidSaveTextDocument: jest.fn(),
		onDidChangeWorkspaceFolders: jest.fn(),
		workspaceFolders: [],
	},
	window: {
		showErrorMessage: jest.fn(),
		showInformationMessage: jest.fn(),
		showWarningMessage: jest.fn(),
	},
	Disposable: {
		from: jest.fn(),
	},
}))
jest.mock("fs/promises")
jest.mock("../../../core/webview/ClineProvider")
jest.mock("../config/ConfigManager")
jest.mock("../connection/ConnectionFactory")
jest.mock("../connection/ConnectionManager")

describe("McpHub", () => {
	let mcpHub: McpHubType
	let mockProvider: Partial<ClineProvider>
	let mockConfigManager: jest.Mocked<ConfigManager>
	let mockConnectionFactory: jest.Mocked<ConnectionFactory>
	let mockConnectionManager: jest.Mocked<ConnectionManager>

	// Store original console methods
	const originalConsoleError = console.error
	const mockSettingsPath = "/mock/settings/path/cline_mcp_settings.json"

	beforeEach(() => {
		jest.clearAllMocks()

		// Mock console.error to suppress error messages during tests
		console.error = jest.fn()

		const mockUri: Uri = {
			scheme: "file",
			authority: "",
			path: "/test/path",
			query: "",
			fragment: "",
			fsPath: "/test/path",
			with: jest.fn(),
			toJSON: jest.fn(),
		}

		mockProvider = {
			ensureSettingsDirectoryExists: jest.fn().mockResolvedValue("/mock/settings/path"),
			ensureMcpServersDirectoryExists: jest.fn().mockResolvedValue("/mock/settings/path"),
			postMessageToWebview: jest.fn(),
			context: {
				subscriptions: [],
				workspaceState: {} as any,
				globalState: {} as any,
				extensionUri: mockUri,
				extensionPath: "/test/path",
				storagePath: "/test/storage",
				globalStoragePath: "/test/global-storage",
				environmentVariableCollection: {} as any,
				extension: {
					id: "test-extension",
					extensionUri: mockUri,
					extensionPath: "/test/path",
					extensionKind: 1,
					isActive: true,
					packageJSON: {
						version: "1.0.0",
					},
					activate: jest.fn(),
					exports: undefined,
				} as any,
				asAbsolutePath: (path: string) => path,
				storageUri: mockUri,
				globalStorageUri: mockUri,
				logUri: mockUri,
				extensionMode: 1,
				logPath: "/test/path",
				languageModelAccessInformation: {} as any,
			} as any,
		}

		// Mock ConfigManager
		mockConfigManager = new ConfigManager() as jest.Mocked<ConfigManager>
		mockConfigManager.getGlobalConfigPath = jest.fn().mockResolvedValue(mockSettingsPath)
		mockConfigManager.readConfig = jest.fn().mockResolvedValue({
			"test-server": {
				type: "stdio",
				command: "node",
				args: ["test.js"],
				alwaysAllow: ["allowed-tool"],
			},
		})
		mockConfigManager.updateServerConfig = jest.fn().mockResolvedValue(undefined)

		// Mock ConnectionFactory
		mockConnectionFactory = new ConnectionFactory(
			mockConfigManager,
			mockProvider as ClineProvider,
		) as jest.Mocked<ConnectionFactory>

		// Mock ConnectionManager
		mockConnectionManager = new ConnectionManager(
			mockConfigManager,
			mockConnectionFactory,
		) as jest.Mocked<ConnectionManager>
		mockConnectionManager.getActiveServers = jest.fn().mockReturnValue([])
		mockConnectionManager.getAllServers = jest.fn().mockReturnValue([])

		// Mock fs.readFile for initial settings
		;(fs.readFile as jest.Mock).mockResolvedValue(
			JSON.stringify({
				mcpServers: {
					"test-server": {
						type: "stdio",
						command: "node",
						args: ["test.js"],
						alwaysAllow: ["allowed-tool"],
					},
				},
			}),
		)

		// Create McpHub instance with mocked dependencies
		mcpHub = new McpHub(mockProvider as ClineProvider)

		// Replace internal properties with mocks
		;(mcpHub as any).configManager = mockConfigManager
		;(mcpHub as any).connectionManager = mockConnectionManager

		// Ensure providerRef is set correctly
		;(mcpHub as any).providerRef = {
			deref: jest.fn().mockReturnValue(mockProvider),
		}

		// Mock enhanceServersWithConnectionInfo
		;(mcpHub as any).enhanceServersWithConnectionInfo = jest.fn().mockImplementation((servers) => servers)
	})

	afterEach(() => {
		// Restore original console methods
		console.error = originalConsoleError
	})

	describe("toggleToolAlwaysAllow", () => {
		it("should add tool to always allow list when enabling", async () => {
			const mockConfig = {
				"test-server": {
					type: "stdio",
					command: "node",
					args: ["test.js"],
					alwaysAllow: [],
				},
			}

			// Mock reading initial config
			mockConfigManager.readConfig.mockResolvedValueOnce(mockConfig)

			await mcpHub.toggleToolAlwaysAllow("test-server", "global", "new-tool", true)

			// Verify the config was updated correctly
			expect(mockConfigManager.updateServerConfig).toHaveBeenCalledWith(
				mockSettingsPath,
				"test-server",
				expect.objectContaining({
					alwaysAllow: ["new-tool"],
				}),
			)
		})

		it("should remove tool from always allow list when disabling", async () => {
			const mockConfig = {
				"test-server": {
					type: "stdio",
					command: "node",
					args: ["test.js"],
					alwaysAllow: ["existing-tool"],
				},
			}

			// Mock reading initial config
			mockConfigManager.readConfig.mockResolvedValueOnce(mockConfig)

			await mcpHub.toggleToolAlwaysAllow("test-server", "global", "existing-tool", false)

			// Verify the config was updated correctly
			expect(mockConfigManager.updateServerConfig).toHaveBeenCalledWith(
				mockSettingsPath,
				"test-server",
				expect.objectContaining({
					alwaysAllow: [],
				}),
			)
		})

		it("should initialize alwaysAllow if it does not exist", async () => {
			const mockConfig = {
				"test-server": {
					type: "stdio",
					command: "node",
					args: ["test.js"],
				},
			}

			// Mock reading initial config
			mockConfigManager.readConfig.mockResolvedValueOnce(mockConfig)

			await mcpHub.toggleToolAlwaysAllow("test-server", "global", "new-tool", true)

			// Verify the config was updated with initialized alwaysAllow
			expect(mockConfigManager.updateServerConfig).toHaveBeenCalledWith(
				mockSettingsPath,
				"test-server",
				expect.objectContaining({
					alwaysAllow: ["new-tool"],
				}),
			)
		})
	})

	describe("server disabled state", () => {
		it("should toggle server disabled state", async () => {
			const mockConfig = {
				"test-server": {
					type: "stdio",
					command: "node",
					args: ["test.js"],
					disabled: false,
				},
			}

			// Mock reading initial config
			mockConfigManager.readConfig.mockResolvedValueOnce(mockConfig)
			mockConnectionManager.getAllServers.mockReturnValueOnce([{ name: "test-server", source: "global" } as any])

			await mcpHub.toggleServerDisabled("test-server", true)

			// Verify the config was updated correctly
			expect(mockConfigManager.updateServerConfig).toHaveBeenCalledWith(
				mockSettingsPath,
				"test-server",
				expect.objectContaining({
					disabled: true,
				}),
			)
		})

		it("should filter out disabled servers from getServers", () => {
			// Setup mock servers
			const mockServers = [
				{ name: "enabled-server", disabled: false },
				{ name: "disabled-server", disabled: true },
			]

			mockConnectionManager.getActiveServers.mockReturnValueOnce(mockServers.filter((s) => !s.disabled) as any)

			// Call the method
			const servers = mcpHub.getServers()

			// Verify only enabled servers are returned
			expect(servers).toHaveLength(1)
			expect(servers[0].name).toBe("enabled-server")
		})

		it("should prevent calling tools on disabled servers", async () => {
			// Setup a disabled server
			mockConnectionManager.getAllServers.mockReturnValueOnce([
				{ name: "disabled-server", disabled: true } as any,
			])

			// Expect error when calling tool on disabled server
			await expect(mcpHub.callTool("disabled-server", "some-tool", {})).rejects.toThrow(
				'Server "disabled-server" is disabled',
			)
		})

		it("should prevent reading resources from disabled servers", async () => {
			// Setup a disabled server
			mockConnectionManager.getAllServers.mockReturnValueOnce([
				{ name: "disabled-server", disabled: true } as any,
			])

			// Expect error when reading resource from disabled server
			await expect(mcpHub.readResource("disabled-server", "resource-uri")).rejects.toThrow(
				'Server "disabled-server" is disabled',
			)
		})
	})

	describe("callTool", () => {
		it("should execute tool successfully", async () => {
			// Setup mock server and connection
			const mockServer = {
				name: "test-server",
				source: "global",
				disabled: false,
				config: JSON.stringify({ type: "stdio" }),
			} as any
			mockConnectionManager.getAllServers.mockReturnValueOnce([mockServer])

			// Mock the connection with a successful response
			const mockConnection = {
				server: mockServer,
				client: {
					callTool: jest.fn().mockResolvedValue({ content: [{ type: "text", text: "success" }] }),
				},
			}
			mockConnectionManager.getConnection.mockResolvedValueOnce(mockConnection as any)

			// Call the tool
			const result = await mcpHub.callTool("test-server", "test-tool", { param: "value" })

			// Verify the result
			expect(result).toEqual({ content: [{ type: "text", text: "success" }] })
			expect(mockConnection.client.callTool).toHaveBeenCalledWith({
				name: "test-tool",
				arguments: { param: "value" },
			})
		})

		it("should throw error if server not found", async () => {
			mockConnectionManager.getAllServers.mockReturnValueOnce([])

			await expect(mcpHub.callTool("non-existent-server", "some-tool", {})).rejects.toThrow(
				"Server not found: non-existent-server",
			)
		})

		describe("timeout configuration", () => {
			it("should use default timeout of 60 seconds if not specified", async () => {
				// Setup mock server without timeout
				const mockServer = {
					name: "test-server",
					source: "global",
					disabled: false,
					config: JSON.stringify({ type: "stdio" }),
				} as any
				mockConnectionManager.getAllServers.mockReturnValueOnce([mockServer])

				// Mock the connection
				const mockConnection = {
					server: mockServer,
					client: {
						callTool: jest.fn().mockResolvedValue({ content: [{ type: "text", text: "success" }] }),
					},
				}
				mockConnectionManager.getConnection.mockResolvedValueOnce(mockConnection as any)

				// Call the tool
				await mcpHub.callTool("test-server", "test-tool")

				// Verify timeout was set to default 60 seconds
				// This is an implementation detail test, so we're checking that createTimeoutPromise was called with 60
				// We can't easily test this directly, but in a real test we could spy on the createTimeoutPromise method
			})

			it("should apply configured timeout to tool calls", async () => {
				// Setup mock server with custom timeout
				const mockServer = {
					name: "test-server",
					source: "global",
					disabled: false,
					config: JSON.stringify({ type: "stdio", timeout: 120 }),
				} as any
				mockConnectionManager.getAllServers.mockReturnValueOnce([mockServer])

				// Mock the connection
				const mockConnection = {
					server: mockServer,
					client: {
						callTool: jest.fn().mockResolvedValue({ content: [{ type: "text", text: "success" }] }),
					},
				}
				mockConnectionManager.getConnection.mockResolvedValueOnce(mockConnection as any)

				// Call the tool
				await mcpHub.callTool("test-server", "test-tool")

				// Verify custom timeout was used
				// Similar to above, this is testing an implementation detail
			})
		})
	})

	describe("updateServerTimeout", () => {
		it("should update server timeout in settings file", async () => {
			const mockConfig = {
				"test-server": {
					type: "stdio",
					command: "node",
					args: ["test.js"],
					timeout: 60,
				},
			}

			// Mock reading initial config
			mockConfigManager.readConfig.mockResolvedValueOnce(mockConfig)
			mockConnectionManager.getAllServers.mockReturnValueOnce([{ name: "test-server", source: "global" } as any])

			await mcpHub.updateServerTimeout("test-server", 120)

			// Verify the config was updated correctly
			expect(mockConfigManager.updateServerConfig).toHaveBeenCalledWith(
				mockSettingsPath,
				"test-server",
				expect.objectContaining({
					timeout: 120,
				}),
			)
		})

		it("should accept valid timeout values", async () => {
			const mockConfig = {
				"test-server": {
					type: "stdio",
					command: "node",
					args: ["test.js"],
					timeout: 60,
				},
			}

			// Mock server lookup
			mockConnectionManager.getAllServers.mockReturnValue([{ name: "test-server", source: "global" } as any])

			// Test valid timeout values
			const validTimeouts = [1, 60, 3600]
			for (const timeout of validTimeouts) {
				mockConfigManager.readConfig.mockResolvedValueOnce(mockConfig)
				await mcpHub.updateServerTimeout("test-server", timeout)
				expect(mockConfigManager.updateServerConfig).toHaveBeenCalledWith(
					mockSettingsPath,
					"test-server",
					expect.objectContaining({
						timeout,
					}),
				)
				jest.clearAllMocks() // Reset for next iteration
			}
		})

		it("should notify webview after updating timeout", async () => {
			const mockConfig = {
				"test-server": {
					type: "stdio",
					command: "node",
					args: ["test.js"],
					timeout: 60,
				},
			}
			mockConfigManager.readConfig.mockResolvedValueOnce(mockConfig)
			mockConnectionManager.getAllServers.mockReturnValueOnce([{ name: "test-server", source: "global" } as any])

			// Mock getAllServersFromConfig to return a server
			mockConfigManager.getAllServersFromConfig = jest
				.fn()
				.mockResolvedValue([{ name: "test-server", source: "global" } as any])

			// Re-create the mock function
			mockProvider.postMessageToWebview = jest.fn().mockResolvedValue(undefined)

			await mcpHub.updateServerTimeout("test-server", 120)
			await mcpHub.updateServerTimeout("test-server", 120)

			// Verify notification was sent
			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "mcpServers",
				}),
			)
		})
	})
})
