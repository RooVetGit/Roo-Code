import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"
import WebSocket from "ws"
import { WebSocketClient } from "../../../comms-clients/websocket-client"
import { readWebSocketConfig } from "../../../comms-clients/websocket-config"

// Mock dependencies
jest.mock("fs/promises")
jest.mock("os")
jest.mock("path")
jest.mock("ws")
jest.mock("ora", () => {
	return jest.fn().mockImplementation(() => {
		return {
			start: jest.fn().mockReturnThis(),
			succeed: jest.fn().mockReturnThis(),
			fail: jest.fn().mockReturnThis(),
			stop: jest.fn().mockReturnThis(),
		}
	})
})

// Add a type declaration to extend WebSocketClient for testing
declare module "../../../comms-clients/websocket-client" {
	interface WebSocketClient {
		// For testing purposes only
		messageHandler?: (data: string) => void
	}
}

describe("WebSocket Integration Tests", () => {
	const mockTmpDir = "/mock/tmp/dir"
	const mockConfigPath = "/mock/tmp/dir/roocode-websocket-config.json"
	const mockConfig = {
		port: 12345,
		token: "test-token",
	}
	let mockWs: any

	beforeEach(() => {
		jest.clearAllMocks()

		// Mock os.tmpdir to return a consistent path
		;(os.tmpdir as jest.Mock).mockReturnValue(mockTmpDir)

		// Mock path.join to return a consistent config path
		;(path.join as jest.Mock).mockReturnValue(mockConfigPath)

		// Mock fs.access to resolve successfully
		;(fs.access as jest.Mock).mockResolvedValue(undefined)

		// Mock fs.readFile to return a valid configuration
		;(fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig))

		// Create a mock WebSocket instance
		mockWs = {
			on: jest.fn(),
			send: jest.fn(),
			close: jest.fn(),
			readyState: WebSocket.OPEN,
		}

		// Mock the WebSocket constructor
		;(WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs)
	})

	describe("CLI to WebSocket Server Connection", () => {
		it("should read the configuration and connect to the server", async () => {
			// Read the WebSocket configuration
			const config = await readWebSocketConfig()

			// Verify that the configuration was read correctly
			expect(config).toEqual(mockConfig)

			// Create a WebSocketClient with the configuration
			const client = new WebSocketClient(`ws://localhost:${config.port}`, config.token)

			// Set up the mock WebSocket to emit an 'open' event
			mockWs.on.mockImplementation((event, callback) => {
				if (event === "open") {
					callback()
				}
			})

			// Connect to the server
			await client.connect()

			// Verify that the WebSocket constructor was called with the correct URL
			expect(WebSocket).toHaveBeenCalledWith(`ws://localhost:${config.port}`)

			// Verify that event listeners were set up
			expect(mockWs.on).toHaveBeenCalledWith("open", expect.any(Function))
			expect(mockWs.on).toHaveBeenCalledWith("message", expect.any(Function))
			expect(mockWs.on).toHaveBeenCalledWith("error", expect.any(Function))
			expect(mockWs.on).toHaveBeenCalledWith("close", expect.any(Function))

			// Verify that the client is connected
			expect(client.isConnected()).toBe(true)
		})

		it("should authenticate with the server using the token from the configuration", async () => {
			// Read the WebSocket configuration
			const config = await readWebSocketConfig()

			// Create a WebSocketClient with the configuration
			const client = new WebSocketClient(`ws://localhost:${config.port}`, config.token)

			// Set up the mock WebSocket to emit an 'open' event and handle authentication
			let authMessageSent = false
			mockWs.on.mockImplementation((event, callback) => {
				if (event === "open") {
					callback()
				} else if (event === "message") {
					// Store the message handler for later use
					client.messageHandler = callback
				}
			})

			mockWs.send.mockImplementation((message) => {
				const parsedMessage = JSON.parse(message)
				if (parsedMessage.type === "authentication") {
					authMessageSent = true

					// Simulate receiving an authentication response from the server
					const response = {
						id: parsedMessage.message_id,
						result: { success: true },
					}

					// Call the message handler with the response
					if (client.messageHandler) {
						client.messageHandler(JSON.stringify(response))
					}
				}
			})

			// Connect to the server
			await client.connect()

			// Verify that an authentication message was sent
			expect(authMessageSent).toBe(true)

			// Verify that the client is connected
			expect(client.isConnected()).toBe(true)
		})

		it("should handle connection errors gracefully", async () => {
			// Mock fs.access to reject with an error
			;(fs.access as jest.Mock).mockRejectedValue(new Error("File not found"))

			// Attempt to read the WebSocket configuration
			await expect(readWebSocketConfig()).rejects.toThrow(
				"WebSocket configuration file not found. Is the RooCode extension running?",
			)

			// Create a WebSocketClient with a fallback configuration
			const client = new WebSocketClient("ws://localhost:8765")

			// Set up the mock WebSocket to emit an 'error' event
			const error = new Error("Connection error")
			mockWs.on.mockImplementation((event, callback) => {
				if (event === "error") {
					callback(error)
				}
			})

			// Attempt to connect to the server
			await expect(client.connect()).rejects.toThrow("Connection error")

			// Verify that the client is not connected
			expect(client.isConnected()).toBe(false)
		})
	})
})
