import WebSocket from "ws"
import { WebSocketClient } from "../../src/utils/websocket-client"

// Mock the WebSocket module
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

describe("WebSocketClient", () => {
	let wsClient: WebSocketClient
	let mockWs: any
	const url = "ws://localhost:8765"

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks()

		// Create a mock WebSocket instance
		mockWs = {
			on: jest.fn(),
			send: jest.fn(),
			close: jest.fn(),
			readyState: WebSocket.OPEN,
		}

		// Mock the WebSocket constructor
		;(WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs)

		// Create a new WebSocketClient instance
		wsClient = new WebSocketClient(url)
	})

	describe("connect", () => {
		it("should connect to the WebSocket server", async () => {
			// Set up the mock WebSocket to emit an 'open' event
			mockWs.on.mockImplementation((event, callback) => {
				if (event === "open") {
					callback()
				}
			})

			// Connect to the server
			await wsClient.connect()

			// Verify that the WebSocket constructor was called with the correct URL
			expect(WebSocket).toHaveBeenCalledWith(url)

			// Verify that event listeners were set up
			expect(mockWs.on).toHaveBeenCalledWith("open", expect.any(Function))
			expect(mockWs.on).toHaveBeenCalledWith("message", expect.any(Function))
			expect(mockWs.on).toHaveBeenCalledWith("error", expect.any(Function))
			expect(mockWs.on).toHaveBeenCalledWith("close", expect.any(Function))
		})

		it("should handle connection errors", async () => {
			// Set up the mock WebSocket to emit an 'error' event
			const error = new Error("Connection error")
			mockWs.on.mockImplementation((event, callback) => {
				if (event === "error") {
					callback(error)
				}
			})

			// Attempt to connect to the server
			await expect(wsClient.connect()).rejects.toThrow("Connection error")
		})
	})

	describe("disconnect", () => {
		it("should disconnect from the WebSocket server", async () => {
			// Set up the mock WebSocket to emit an 'open' event
			mockWs.on.mockImplementation((event, callback) => {
				if (event === "open") {
					callback()
				}
			})

			// Connect to the server
			await wsClient.connect()

			// Disconnect from the server
			wsClient.disconnect()

			// Verify that the WebSocket was closed
			expect(mockWs.close).toHaveBeenCalled()
		})
	})

	describe("sendCommand", () => {
		beforeEach(async () => {
			// Set up the mock WebSocket to emit an 'open' event
			mockWs.on.mockImplementation((event, callback) => {
				if (event === "open") {
					callback()
				}
			})

			// Connect to the server
			await wsClient.connect()
		})

		it("should send a command to the WebSocket server", async () => {
			// Set up a promise that will resolve when the message handler is called
			const messagePromise = new Promise<void>((resolve) => {
				// Mock the WebSocket send method
				mockWs.send.mockImplementation(() => {
					// Simulate receiving a response from the server
					const response = {
						id: "1",
						result: { success: true },
					}

					// Find the message handler
					const messageHandler = mockWs.on.mock.calls.find((call) => call[0] === "message")[1]

					// Call the message handler with the response
					messageHandler(JSON.stringify(response))

					resolve()
				})
			})

			// Send a command to the server
			const promise = wsClient.sendCommand("testCommand", { param: "value" })

			// Wait for the message handler to be called
			await messagePromise

			// Wait for the promise to resolve
			const result = await promise

			// Verify that the WebSocket send method was called with the correct message
			expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('"method":"testCommand"'))
			expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('"params":{"param":"value"}'))

			// Verify that the result is correct
			expect(result).toEqual({ success: true })
		})

		it("should handle command errors", async () => {
			// Set up a promise that will resolve when the message handler is called
			const messagePromise = new Promise<void>((resolve) => {
				// Mock the WebSocket send method
				mockWs.send.mockImplementation(() => {
					// Simulate receiving an error response from the server
					const response = {
						id: "1",
						error: {
							code: 500,
							message: "Command error",
						},
					}

					// Find the message handler
					const messageHandler = mockWs.on.mock.calls.find((call) => call[0] === "message")[1]

					// Call the message handler with the response
					messageHandler(JSON.stringify(response))

					resolve()
				})
			})

			// Send a command to the server
			const promise = wsClient.sendCommand("testCommand")

			// Wait for the message handler to be called
			await messagePromise

			// Verify that the promise rejects with the correct error
			await expect(promise).rejects.toThrow("Command error")
		})

		it("should handle events from the server", async () => {
			// Set up a mock event handler
			const eventHandler = jest.fn()
			wsClient.on("testEvent", eventHandler)

			// Find the message handler
			const messageHandler = mockWs.on.mock.calls.find((call) => call[0] === "message")[1]

			// Simulate receiving an event from the server
			const event = {
				type: "event",
				eventName: "testEvent",
				payload: { data: "value" },
			}
			messageHandler(JSON.stringify(event))

			// Verify that the event handler was called with the correct payload
			expect(eventHandler).toHaveBeenCalledWith({ data: "value" })
		})

		it("should reject if the WebSocket is not connected", async () => {
			// Disconnect from the server
			wsClient.disconnect()

			// Attempt to send a command
			await expect(wsClient.sendCommand("testCommand")).rejects.toThrow("WebSocket is not connected")
		})
	})

	describe("isConnected", () => {
		it("should return true if the WebSocket is connected", async () => {
			// Set up the mock WebSocket to emit an 'open' event
			mockWs.on.mockImplementation((event, callback) => {
				if (event === "open") {
					callback()
				}
			})

			// Connect to the server
			await wsClient.connect()

			// Verify that isConnected returns true
			expect(wsClient.isConnected()).toBe(true)
		})

		it("should return false if the WebSocket is not connected", () => {
			// Verify that isConnected returns false
			expect(wsClient.isConnected()).toBe(false)
		})
	})
})
