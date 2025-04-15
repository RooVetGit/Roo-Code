import * as vscode from "vscode"
import { WebSocket, WebSocketServer as WSServer } from "ws"
import { API } from "../../../exports/api"
import { WebSocketServer } from "../../../services/extend/websocket-server"
import { writeWebSocketConfig } from "../../../utils/websocket-config"

// Mock dependencies
jest.mock("vscode")
jest.mock("ws")
jest.mock("../../../exports/api")
jest.mock("../../../utils/websocket-config")

describe("WebSocketServer", () => {
	let mockAPI: jest.Mocked<API>
	let mockOutputChannel: jest.Mocked<vscode.OutputChannel>
	let mockWSServer: jest.Mocked<WSServer>
	let mockWebSocket: jest.Mocked<WebSocket>
	let server: WebSocketServer
	const mockToken = "test-token"
	const mockPort = 0 // Use port 0 to let OS assign a random port

	beforeEach(() => {
		jest.clearAllMocks()

		// Mock API
		mockAPI = new API(
			{} as vscode.OutputChannel,
			{} as any,
			undefined, // Use undefined instead of null
			false,
		) as jest.Mocked<API>

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

		// Mock WebSocket server
		mockWSServer = {
			on: jest.fn(),
			close: jest.fn(),
			address: jest.fn().mockReturnValue({ port: 12345 }),
		} as unknown as jest.Mocked<WSServer>

		// Mock WebSocket
		mockWebSocket = {
			on: jest.fn(),
			send: jest.fn(),
			close: jest.fn(),
			readyState: WebSocket.OPEN,
		} as unknown as jest.Mocked<WebSocket>

		// Mock WSServer constructor
		;(WSServer as unknown as jest.Mock).mockImplementation(() => mockWSServer)

		// Create WebSocketServer instance
		server = new WebSocketServer(mockAPI, mockToken, mockOutputChannel as vscode.OutputChannel, mockPort)
	})

	describe("start", () => {
		it("should start the WebSocket server on a random port", () => {
			server.start()

			// Verify that the WebSocket server was created with the correct port
			expect(WSServer).toHaveBeenCalledWith({ port: mockPort })

			// Verify that event listeners were set up
			expect(mockWSServer.on).toHaveBeenCalledWith("connection", expect.any(Function))
			expect(mockWSServer.on).toHaveBeenCalledWith("error", expect.any(Function))

			// Verify that the server logged the actual port
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("WebSocket server started on port 12345"),
			)

			// Verify that getPort returns the correct port
			expect(server.getPort()).toBe(12345)
		})

		it("should not start the server if it is already running", () => {
			// Start the server
			server.start()

			// Clear the mocks
			jest.clearAllMocks()

			// Try to start the server again
			server.start()

			// Verify that the WebSocket server was not created again
			expect(WSServer).not.toHaveBeenCalled()

			// Verify that the server logged that it's already running
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("Server is already running"),
			)
		})
	})

	describe("stop", () => {
		it("should stop the WebSocket server", () => {
			// Start the server
			server.start()

			// Clear the mocks
			jest.clearAllMocks()

			// Stop the server
			server.stop()

			// Verify that the WebSocket server was closed
			expect(mockWSServer.close).toHaveBeenCalled()

			// Verify that getPort returns null
			expect(server.getPort()).toBeNull()
		})

		it("should not try to stop the server if it is not running", () => {
			// Try to stop the server without starting it
			server.stop()

			// Verify that the WebSocket server was not closed
			expect(mockWSServer.close).not.toHaveBeenCalled()

			// Verify that the server logged that it's not running
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining("Server is not running"))
		})
	})

	describe("handleConnection", () => {
		it("should set up event handlers for new connections", () => {
			// Start the server
			server.start()

			// Find the connection handler
			const connectionHandler = mockWSServer.on.mock.calls.find((call) => call[0] === "connection")?.[1]

			// Ensure the connection handler exists
			expect(connectionHandler).toBeDefined()

			// Call the connection handler with a mock WebSocket
			if (connectionHandler) {
				connectionHandler.call(mockWSServer, mockWebSocket)
			}

			// Verify that event listeners were set up for the WebSocket
			expect(mockWebSocket.on).toHaveBeenCalledWith("message", expect.any(Function))
			expect(mockWebSocket.on).toHaveBeenCalledWith("close", expect.any(Function))
			expect(mockWebSocket.on).toHaveBeenCalledWith("error", expect.any(Function))

			// Verify that the server logged the new connection
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining("New client connected"))
		})
	})

	describe("handleMessage", () => {
		beforeEach(() => {
			// Start the server
			server.start()

			// Find the connection handler
			const connectionHandler = mockWSServer.on.mock.calls.find((call) => call[0] === "connection")?.[1]

			// Call the connection handler with a mock WebSocket
			if (connectionHandler) {
				connectionHandler.call(mockWSServer, mockWebSocket)
			}
		})

		it("should handle authentication messages", () => {
			// Find the message handler
			const messageHandler = mockWebSocket.on.mock.calls.find((call) => call[0] === "message")?.[1]

			// Ensure the message handler exists
			expect(messageHandler).toBeDefined()

			// Create an authentication message
			const authMessage = {
				message_id: "1",
				type: "authentication",
				payload: {
					token: mockToken,
				},
			}

			// Call the message handler with the authentication message
			if (messageHandler) {
				messageHandler.call(mockWebSocket, Buffer.from(JSON.stringify(authMessage)))
			}

			// Verify that the server sent a success response
			expect(mockWebSocket.send).toHaveBeenCalledWith(expect.stringContaining('"message_id":"1"'))
			expect(mockWebSocket.send).toHaveBeenCalledWith(expect.stringContaining('"success":true'))

			// Verify that the server logged the successful authentication
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("Client authenticated successfully"),
			)
		})

		it("should reject authentication with an invalid token", () => {
			// Find the message handler
			const messageHandler = mockWebSocket.on.mock.calls.find((call) => call[0] === "message")?.[1]

			// Ensure the message handler exists
			expect(messageHandler).toBeDefined()

			// Create an authentication message with an invalid token
			const authMessage = {
				message_id: "1",
				type: "authentication",
				payload: {
					token: "invalid-token",
				},
			}

			// Call the message handler with the authentication message
			if (messageHandler) {
				messageHandler.call(mockWebSocket, Buffer.from(JSON.stringify(authMessage)))
			}

			// Verify that the server sent an error response
			expect(mockWebSocket.send).toHaveBeenCalledWith(expect.stringContaining('"type":"error"'))
			expect(mockWebSocket.send).toHaveBeenCalledWith(expect.stringContaining('"code":"UNAUTHORIZED"'))

			// Verify that the server logged the failed authentication
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("Client authentication failed"),
			)
		})

		it("should require authentication for other message types", () => {
			// Find the message handler
			const messageHandler = mockWebSocket.on.mock.calls.find((call) => call[0] === "message")?.[1]

			// Ensure the message handler exists
			expect(messageHandler).toBeDefined()

			// Create a method call message
			const methodCallMessage = {
				message_id: "1",
				type: "method_call",
				payload: {
					method: "testMethod",
					args: [],
				},
			}

			// Call the message handler with the method call message
			if (messageHandler) {
				messageHandler.call(mockWebSocket, Buffer.from(JSON.stringify(methodCallMessage)))
			}

			// Verify that the server sent an error response
			expect(mockWebSocket.send).toHaveBeenCalledWith(expect.stringContaining('"type":"error"'))
			expect(mockWebSocket.send).toHaveBeenCalledWith(expect.stringContaining('"code":"UNAUTHORIZED"'))
		})
	})

	describe("dispose", () => {
		it("should stop the server when disposed", () => {
			// Start the server
			server.start()

			// Clear the mocks
			jest.clearAllMocks()

			// Dispose the server
			server.dispose()

			// Verify that the WebSocket server was closed
			expect(mockWSServer.close).toHaveBeenCalled()
		})
	})

	describe("integration with extension", () => {
		it("should write the WebSocket configuration when started", async () => {
			// Mock writeWebSocketConfig
			;(writeWebSocketConfig as jest.Mock).mockResolvedValue(undefined)

			// Start the server
			server.start()

			// Get the port
			const port = server.getPort()

			// Call the extension's code to write the configuration
			if (port !== null) {
				await writeWebSocketConfig({ port, token: mockToken })
			}

			// Verify that writeWebSocketConfig was called with the correct parameters
			expect(writeWebSocketConfig).toHaveBeenCalledWith({
				port: 12345,
				token: mockToken,
			})
		})
	})
})
