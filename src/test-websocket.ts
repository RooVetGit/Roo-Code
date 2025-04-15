import * as http from "http"
import { WebSocket, WebSocketServer } from "ws"

/**
 * A simple WebSocket server implementation using the 'ws' package.
 * This demonstrates the correct way to implement WebSockets in TypeScript.
 */
class TestWebSocketServer {
	private server: http.Server
	private wss: WebSocketServer
	private port: number

	constructor(port: number = 8765) {
		this.port = port

		// Create an HTTP server
		this.server = http.createServer()

		// Create a WebSocket server instance by passing the HTTP server
		this.wss = new WebSocketServer({ server: this.server })

		// Set up event handlers
		this.setupEventHandlers()
	}

	/**
	 * Set up WebSocket event handlers
	 */
	private setupEventHandlers(): void {
		// Handle connection events
		this.wss.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
			console.log(`Client connected: ${req.socket.remoteAddress}`)

			// Set up client-specific event handlers
			this.setupClientHandlers(ws)

			// Send a welcome message to the client
			ws.send(
				JSON.stringify({
					type: "welcome",
					message: "Welcome to the WebSocket server!",
				}),
			)
		})

		// Handle server errors
		this.wss.on("error", (error: Error) => {
			console.error(`WebSocket server error: ${error.message}`)
		})
	}

	/**
	 * Set up event handlers for a specific client connection
	 */
	private setupClientHandlers(ws: WebSocket): void {
		// Handle messages from the client
		ws.on("message", (message: Buffer | ArrayBuffer | Buffer[]) => {
			console.log(`Received message: ${message}`)

			try {
				// Echo the message back to the client
				ws.send(`Echo: ${message}`)
			} catch (error) {
				console.error(`Error sending message: ${error}`)
			}
		})

		// Handle client disconnection
		ws.on("close", () => {
			console.log("Client disconnected")
		})

		// Handle client errors
		ws.on("error", (error: Error) => {
			console.error(`Client error: ${error.message}`)
		})

		// Set up a ping interval to keep the connection alive
		const pingInterval = setInterval(() => {
			if (ws.readyState === WebSocket.OPEN) {
				ws.ping()
			} else {
				clearInterval(pingInterval)
			}
		}, 30000)
	}

	/**
	 * Start the WebSocket server
	 */
	public start(): void {
		// Start the HTTP server
		this.server.listen(this.port, () => {
			console.log(`WebSocket server started on port ${this.port}`)
		})
	}

	/**
	 * Stop the WebSocket server
	 */
	public stop(): void {
		// Close the WebSocket server
		this.wss.close(() => {
			console.log("WebSocket server closed")

			// Close the HTTP server
			this.server.close(() => {
				console.log("HTTP server closed")
			})
		})
	}
}

// Example usage
export function startTestWebSocketServer(): TestWebSocketServer {
	const server = new TestWebSocketServer()
	server.start()
	return server
}
