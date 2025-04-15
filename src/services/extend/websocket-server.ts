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
			lastActivity: number
		}
	> = new Map()
	private api: API
	private token: string
	private heartbeatInterval: NodeJS.Timeout | null = null
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
		this.setupHeartbeat()
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

		// Clear heartbeat interval
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval)
			this.heartbeatInterval = null
		}

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
			lastActivity: Date.now(),
		})

		// Setup event handlers for this connection
		ws.on("message", (data: Buffer | ArrayBuffer | Buffer[]) => {
			try {
				// Update last activity timestamp
				const clientState = this.clients.get(ws)
				if (clientState) {
					clientState.lastActivity = Date.now()
				}

				this.handleMessage(ws, data)
			} catch (error) {
				this.log(`Error handling message: ${error instanceof Error ? error.message : String(error)}`)
			}
		})

		ws.on("close", (code: number, reason: string) => {
			this.log(`Client disconnected: code=${code}, reason=${reason || "none provided"}`)
			this.clients.delete(ws)
		})

		ws.on("error", (error: Error) => {
			this.log(`Client error: ${error.message}`)
		})

		// Add ping handler
		ws.on("ping", () => {
			try {
				ws.pong()
			} catch (error) {
				this.log(`Error sending pong: ${error instanceof Error ? error.message : String(error)}`)
			}
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

			// Log more detailed information
			this.log(
				`Client subscribed to event: ${payload.event}, current subscriptions: ${Array.from(clientState.subscriptions).join(", ")}`,
			)

			// Send a more detailed response
			this.sendResponse(ws, message.message_id, {
				subscribed: true,
				event: payload.event,
				allSubscriptions: Array.from(clientState.subscriptions),
			})

			// For Message event subscriptions, send a test event to verify
			if (payload.event === RooCodeEventName.Message) {
				this.sendEvent(RooCodeEventName.Message, [
					{
						taskId: "test-subscription",
						action: "created",
						message: {
							ts: Date.now(),
							type: "say",
							say: "system",
							text: "Subscription to Message events confirmed",
							partial: false,
						},
					},
				])
			}
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
		// Special handling for Message events with partial updates
		if (eventName === RooCodeEventName.Message) {
			const messageData = data as unknown[]
			if (messageData.length > 0 && typeof messageData[0] === "object") {
				const msgObj = messageData[0] as { message?: { partial?: boolean } }
				if (msgObj.message?.partial === true) {
					// Log partial message for debugging
					this.log(`Sending partial message update: ${JSON.stringify(msgObj).substring(0, 100)}...`)
				}
			}
		}

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
				try {
					ws.send(messageStr)
				} catch (error) {
					this.log(`Error sending event to client: ${error instanceof Error ? error.message : String(error)}`)
					// Consider removing the client if the connection is broken
				}
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
				// Special handling for Message events
				if (eventName === RooCodeEventName.Message) {
					const messageData = args[0] as { message?: { partial?: boolean; text?: string }; taskId?: string }
					if (messageData && messageData.message) {
						const isPartial = messageData.message.partial === true
						this.log(
							`Received ${isPartial ? "partial" : "complete"} message event for task ${messageData.taskId || "unknown"}: ${messageData.message.text?.substring(0, 50) || "(no text)"}${messageData.message.text && messageData.message.text.length > 50 ? "..." : ""}`,
						)
					}
				} else {
					// this.log(`Received event: ${eventName}, args: ${JSON.stringify(args).substring(0, 100)}...`);
				}

				// Send the event to subscribed clients
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

	/**
	 * Setup heartbeat to keep connections alive
	 */
	private setupHeartbeat(): void {
		// Send a ping every 30 seconds to keep connections alive
		this.heartbeatInterval = setInterval(() => {
			for (const [ws, clientState] of this.clients.entries()) {
				if (clientState.authenticated) {
					try {
						// Use WebSocket ping/pong mechanism
						if (ws.readyState === WebSocket.OPEN) {
							ws.ping()
							this.log(
								`Sent ping to client, last activity: ${new Date(clientState.lastActivity).toISOString()}`,
							)
						}
					} catch (error) {
						this.log(`Error sending ping: ${error instanceof Error ? error.message : String(error)}`)
					}
				}
			}
			// Log connection stats periodically
			this.logConnectionStats()
		}, 30000)
	}

	/**
	 * Get connection statistics for monitoring
	 */
	public getConnectionStats(): {
		totalConnections: number
		authenticatedConnections: number
		subscriptionStats: Record<string, number>
	} {
		const stats = {
			totalConnections: this.clients.size,
			authenticatedConnections: 0,
			subscriptionStats: {} as Record<string, number>,
		}

		// Initialize subscription stats
		Object.values(RooCodeEventName).forEach((eventName) => {
			stats.subscriptionStats[eventName] = 0
		})

		// Count authenticated connections and subscriptions
		for (const [_, clientState] of this.clients.entries()) {
			if (clientState.authenticated) {
				stats.authenticatedConnections++

				for (const eventName of clientState.subscriptions) {
					stats.subscriptionStats[eventName] = (stats.subscriptionStats[eventName] || 0) + 1
				}
			}
		}

		return stats
	}

	/**
	 * Log connection statistics
	 */
	public logConnectionStats(): void {
		const stats = this.getConnectionStats()
		this.log(`Connection stats: ${JSON.stringify(stats)}`)
	}
}
