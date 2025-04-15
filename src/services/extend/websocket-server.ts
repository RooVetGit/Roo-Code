import { EventEmitter } from "events"
import * as vscode from "vscode"
import { WebSocketServer as WSServer, WebSocket } from "ws"
import { API } from "../../exports/api"
import { outputChannelLog } from "../../exports/log"
import { RooCodeEventName, RooCodeEvents } from "../../schemas"

// Message types
export enum MessageType {
	METHOD_CALL = "method_call",
	EVENT_SUBSCRIPTION = "event_subscription",
	EVENT = "event",
	ERROR = "error",
	AUTHENTICATION = "authentication",
}

// Interface for message structure
interface Message {
	message_id: string
	type: MessageType
	payload: unknown
}

// Interface for method call payload
interface MethodCallPayload {
	method: string
	args: unknown[]
}

// Interface for event subscription payload
interface EventSubscriptionPayload {
	event: RooCodeEventName
}

// Interface for event payload
interface EventPayload {
	event: RooCodeEventName
	data: unknown
}

// Interface for error payload
interface ErrorPayload {
	code: string
	message: string
	details?: unknown
}

// Interface for authentication payload
interface AuthenticationPayload {
	token: string
}

// Define server events
interface ServerEvents {
	error: [Error]
}

export class WebSocketServer extends EventEmitter {
	private server: WSServer | null = null
	private clients: Map<
		WebSocket,
		{
			authenticated: boolean
			subscriptions: Set<RooCodeEventName>
		}
	> = new Map()
	private api: API
	private token: string
	private outputChannel: vscode.OutputChannel
	private actualPort: number | null = null

	constructor(
		api: API,
		token: string,
		outputChannel: vscode.OutputChannel,
		private port: number = 3000,
	) {
		super()
		this.api = api
		this.token = token
		this.outputChannel = outputChannel
		this.setupApiEventListeners()
	}

	/**
	 * Get the actual port the server is listening on
	 * Returns null if the server is not running
	 */
	public getPort(): number | null {
		return this.actualPort
	}

	/**
	 * Start the WebSocket server
	 */
	public start(): void {
		if (this.server) {
			this.log("Server is already running")
			return
		}
		this.server = new WSServer({ port: this.port })
		if (this.server) {
			this.server.on("connection", this.handleConnection.bind(this))
			this.server.on("error", this.handleServerError.bind(this))
		}
		this.server.on("error", this.handleServerError.bind(this))

		// Get the actual port the server is listening on
		// When port 0 is specified, the OS assigns a random available port
		if (this.server && this.server.address() && typeof this.server.address() === "object") {
			this.actualPort = (this.server.address() as { port: number }).port
			this.log(`WebSocket server started on port ${this.actualPort}`)
		} else {
			this.log(`WebSocket server started on port ${this.port}`)
			this.actualPort = this.port
		}
	}

	/**
	 * Stop the WebSocket server
	 */
	public stop(): void {
		if (!this.server) {
			this.log("Server is not running")
			return
		}

		this.server.close(() => {
			this.log("WebSocket server stopped")
		})

		this.clients.clear()
		this.server = null
		this.actualPort = null
	}

	/**
	 * Handle new WebSocket connections
	 */
	private handleConnection(ws: WebSocket): void {
		this.log("New client connected")

		// Initialize client state
		this.clients.set(ws, {
			authenticated: false,
			subscriptions: new Set(),
		})

		// Setup event handlers for this connection
		ws.on("message", (data: Buffer | ArrayBuffer | Buffer[]) => this.handleMessage(ws, data))

		ws.on("close", () => {
			this.log("Client disconnected")
			this.clients.delete(ws)
		})

		ws.on("error", (error: Error) => {
			this.log(`Client error: ${error.message}`)
		})
	}

	/**
	 * Handle incoming messages from clients
	 */
	private handleMessage(ws: WebSocket, data: Buffer | ArrayBuffer | Buffer[]): void {
		try {
			const message = JSON.parse(data.toString()) as Message
			const clientState = this.clients.get(ws)

			if (!clientState) {
				this.sendError(ws, message.message_id, "INTERNAL_ERROR", "Client state not found")
				return
			}

			// Handle authentication first
			if (message.type === MessageType.AUTHENTICATION) {
				this.handleAuthentication(ws, message)
				return
			}

			// Check if client is authenticated
			if (!clientState.authenticated) {
				this.sendError(ws, message.message_id, "UNAUTHORIZED", "Authentication required")
				return
			}

			// Process message based on type
			switch (message.type) {
				case MessageType.METHOD_CALL:
					this.handleMethodCall(ws, message)
					break
				case MessageType.EVENT_SUBSCRIPTION:
					this.handleEventSubscription(ws, message)
					break
				default:
					this.sendError(
						ws,
						message.message_id,
						"INVALID_MESSAGE_TYPE",
						`Unsupported message type: ${message.type}`,
					)
			}
		} catch (error) {
			this.log(`Error processing message: ${error instanceof Error ? error.message : String(error)}`)
			try {
				this.sendError(ws, "unknown", "PARSE_ERROR", "Failed to parse message")
			} catch (e) {
				this.log(`Failed to send error response: ${e instanceof Error ? e.message : String(e)}`)
			}
		}
	}

	/**
	 * Handle authentication messages
	 */
	private handleAuthentication(ws: WebSocket, message: Message): void {
		try {
			const payload = message.payload as AuthenticationPayload
			const clientState = this.clients.get(ws)

			if (!clientState) {
				this.sendError(ws, message.message_id, "INTERNAL_ERROR", "Client state not found")
				return
			}

			if (payload.token === this.token) {
				clientState.authenticated = true
				this.sendResponse(ws, message.message_id, { success: true })
				this.log("Client authenticated successfully")
			} else {
				this.sendError(ws, message.message_id, "UNAUTHORIZED", "Invalid authentication token")
				this.log("Client authentication failed")
			}
		} catch (error) {
			this.sendError(ws, message.message_id, "AUTHENTICATION_ERROR", "Invalid authentication payload")
		}
	}

	/**
	 * Handle method call messages
	 */
	private async handleMethodCall(ws: WebSocket, message: Message): Promise<void> {
		try {
			const payload = message.payload as MethodCallPayload
			const { method, args } = payload

			// Check if method exists on the API
			// Use safer type checking approach
			if (!(method in this.api) || typeof (this.api as any)[method] !== "function") {
				this.sendError(ws, message.message_id, "METHOD_NOT_FOUND", `Method not found: ${method}`)
				return
			}

			try {
				// Call the method on the API using a safer approach
				// Use Function.prototype.apply to maintain 'this' context
				const apiMethod = (this.api as any)[method]
				const result = await apiMethod.apply(this.api, args as unknown[])
				this.sendResponse(ws, message.message_id, result)
			} catch (error) {
				this.sendError(
					ws,
					message.message_id,
					"METHOD_EXECUTION_ERROR",
					`Error executing method ${method}: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		} catch (error) {
			this.sendError(
				ws,
				message.message_id,
				"INVALID_PAYLOAD",
				`Invalid method call payload: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	/**
	 * Handle event subscription messages
	 */
	private handleEventSubscription(ws: WebSocket, message: Message): void {
		try {
			const payload = message.payload as EventSubscriptionPayload
			const clientState = this.clients.get(ws)

			if (!clientState) {
				this.sendError(ws, message.message_id, "INTERNAL_ERROR", "Client state not found")
				return
			}

			// Add event to client's subscriptions
			clientState.subscriptions.add(payload.event)
			this.sendResponse(ws, message.message_id, { subscribed: true, event: payload.event })
			this.log(`Client subscribed to event: ${payload.event}`)
		} catch (error) {
			this.sendError(
				ws,
				message.message_id,
				"SUBSCRIPTION_ERROR",
				`Error subscribing to event: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	/**
	 * Send a response to a client
	 */
	private sendResponse(ws: WebSocket, messageId: string, data: unknown): void {
		const response: Message = {
			message_id: messageId,
			type: MessageType.METHOD_CALL,
			payload: data,
		}

		ws.send(JSON.stringify(response))
	}

	/**
	 * Send an error to a client
	 */
	private sendError(ws: WebSocket, messageId: string, code: string, message: string, details?: unknown): void {
		const errorMessage: Message = {
			message_id: messageId,
			type: MessageType.ERROR,
			payload: {
				code,
				message,
				details,
			} as ErrorPayload,
		}

		ws.send(JSON.stringify(errorMessage))
	}

	/**
	 * Send an event to subscribed clients
	 */
	private sendEvent(eventName: RooCodeEventName, data: unknown): void {
		const eventMessage: Message = {
			message_id: `event-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
			type: MessageType.EVENT,
			payload: {
				event: eventName,
				data,
			} as EventPayload,
		}

		const messageStr = JSON.stringify(eventMessage)

		// Send to all authenticated clients that have subscribed to this event
		for (const [ws, clientState] of this.clients.entries()) {
			if (clientState.authenticated && clientState.subscriptions.has(eventName)) {
				ws.send(messageStr)
			}
		}
	}

	/**
	 * Setup listeners for API events
	 */
	private setupApiEventListeners(): void {
		// Register listeners for all RooCodeEventName events
		Object.values(RooCodeEventName).forEach((eventName) => {
			// Type-safe event handling
			this.api.on(eventName as keyof RooCodeEvents, (...args: unknown[]) => {
				this.sendEvent(eventName, args)
			})
		})
	}

	/**
	 * Handle server errors
	 */
	private handleServerError(error: Error): void {
		this.log(`WebSocket server error: ${error.message}`)
		this.emit("error", error)
	}

	// Type-safe emit override for server events
	public override emit<K extends keyof ServerEvents>(event: K, ...args: ServerEvents[K]): boolean {
		return super.emit(event, ...args)
	}

	/**
	 * Dispose the WebSocket server
	 * This method is called when the extension is deactivated
	 */
	public dispose(): void {
		this.stop()
	}

	/**
	 * Log a message to the output channel
	 */
	private log(message: string): void {
		outputChannelLog(this.outputChannel, `[WebSocketServer] ${message}`)
	}
}
