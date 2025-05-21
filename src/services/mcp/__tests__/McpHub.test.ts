import type { McpHub as McpHubType, McpConnection } from "../McpHub"
import type { ClineProvider } from "../../../core/webview/ClineProvider"
import type { ExtensionContext, Uri } from "vscode"
import { ServerConfigSchema } from "../McpHub"

const fs = require("fs/promises")
const { McpHub } = jest.requireActual("../McpHub") // Use requireActual to get the real module

let originalConsoleError: typeof console.error = console.error // Store original console methods globally

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

// Mock the McpHub module itself
jest.mock("../McpHub", () => {
	const originalModule = jest.requireActual("../McpHub")
	return {
		__esModule: true,
		...originalModule,
		McpHub: jest.fn().mockImplementation((provider) => {
			const instance = new originalModule.McpHub(provider)
			// Spy on private methods
			jest.spyOn(instance, "updateServerConfig" as any).mockResolvedValue(undefined)
			jest.spyOn(instance, "findConnection" as any).mockReturnValue({ server: { disabled: false } } as any)
			jest.spyOn(instance, "initializeMcpServers" as any).mockResolvedValue(undefined)
			jest.spyOn(instance, "notifyWebviewOfServerChanges" as any).mockResolvedValue(undefined)
			jest.spyOn(instance, "restartConnection" as any).mockResolvedValue(undefined)
			jest.spyOn(instance, "showErrorMessage" as any).mockImplementation(jest.fn())
			jest.spyOn(instance, "getAllServers" as any).mockReturnValue([
				{ name: "server1", source: "global", disabled: false, config: "{}", status: "connected" },
				{ name: "server2", source: "project", disabled: false, config: "{}", status: "connected" },
			])
			return instance
		}),
	}
})

describe("McpHub", () => {
	let mcpHub: McpHubType
	let mockProvider: Partial<ClineProvider>

	beforeEach(() => {
		jest.clearAllMocks()

		// Mock console.error to suppress error messages during tests
		originalConsoleError = console.error // Store original before mocking
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
				secrets: {} as any,
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
			} as ExtensionContext,
		}

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

		mcpHub = new McpHub(mockProvider as ClineProvider)
	})

	afterEach(() => {
		// Restore original console methods
		console.error = originalConsoleError
	})

	describe("toggleToolAlwaysAllow", () => {
		it("should add tool to always allow list when enabling", async () => {
			const mockConfig = {
				mcpServers: {
					"test-server": {
						type: "stdio",
						command: "node",
						args: ["test.js"],
						alwaysAllow: [],
					},
				},
			}

			// Mock reading initial config
			;(fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockConfig))

			await mcpHub.toggleToolAlwaysAllow("test-server", "global", "new-tool", true)

			// Verify the config was updated correctly
			const writeCalls = (fs.writeFile as jest.Mock).mock.calls
			expect(writeCalls.length).toBeGreaterThan(0)

			// Find the write call
			const callToUse = writeCalls[writeCalls.length - 1]
			expect(callToUse).toBeTruthy()

			// The path might be normalized differently on different platforms,
			// so we'll just check that we have a call with valid content
			const writtenConfig = JSON.parse(callToUse[1])
			expect(writtenConfig.mcpServers).toBeDefined()
			expect(writtenConfig.mcpServers["test-server"]).toBeDefined()
			expect(Array.isArray(writtenConfig.mcpServers["test-server"].alwaysAllow)).toBe(true)
			expect(writtenConfig.mcpServers["test-server"].alwaysAllow).toContain("new-tool")
		})

		it("should remove tool from always allow list when disabling", async () => {
			const mockConfig = {
				mcpServers: {
					"test-server": {
						type: "stdio",
						command: "node",
						args: ["test.js"],
						alwaysAllow: ["existing-tool"],
					},
				},
			}

			// Mock reading initial config
			;(fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockConfig))

			await mcpHub.toggleToolAlwaysAllow("test-server", "global", "existing-tool", false)

			// Verify the config was updated correctly
			const writeCalls = (fs.writeFile as jest.Mock).mock.calls
			expect(writeCalls.length).toBeGreaterThan(0)

			// Find the write call
			const callToUse = writeCalls[writeCalls.length - 1]
			expect(callToUse).toBeTruthy()

			// The path might be normalized differently on different platforms,
			// so we'll just check that we have a call with valid content
			const writtenConfig = JSON.parse(callToUse[1])
			expect(writtenConfig.mcpServers).toBeDefined()
			expect(writtenConfig.mcpServers["test-server"]).toBeDefined()
			expect(Array.isArray(writtenConfig.mcpServers["test-server"].alwaysAllow)).toBe(true)
			expect(writtenConfig.mcpServers["test-server"].alwaysAllow).not.toContain("existing-tool")
		})

		it("should initialize alwaysAllow if it does not exist", async () => {
			const mockConfig = {
				mcpServers: {
					"test-server": {
						type: "stdio",
						command: "node",
						args: ["test.js"],
					},
				},
			}

			// Mock reading initial config
			;(fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockConfig))

			await mcpHub.toggleToolAlwaysAllow("test-server", "global", "new-tool", true)

			// Verify the config was updated with initialized alwaysAllow
			// Find the write call with the normalized path
			const normalizedSettingsPath = "/mock/settings/path/cline_mcp_settings.json"
			const writeCalls = (fs.writeFile as jest.Mock).mock.calls

			// Find the write call with the normalized path
			const writeCall = writeCalls.find((call) => call[0] === normalizedSettingsPath)
			const callToUse = writeCall || writeCalls[0]

			const writtenConfig = JSON.parse(callToUse[1])
			expect(writtenConfig.mcpServers["test-server"].alwaysAllow).toBeDefined()
			expect(writtenConfig.mcpServers["test-server"].alwaysAllow).toContain("new-tool")
		})
	})

	describe("server disabled state", () => {
		it("should toggle server disabled state", async () => {
			const mockConfig = {
				mcpServers: {
					"test-server": {
						type: "stdio",
						command: "node",
						args: ["test.js"],
						disabled: false,
					},
				},
			}

			// Mock reading initial config
			;(fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockConfig))

			await mcpHub.toggleServerDisabled("test-server", true)

			// Verify the config was updated correctly
			// Find the write call with the normalized path
			const normalizedSettingsPath = "/mock/settings/path/cline_mcp_settings.json"
			const writeCalls = (fs.writeFile as jest.Mock).mock.calls

			// Find the write call with the normalized path
			const writeCall = writeCalls.find((call) => call[0] === normalizedSettingsPath)
			const callToUse = writeCall || writeCalls[0]

			const writtenConfig = JSON.parse(callToUse[1])
			expect(writtenConfig.mcpServers["test-server"].disabled).toBe(true)
		})

		it("should filter out disabled servers from getServers", () => {
			const mockConnections: McpConnection[] = [
				{
					server: {
						name: "enabled-server",
						config: "{}",
						status: "connected",
						disabled: false,
					},
					client: {} as any,
					transport: {} as any,
				},
				{
					server: {
						name: "disabled-server",
						config: "{}",
						status: "connected",
						disabled: true,
					},
					client: {} as any,
					transport: {} as any,
				},
			]

			mcpHub.connections = mockConnections
			const servers = mcpHub.getServers()

			expect(servers.length).toBe(1)
			expect(servers[0].name).toBe("enabled-server")
		})

		it("should prevent calling tools on disabled servers", async () => {
			const mockConnection: McpConnection = {
				server: {
					name: "disabled-server",
					config: "{}",
					status: "connected",
					disabled: true,
				},
				client: {
					request: jest.fn().mockResolvedValue({ result: "success" }),
				} as any,
				transport: {} as any,
			}

			mcpHub.connections = [mockConnection]

			await expect(mcpHub.callTool("disabled-server", "some-tool", {})).rejects.toThrow(
				'Server "disabled-server" is disabled and cannot be used',
			)
		})

		it("should prevent reading resources from disabled servers", async () => {
			const mockConnection: McpConnection = {
				server: {
					name: "disabled-server",
					config: "{}",
					status: "connected",
					disabled: true,
				},
				client: {
					request: jest.fn(),
				} as any,
				transport: {} as any,
			}

			mcpHub.connections = [mockConnection]

			await expect(mcpHub.readResource("disabled-server", "some/uri")).rejects.toThrow(
				'Server "disabled-server" is disabled',
			)
		})
	})

	describe("toggleAllServersDisabled", () => {
		it("should disable all servers when passed true", async () => {
			const mockConnections: McpConnection[] = [
				{
					server: {
						name: "server1",
						config: "{}",
						status: "connected",
						disabled: false,
					},
					client: {} as any,
					transport: {} as any,
				},
				{
					server: {
						name: "server2",
						config: "{}",
						status: "connected",
						disabled: false,
					},
					client: {} as any,
					transport: {} as any,
				},
			]
			mcpHub.connections = mockConnections

			// Mock fs.readFile to return a config with both servers enabled
			;(fs.readFile as jest.Mock).mockResolvedValueOnce(
				JSON.stringify({
					mcpServers: {
						server1: { disabled: false },
						server2: { disabled: false },
					},
				}),
			)

			await mcpHub.toggleAllServersDisabled(true)

			// Verify that both servers are now disabled in the connections
			expect(mcpHub.connections[0].server.disabled).toBe(true)
			expect(mcpHub.connections[1].server.disabled).toBe(true)

			// Mock fs.readFile and fs.writeFile to track config changes
			let currentConfig = JSON.stringify({
				mcpServers: {
					server1: { disabled: false },
					server2: { disabled: false },
				},
			})
			;(fs.readFile as jest.Mock).mockImplementation(async () => currentConfig)
			;(fs.writeFile as jest.Mock).mockImplementation(async (path, data) => {
				currentConfig = data
			})

			await mcpHub.toggleAllServersDisabled(true)

			// Verify that both servers are now disabled in the connections
			expect(mcpHub.connections[0].server.disabled).toBe(true)
			expect(mcpHub.connections[1].server.disabled).toBe(true)

			// Verify that fs.writeFile was called to persist the changes
			const writtenConfig = JSON.parse(currentConfig)
			expect(writtenConfig.mcpServers.server1.disabled).toBe(true)
			expect(writtenConfig.mcpServers.server2.disabled).toBe(true)

			// Verify that postMessageToWebview was called
			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "mcpServers",
				}),
			)
		})

		it("should enable all servers when passed false", async () => {
			const mockConnections: McpConnection[] = [
				{
					server: {
						name: "server1",
						config: "{}",
						status: "connected",
						disabled: true,
					},
					client: {} as any,
					transport: {} as any,
				},
				{
					server: {
						name: "server2",
						config: "{}",
						status: "connected",
						disabled: true,
					},
					client: {} as any,
					transport: {} as any,
				},
			]
			mcpHub.connections = mockConnections

			// Mock fs.readFile to return a config with both servers disabled
			let currentConfig = JSON.stringify({
				mcpServers: {
					server1: { disabled: true },
					server2: { disabled: true },
				},
			})
			;(fs.readFile as jest.Mock).mockImplementation(async () => currentConfig)
			;(fs.writeFile as jest.Mock).mockImplementation(async (path, data) => {
				currentConfig = data
			})

			await mcpHub.toggleAllServersDisabled(false)

			// Verify that both servers are now enabled in the connections
			expect(mcpHub.connections[0].server.disabled).toBe(false)
			expect(mcpHub.connections[1].server.disabled).toBe(false)

			// Verify that fs.writeFile was called to persist the changes
			const writtenConfig = JSON.parse(currentConfig)
			expect(writtenConfig.mcpServers.server1.disabled).toBe(false)
			expect(writtenConfig.mcpServers.server2.disabled).toBe(false)

			// Verify that postMessageToWebview was called
			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "mcpServers",
				}),
			)
		})
	})

	describe("callTool", () => {
		it("should execute tool successfully", async () => {
			// Mock the connection with a minimal client implementation
			const mockConnection: McpConnection = {
				server: {
					name: "test-server",
					config: JSON.stringify({}),
					status: "connected" as const,
				},
				client: {
					request: jest.fn().mockResolvedValue({ result: "success" }),
				} as any,
				transport: {
					start: jest.fn(),
					close: jest.fn(),
					stderr: { on: jest.fn() },
				} as any,
			}

			mcpHub.connections = [mockConnection]

			await mcpHub.callTool("test-server", "some-tool", {})

			// Verify the request was made with correct parameters
			expect(mockConnection.client.request).toHaveBeenCalledWith(
				{
					method: "tools/call",
					params: {
						name: "some-tool",
						arguments: {},
					},
				},
				expect.any(Object),
				expect.objectContaining({ timeout: 60000 }), // Default 60 second timeout
			)
		})

		it("should throw error if server not found", async () => {
			await expect(mcpHub.callTool("non-existent-server", "some-tool", {})).rejects.toThrow(
				"No connection found for server: non-existent-server",
			)
		})

		describe("timeout configuration", () => {
			it("should validate timeout values", () => {
				// Test valid timeout values
				const validConfig = {
					type: "stdio",
					command: "test",
					timeout: 60,
				}
				expect(() => ServerConfigSchema.parse(validConfig)).not.toThrow()

				// Test invalid timeout values
				const invalidConfigs = [
					{ type: "stdio", command: "test", timeout: 0 }, // Too low
					{ type: "stdio", command: "test", timeout: 3601 }, // Too high
					{ type: "stdio", command: "test", timeout: -1 }, // Negative
				]

				invalidConfigs.forEach((config) => {
					expect(() => ServerConfigSchema.parse(config)).toThrow()
				})
			})

			it("should use default timeout of 60 seconds if not specified", async () => {
				const mockConnection: McpConnection = {
					server: {
						name: "test-server",
						config: JSON.stringify({ type: "stdio", command: "test" }), // No timeout specified
						status: "connected",
					},
					client: {
						request: jest.fn().mockResolvedValue({ content: [] }),
					} as any,
					transport: {} as any,
				}

				mcpHub.connections = [mockConnection]
				await mcpHub.callTool("test-server", "test-tool")

				expect(mockConnection.client.request).toHaveBeenCalledWith(
					expect.anything(),
					expect.anything(),
					expect.objectContaining({ timeout: 60000 }), // 60 seconds in milliseconds
				)
			})

			it("should apply configured timeout to tool calls", async () => {
				const mockConnection: McpConnection = {
					server: {
						name: "test-server",
						config: JSON.stringify({ type: "stdio", command: "test", timeout: 120 }), // 2 minutes
						status: "connected",
					},
					client: {
						request: jest.fn().mockResolvedValue({ content: [] }),
					} as any,
					transport: {} as any,
				}

				mcpHub.connections = [mockConnection]
				await mcpHub.callTool("test-server", "test-tool")

				expect(mockConnection.client.request).toHaveBeenCalledWith(
					expect.anything(),
					expect.anything(),
					expect.objectContaining({ timeout: 120000 }), // 120 seconds in milliseconds
				)
			})
		})

		describe("updateServerTimeout", () => {
			it("should update server timeout in settings file", async () => {
				const mockConfig = {
					mcpServers: {
						"test-server": {
							type: "stdio",
							command: "node",
							args: ["test.js"],
							timeout: 60,
						},
					},
				}

				// Mock reading initial config
				;(fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockConfig))

				await mcpHub.updateServerTimeout("test-server", 120)

				// Verify the config was updated correctly
				// Find the write call with the normalized path
				const normalizedSettingsPath = "/mock/settings/path/cline_mcp_settings.json"
				const writeCalls = (fs.writeFile as jest.Mock).mock.calls

				// Find the write call with the normalized path
				const writeCall = writeCalls.find((call) => call[0] === normalizedSettingsPath)
				const callToUse = writeCall || writeCalls[0]

				const writtenConfig = JSON.parse(callToUse[1])
				expect(writtenConfig.mcpServers["test-server"].timeout).toBe(120)
			})

			it("should fallback to default timeout when config has invalid timeout", async () => {
				const mockConfig = {
					mcpServers: {
						"test-server": {
							type: "stdio",
							command: "node",
							args: ["test.js"],
							timeout: 60,
						},
					},
				}

				// Mock initial read
				;(fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockConfig))

				// Update with invalid timeout
				await mcpHub.updateServerTimeout("test-server", 3601)

				// Config is written
				expect(fs.writeFile).toHaveBeenCalled()

				// Setup connection with invalid timeout
				const mockConnection: McpConnection = {
					server: {
						name: "test-server",
						config: JSON.stringify({
							type: "stdio",
							command: "node",
							args: ["test.js"],
							timeout: 3601, // Invalid timeout
						}),
						status: "connected",
					},
					client: {
						request: jest.fn().mockResolvedValue({ content: [] }),
					} as any,
					transport: {} as any,
				}

				mcpHub.connections = [mockConnection]

				// Call tool - should use default timeout
				await mcpHub.callTool("test-server", "test-tool")

				// Verify default timeout was used
				expect(mockConnection.client.request).toHaveBeenCalledWith(
					expect.anything(),
					expect.anything(),
					expect.objectContaining({ timeout: 60000 }), // Default 60 seconds
				)
			})

			it("should accept valid timeout values", async () => {
				const mockConfig = {
					mcpServers: {
						"test-server": {
							type: "stdio",
							command: "node",
							args: ["test.js"],
							timeout: 60,
						},
					},
				}

				;(fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockConfig))

				// Test valid timeout values
				const validTimeouts = [1, 60, 3600]
				for (const timeout of validTimeouts) {
					await mcpHub.updateServerTimeout("test-server", timeout)
					expect(fs.writeFile).toHaveBeenCalled()
					jest.clearAllMocks() // Reset for next iteration
					;(fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockConfig))
				}
			})

			it("should notify webview after updating timeout", async () => {
				const mockConfig = {
					mcpServers: {
						"test-server": {
							type: "stdio",
							command: "node",
							args: ["test.js"],
							timeout: 60,
						},
					},
				}

				;(fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockConfig))

				await mcpHub.updateServerTimeout("test-server", 120)

				expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith(
					expect.objectContaining({
						type: "mcpServers",
					}),
				)
			})
		})
	})

	describe("restartAllMcpServers", () => {
		let mcpHub: McpHubType
		let mockProvider: Partial<ClineProvider>

		beforeEach(() => {
			jest.clearAllMocks()
			// Mock console.error to suppress error messages during tests
			originalConsoleError = console.error // Store original before mocking
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
					secrets: {} as any,
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
				} as ExtensionContext,
			}

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

			mcpHub = new McpHub(mockProvider as ClineProvider)
			jest.spyOn(mcpHub as any, "showErrorMessage").mockImplementation(jest.fn())

			// Mock internal methods
			jest.spyOn(mcpHub, "getAllServers" as any).mockReturnValue([
				{ name: "server1", source: "global", disabled: false },
				{ name: "server2", source: "project", disabled: true }, // Disabled server
				{ name: "server3", source: "global", disabled: false },
			])
			jest.spyOn(mcpHub, "restartConnection" as any).mockResolvedValue(undefined)
			jest.spyOn(mcpHub as any, "notifyWebviewOfServerChanges").mockResolvedValue(undefined)
		})

		afterEach(() => {
			// Restore original console methods
			console.error = originalConsoleError
			jest.restoreAllMocks() // Clean up spies
		})

		it("should restart only active servers", async () => {
			await mcpHub.restartAllMcpServers()

			expect(mcpHub.getAllServers).toHaveBeenCalled()
			expect(mcpHub.restartConnection).toHaveBeenCalledTimes(2) // Only server1 and server3 should be restarted
			expect(mcpHub.restartConnection).toHaveBeenCalledWith("server1", "global")
			expect(mcpHub.restartConnection).not.toHaveBeenCalledWith("server2", "project")
			expect(mcpHub.restartConnection).toHaveBeenCalledWith("server3", "global")
			expect((mcpHub as any).notifyWebviewOfServerChanges).toHaveBeenCalledTimes(1)
		})

		it("should call showErrorMessage if a restart fails", async () => {
			jest.spyOn(mcpHub, "restartConnection" as any).mockRejectedValueOnce(new Error("Restart failed"))

			await mcpHub.restartAllMcpServers()

			expect(mcpHub.getAllServers).toHaveBeenCalled()
			expect(mcpHub.restartConnection).toHaveBeenCalledTimes(2) // Only active servers are attempted to restart
			expect((mcpHub as any).showErrorMessage).toHaveBeenCalledTimes(1)
			expect((mcpHub as any).showErrorMessage).toHaveBeenCalledWith(
				"Failed to restart MCP server server1",
				expect.any(Error),
			)
			expect((mcpHub as any).notifyWebviewOfServerChanges).toHaveBeenCalledTimes(1)
		})

		it("should call notifyWebviewOfServerChanges even if some restarts fail", async () => {
			jest.spyOn(mcpHub, "restartConnection").mockRejectedValue(new Error("Restart failed"))

			await mcpHub.restartAllMcpServers()

			expect((mcpHub as any).notifyWebviewOfServerChanges).toHaveBeenCalledTimes(1)
		})
	})
})
