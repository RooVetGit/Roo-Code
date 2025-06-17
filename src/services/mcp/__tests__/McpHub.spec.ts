import type { McpHub as McpHubType, McpConnection } from "../McpHub"
import type { ClineProvider } from "../../../core/webview/ClineProvider"
import type { ExtensionContext, Uri } from "vscode"
import { ServerConfigSchema, McpHub } from "../McpHub"
import fs from "fs/promises"
import { safeWriteJson } from "../../../utils/safeWriteJson"
import path from "path"

const mockFileStore: Record<string, string> = {}

vi.mock("vscode", () => ({
	workspace: {
		createFileSystemWatcher: vi.fn().mockReturnValue({
			onDidChange: vi.fn(),
			onDidCreate: vi.fn(),
			onDidDelete: vi.fn(),
			dispose: vi.fn(),
		}),
		onDidSaveTextDocument: vi.fn(),
		onDidChangeWorkspaceFolders: vi.fn(),
		workspaceFolders: [],
	},
	window: {
		showErrorMessage: vi.fn(),
		showInformationMessage: vi.fn(),
		showWarningMessage: vi.fn(),
		createTextEditorDecorationType: vi.fn().mockReturnValue({
			dispose: vi.fn(),
		}),
	},
	Disposable: {
		from: vi.fn(),
	},
}))
// Mock fs/promises
vi.mock("fs/promises", () => {
	const readFileMock = vi.fn()
	const accessMock = vi.fn()

	return {
		readFile: readFileMock,
		access: accessMock,
		default: {
			readFile: readFileMock,
			access: accessMock,
		},
	}
})

vi.mock("../../../utils/safeWriteJson", () => ({
	safeWriteJson: vi.fn((filePath: string, data: any) => {
		// Match the normalization logic in toggleToolAlwaysAllow
		let normalizedPath = path.normalize(filePath)
		if (process.platform === "win32") {
			normalizedPath = normalizedPath.replace(/\\/g, "/")
		}
		mockFileStore[normalizedPath] = JSON.stringify(data, null, 2)
		return Promise.resolve()
	}),
}))
vi.mock("../../../core/webview/ClineProvider")

// Helper functions to reduce duplication in tests
function createMockConnection(options: {
	name?: string
	source?: "global" | "project"
	disabled?: boolean
	timeout?: number
	alwaysAllow?: string[]
}): McpConnection {
	const { name = "test-server", source = "global", disabled = false, timeout = 60, alwaysAllow = [] } = options

	return {
		server: {
			name,
			type: "stdio",
			command: "node",
			args: ["test.js"],
			disabled,
			timeout,
			alwaysAllow,
			source,
		} as any,
		client: {} as any,
		transport: {} as any,
	}
}

function setupMockFileSystem(options: {
	serverName?: string
	disabled?: boolean
	timeout?: number
	alwaysAllow?: string[]
}) {
	const { serverName = "test-server", disabled = false, timeout = 60, alwaysAllow = [] } = options

	// Create a default config object
	const config = {
		mcpServers: {
			[serverName]: {
				type: "stdio",
				command: "node",
				args: ["test.js"],
				disabled,
				timeout,
			},
		},
	}

	// Add alwaysAllow if provided
	if (alwaysAllow.length > 0) {
		;(config.mcpServers[serverName] as any).alwaysAllow = alwaysAllow
	}

	// Mock fs.readFile to return this config
	vi.mocked(fs.readFile).mockImplementation(() => {
		return Promise.resolve(JSON.stringify(config))
	})

	return config
}

function verifyConfigUpdate(options: { serverName?: string; property: string; expectedValue: any }) {
	const { serverName = "test-server", property, expectedValue } = options

	// Verify safeWriteJson was called
	expect(safeWriteJson).toHaveBeenCalled()

	// Get the arguments passed to safeWriteJson
	const writeArgs = vi.mocked(safeWriteJson).mock.calls[0]

	// Verify the config was updated correctly
	const updatedConfig = writeArgs[1]
	expect(updatedConfig).toBeDefined()
	expect(updatedConfig.mcpServers).toBeDefined()
	expect(updatedConfig.mcpServers[serverName]).toBeDefined()

	// Check the specific property that was updated
	expect(updatedConfig.mcpServers[serverName][property]).toEqual(expectedValue)
}

/**
 * Helper function to set up the mock file store with a normalized path
 * @param config The configuration object to store
 * @param settingsPath The base settings path
 * @param filename The filename to use (defaults to "cline_mcp_settings.json")
 */
function setupMockFileStore(config: any, settingsPath: string, filename: string = "cline_mcp_settings.json") {
	// Create the full path
	let fullPath = path.join(settingsPath, filename)

	// Normalize path consistently with our mock implementation
	let normalizedPath = path.normalize(fullPath)
	if (process.platform === "win32") {
		normalizedPath = normalizedPath.replace(/\\/g, "/")
	}

	// Store the config in the mock file store
	mockFileStore[normalizedPath] = JSON.stringify(config)

	return normalizedPath
}

describe("McpHub", () => {
	let mcpHub: McpHubType
	let mockProvider: Partial<ClineProvider>
	let mockSettingsPath: string

	// Store original console methods
	const originalConsoleError = console.error

	beforeEach(() => {
		vi.clearAllMocks()
		// Clear the mock file store
		for (const key in mockFileStore) {
			delete mockFileStore[key]
		}
		mockSettingsPath = path.resolve("/mock/settings/path")

		// Mock console.error to suppress error messages during tests
		console.error = vi.fn()

		const mockUri: Uri = {
			scheme: "file",
			authority: "",
			path: "/test/path",
			query: "",
			fragment: "",
			fsPath: "/test/path",
			with: vi.fn(),
			toJSON: vi.fn(),
		}

		mockProvider = {
			ensureSettingsDirectoryExists: vi.fn().mockResolvedValue(mockSettingsPath),
			ensureMcpServersDirectoryExists: vi.fn().mockResolvedValue(mockSettingsPath),
			postMessageToWebview: vi.fn(),
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
					activate: vi.fn(),
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

		mcpHub = new McpHub(mockProvider as ClineProvider)
	})

	afterEach(() => {
		// Restore original console methods
		console.error = originalConsoleError
	})

	describe("toggleToolAlwaysAllow", () => {
		beforeEach(() => {
			// Reset the mocks before each test
			vi.mocked(safeWriteJson).mockClear()
			vi.mocked(fs.readFile).mockClear()
		})

		it("should add tool to always allow list when enabling", async () => {
			// Setup mock file system
			setupMockFileSystem({ alwaysAllow: [] })

			// Set up mock connection
			mcpHub.connections = [createMockConnection({})]

			// Create a spy on the method
			const toggleSpy = vi.spyOn(mcpHub, "toggleToolAlwaysAllow")

			// Call the method
			await mcpHub.toggleToolAlwaysAllow("test-server", "global", "new-tool", true)

			// Verify the method was called with the correct arguments
			expect(toggleSpy).toHaveBeenCalledWith("test-server", "global", "new-tool", true)

			// Verify the config was updated correctly
			verifyConfigUpdate({
				property: "alwaysAllow",
				expectedValue: expect.arrayContaining(["new-tool"]),
			})
		})

		it("should remove tool from always allow list when disabling", async () => {
			// Setup mock file system with existing tool
			setupMockFileSystem({ alwaysAllow: ["existing-tool"] })

			// Set up mock connection
			mcpHub.connections = [createMockConnection({ alwaysAllow: ["existing-tool"] })]

			// Create a spy on the method
			const toggleSpy = vi.spyOn(mcpHub, "toggleToolAlwaysAllow")

			// Call the method
			await mcpHub.toggleToolAlwaysAllow("test-server", "global", "existing-tool", false)

			// Verify the method was called with the correct arguments
			expect(toggleSpy).toHaveBeenCalledWith("test-server", "global", "existing-tool", false)

			// Verify the config was updated correctly
			verifyConfigUpdate({
				property: "alwaysAllow",
				expectedValue: expect.not.arrayContaining(["existing-tool"]),
			})
		})

		it("should initialize alwaysAllow if it does not exist", async () => {
			// Setup mock file system without alwaysAllow
			const config = {
				mcpServers: {
					"test-server": {
						type: "stdio",
						command: "node",
						args: ["test.js"],
					},
				},
			}

			vi.mocked(fs.readFile).mockImplementation(() => {
				return Promise.resolve(JSON.stringify(config))
			})

			// Set up mock connection
			mcpHub.connections = [createMockConnection({})]

			// Create a spy on the method
			const toggleSpy = vi.spyOn(mcpHub, "toggleToolAlwaysAllow")

			// Call the method
			await mcpHub.toggleToolAlwaysAllow("test-server", "global", "new-tool", true)

			// Verify the method was called with the correct arguments
			expect(toggleSpy).toHaveBeenCalledWith("test-server", "global", "new-tool", true)

			// Verify the config was updated correctly
			verifyConfigUpdate({
				property: "alwaysAllow",
				expectedValue: expect.arrayContaining(["new-tool"]),
			})
		})
	})

	describe("server disabled state", () => {
		beforeEach(() => {
			// Reset the mocks before each test
			vi.mocked(safeWriteJson).mockClear()
			vi.mocked(fs.readFile).mockClear()
		})

		it("should toggle server disabled state", async () => {
			// Setup mock file system
			setupMockFileSystem({ disabled: false })

			// Set up mock connection
			mcpHub.connections = [createMockConnection({ disabled: false })]

			// Create a spy on the method
			const toggleSpy = vi.spyOn(mcpHub, "toggleServerDisabled")

			// Call the method
			await mcpHub.toggleServerDisabled("test-server", true)

			// Verify the method was called with the correct arguments
			expect(toggleSpy).toHaveBeenCalledWith("test-server", true)

			// Verify the config was updated correctly
			verifyConfigUpdate({
				property: "disabled",
				expectedValue: true,
			})
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
					request: vi.fn().mockResolvedValue({ result: "success" }),
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
					request: vi.fn(),
				} as any,
				transport: {} as any,
			}

			mcpHub.connections = [mockConnection]

			await expect(mcpHub.readResource("disabled-server", "some/uri")).rejects.toThrow(
				'Server "disabled-server" is disabled',
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
					request: vi.fn().mockResolvedValue({ result: "success" }),
				} as any,
				transport: {
					start: vi.fn(),
					close: vi.fn(),
					stderr: { on: vi.fn() },
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
						request: vi.fn().mockResolvedValue({ content: [] }),
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
						request: vi.fn().mockResolvedValue({ content: [] }),
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
			beforeEach(() => {
				// Reset the mocks before each test
				vi.mocked(safeWriteJson).mockClear()
				vi.mocked(fs.readFile).mockClear()
			})

			it("should update server timeout in settings file", async () => {
				// Setup mock file system
				setupMockFileSystem({ timeout: 60 })

				// Set up mock connection
				mcpHub.connections = [createMockConnection({ timeout: 60 })]

				// Create a spy on the method
				const updateSpy = vi.spyOn(mcpHub, "updateServerTimeout")

				// Call the method
				await mcpHub.updateServerTimeout("test-server", 120)

				// Verify the method was called with the correct arguments
				expect(updateSpy).toHaveBeenCalledWith("test-server", 120)

				// Verify the config was updated correctly
				verifyConfigUpdate({
					property: "timeout",
					expectedValue: 120,
				})
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

				// Setup mock file store
				setupMockFileStore(mockConfig, mockSettingsPath)

				// Set up mock connection before updating
				const mockConnectionInitial: McpConnection = {
					server: {
						name: "test-server",
						type: "stdio",
						command: "node",
						args: ["test.js"],
						timeout: 60,
						source: "global",
					} as any,
					client: {
						request: vi.fn().mockResolvedValue({ content: [] }),
					} as any,
					transport: {} as any,
				}
				mcpHub.connections = [mockConnectionInitial]

				// Update with invalid timeout
				await mcpHub.updateServerTimeout("test-server", 3601)

				// Config is written
				expect(safeWriteJson).toHaveBeenCalled()

				// Setup connection with invalid timeout
				const mockConnectionInvalid: McpConnection = {
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
						request: vi.fn().mockResolvedValue({ content: [] }),
					} as any,
					transport: {} as any,
				}

				mcpHub.connections = [mockConnectionInvalid]

				// Call tool - should use default timeout
				await mcpHub.callTool("test-server", "test-tool")

				// Verify default timeout was used
				expect(mockConnectionInvalid.client.request).toHaveBeenCalledWith(
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

				// Setup mock file store
				setupMockFileStore(mockConfig, mockSettingsPath)

				// Set up mock connection
				const mockConnection: McpConnection = {
					server: {
						name: "test-server",
						type: "stdio",
						command: "node",
						args: ["test.js"],
						timeout: 60,
						source: "global",
					} as any,
					client: {} as any,
					transport: {} as any,
				}
				mcpHub.connections = [mockConnection]

				// Test valid timeout values
				const validTimeouts = [1, 60, 3600]
				for (const timeout of validTimeouts) {
					await mcpHub.updateServerTimeout("test-server", timeout)
					expect(safeWriteJson).toHaveBeenCalled()
					vi.clearAllMocks() // Reset for next iteration
					// Setup mock file store
					setupMockFileStore(mockConfig, mockSettingsPath)
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

				// Setup mock file store
				setupMockFileStore(mockConfig, mockSettingsPath)

				// Set up mock connection
				const mockConnection: McpConnection = {
					server: {
						name: "test-server",
						type: "stdio",
						command: "node",
						args: ["test.js"],
						timeout: 60,
						source: "global",
					} as any,
					client: {} as any,
					transport: {} as any,
				}
				mcpHub.connections = [mockConnection]

				await mcpHub.updateServerTimeout("test-server", 120)

				expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith(
					expect.objectContaining({
						type: "mcpServers",
					}),
				)
			})
		})
	})
})
