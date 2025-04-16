import chalk from "chalk"
import { EventEmitter } from "events"
import ora from "ora"
import WebSocket from "ws"

interface WebSocketMessage {
	message_id: string
	type: "method_call" | "event" | "authentication" | "error" | "event_subscription"
	payload: any
}

interface WebSocketResponse {
	message_id: string
	type: string
	payload: any
}

interface PartialMessage {
	taskId: string
	currentContent: string
}

// Event names that can be subscribed to
export enum EventName {
	Message = "message",
	TaskCreated = "taskCreated",
	TaskStarted = "taskStarted",
	TaskModeSwitched = "taskModeSwitched",
	TaskPaused = "taskPaused",
	TaskUnpaused = "taskUnpaused",
	TaskAskResponded = "taskAskResponded",
	TaskAborted = "taskAborted",
	TaskSpawned = "taskSpawned",
	TaskCompleted = "taskCompleted",
	TaskTokenUsageUpdated = "taskTokenUsageUpdated",
}

export class WebSocketClient extends EventEmitter {
	private ws: WebSocket | null = null
	private url: string
	private token: string | null = null
	private messageCounter: number = 0
	private pendingRequests: Map<string, { resolve: Function; reject: Function }> = new Map()
	private connected: boolean = false
	private spinner: any = null
	private partialMessages: Map<string, PartialMessage> = new Map()
	private activeTaskId: string | null = null
	private connectionTimeoutId: NodeJS.Timeout | null = null
	private debugMode: boolean = false
	private lastActivityTime: number = Date.now()

	constructor(url: string, token: string | null = null, debug: boolean = false) {
		super()
		this.url = url
		this.token = token
		this.debugMode = debug
	}

	/**
	 * Connect to the WebSocket server
	 */
	public connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				this.spinner = ora("Connecting to RooCode...").start()

				this.ws = new WebSocket(this.url)

				this.ws.on("open", async () => {
					// If we have a token, authenticate with the server
					if (this.token) {
						try {
							await this.authenticate(this.token)
							this.connected = true
							this.spinner.succeed("Connected and authenticated to RooCode")
							resolve()
						} catch (error) {
							this.spinner.fail(
								`Authentication failed: ${error instanceof Error ? error.message : String(error)}`,
							)
							this.ws?.close()
							reject(error)
						}
					} else {
						this.connected = true
						this.spinner.succeed("Connected to RooCode")
						resolve()
					}
				})

				this.ws.on("message", (data: WebSocket.Data) => {
					this.handleMessage(data)
				})

				this.ws.on("error", (error) => {
					this.spinner.fail(`Connection error: ${error.message}`)
					reject(error)
				})

				this.ws.on("close", () => {
					this.connected = false
					if (this.spinner) {
						this.spinner.stop()
					}
					this.emit("disconnected")
				})

				// Set up ping/pong handling for heartbeat
				this.ws.on("ping", () => {
					try {
						this.ws?.pong()
					} catch (error) {
						console.error(chalk.red("Error sending pong:"), error)
					}
				})

				// Set a timeout for the initial connection only
				this.connectionTimeoutId = setTimeout(() => {
					if (!this.connected) {
						this.spinner.fail("Connection timeout")
						reject(new Error("Connection timeout"))
					}
				}, 5000)
			} catch (error) {
				if (this.spinner) {
					this.spinner.fail(`Connection error: ${error instanceof Error ? error.message : String(error)}`)
				}
				reject(error)
			}
		})
	}

	/**
	 * Disconnect from the WebSocket server
	 */
	public disconnect(): void {
		// Clear the connection timeout if it exists
		if (this.connectionTimeoutId) {
			clearTimeout(this.connectionTimeoutId)
			this.connectionTimeoutId = null
		}

		if (this.ws) {
			this.ws.close()
			this.ws = null
		}
	}

	/**
	 * Send a command to the WebSocket server
	 * @param method The method to call
	 * @param params The parameters to pass to the method
	 * @returns A promise that resolves with the result of the command
	 */
	public sendCommand<T = any>(method: string, params: any = {}): Promise<T> {
		return new Promise((resolve, reject) => {
			if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
				reject(new Error("WebSocket is not connected"))
				return
			}

			// Convert params to an array if it's an object
			// The server expects args to be an array, not an object
			const args = Array.isArray(params) ? params : [params]

			// Log the command being sent for debugging
			if (this.debugMode) {
				console.log(
					chalk.blue(`Sending command: ${method}`),
					chalk.gray(JSON.stringify(args).substring(0, 100)),
				)
			}

			const id = String(++this.messageCounter)
			const message = {
				message_id: id,
				type: "method_call",
				payload: {
					method,
					args: args,
				},
			}

			this.pendingRequests.set(id, {
				resolve: (result: T) => {
					if (this.debugMode) {
						console.log(chalk.green(`Command ${method} completed successfully`))
					}
					resolve(result)
				},
				reject: (error: Error) => {
					console.error(chalk.red(`Command ${method} failed: ${error.message}`))
					reject(error)
				},
			})
			this.ws.send(JSON.stringify(message))
		})
	}

	/**
	 * Authenticate with the WebSocket server
	 * @param token The authentication token
	 * @returns A promise that resolves when authentication is successful
	 */
	private authenticate(token: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
				reject(new Error("WebSocket is not connected"))
				return
			}

			const id = String(++this.messageCounter)
			const message = {
				message_id: id,
				type: "authentication",
				payload: {
					token,
				},
			}

			this.pendingRequests.set(id, {
				resolve: () => resolve(),
				reject,
			})

			this.ws.send(JSON.stringify(message))
		})
	}

	/**
	 * Handle incoming messages from the WebSocket server
	 * @param data The message data
	 */
	private handleMessage(data: WebSocket.Data): void {
		try {
			const message = JSON.parse(data.toString())

			// Handle command responses
			if (message.message_id && this.pendingRequests.has(message.message_id)) {
				const { resolve, reject } = this.pendingRequests.get(message.message_id)!
				this.pendingRequests.delete(message.message_id)

				if (message.type === "error") {
					console.error(chalk.red(`Received error response: ${message.payload.message}`))
					reject(new Error(message.payload.message))
				} else {
					if (this.debugMode) {
						console.log(chalk.green(`Received successful response for message ID: ${message.message_id}`))
					}
					resolve(message.payload)
				}
				return
			}

			// Handle events
			if (message.type === "event" && message.payload && message.payload.event) {
				const eventName = message.payload.event
				const eventData = message.payload.data

				// Update last activity time
				this.lastActivityTime = Date.now()

				// Log all events received (except for high-frequency events like partial messages)
				// if (eventName !== "message" || !Array.isArray(eventData) || eventData.length === 0 || !eventData[0].message || eventData[0].message.partial !== true) {
				// 	console.log(chalk.cyan(`Received event: ${eventName}`));
				// }

				// Handle message events specially to avoid duplicates
				if (eventName === "message" && Array.isArray(eventData)) {
					// Process partial message updates through our special handler
					this.handlePartialMessageUpdates(eventData)

					// For debugging
					if (this.debugMode) {
						for (const data of eventData) {
							if (data && data.message && data.taskId) {
								const { taskId, message, action } = data
								const { partial, text } = message

								if (partial === true) {
									console.log(
										chalk.gray(
											`Received partial message for task ${taskId}: ${text?.substring(0, 20)}...`,
										),
									)
								} else if (action === "created" || action === "updated") {
									console.log(
										chalk.green(
											`Received complete message for task ${taskId}: ${text?.substring(0, 20)}...`,
										),
									)
								}
							}
						}
					}
				} else {
					// For all other events, emit them normally
					this.emit(eventName, eventData)
				}
				return
			}

			// Handle unknown messages
			if (this.debugMode) {
				console.log(chalk.yellow("Received unknown message:"), message)
			}
		} catch (error) {
			console.error(chalk.red("Error parsing message:"), error)
		}
	}

	/**
	 * Remove all event listeners for a specific task
	 * This prevents memory leaks and ensures that event listeners from previous tasks
	 * don't interfere with new tasks
	 */
	public removeTaskEventListeners(): void {
		// Remove all event listeners for specific events
		this.removeAllListeners("partialMessage")
		this.removeAllListeners("completeMessage")

		// Remove listeners for all events in the EventName enum
		Object.values(EventName).forEach((eventName) => {
			this.removeAllListeners(eventName)
		})

		// Reset active task ID
		this.activeTaskId = null

		if (this.debugMode) {
			console.log(chalk.blue("Removed all task event listeners"))
		}
	}

	/**
	 * Handle partial message updates from the WebSocket server
	 * @param messageData The message data array
	 */
	private handlePartialMessageUpdates(messageData: any[]): void {
		for (const data of messageData) {
			if (!data || !data.message || !data.taskId) continue

			const { taskId, message, action } = data
			const { partial, text } = message

			// Skip if there's no text content
			if (text === undefined) continue

			if (partial === true) {
				// This is a partial message update
				let partialMessage = this.partialMessages.get(taskId)
				let delta = text || ""

				if (!partialMessage) {
					// Initialize a new partial message if this is the first partial update
					partialMessage = {
						taskId,
						currentContent: "",
					}
					this.partialMessages.set(taskId, partialMessage)
				} else {
					// Calculate the actual delta (only the new part)
					// If the new text starts with the current content, extract only the new part
					if (text.startsWith(partialMessage.currentContent)) {
						delta = text.substring(partialMessage.currentContent.length)
						if (this.debugMode) {
							console.log(chalk.gray(`Delta (substring): "${delta}"`))
						}
					} else {
						// If we can't determine the delta, just use the text as is
						// This is a fallback and shouldn't normally happen
						delta = text
						if (this.debugMode) {
							console.log(chalk.yellow(`Delta (fallback): "${delta}"`))
						}
					}
				}

				// Append the new text to the current content
				partialMessage.currentContent = text || ""

				// Emit a special event for partial updates with only the new part (delta)
				this.emit("partialMessage", {
					taskId,
					content: partialMessage.currentContent,
					delta: delta,
				})
			} else if (action === "created" || action === "updated") {
				// This is a complete message, clear any partial state
				this.partialMessages.delete(taskId)

				// Emit a special event for complete messages
				this.emit("completeMessage", {
					taskId,
					content: text,
				})
			}
		}
	}

	/**
	 * Check if the WebSocket is connected
	 */
	public isConnected(): boolean {
		return this.connected && this.ws !== null && this.ws.readyState === WebSocket.OPEN
	}

	/**
	 * Subscribe to an event
	 * @param event The event to subscribe to
	 * @returns A promise that resolves when the subscription is successful
	 */
	public subscribeToEvent(event: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
				reject(new Error("WebSocket is not connected"))
				return
			}

			const id = String(++this.messageCounter)
			const message = {
				message_id: id,
				type: "event_subscription",
				payload: {
					event,
				},
			}

			this.pendingRequests.set(id, {
				resolve: () => resolve(),
				reject,
			})

			this.ws.send(JSON.stringify(message))
		})
	}

	/**
	 * Subscribe to all events for a specific task
	 * @param taskId The ID of the task to subscribe to
	 */
	public subscribeToTaskEvents(taskId: string): Promise<void> {
		this.activeTaskId = taskId
		if (this.debugMode) {
			console.log(chalk.blue(`Subscribing to events for task: ${taskId}`))
		}

		// Clear the connection timeout as we're now in active task mode
		if (this.connectionTimeoutId) {
			clearTimeout(this.connectionTimeoutId)
			this.connectionTimeoutId = null
		}

		// Subscribe to ALL events in the EventName enum to ensure synchronization with webview-UI
		const subscriptionPromises = Object.values(EventName).map((eventName) => {
			// console.log(chalk.blue(`Subscribing to event: ${eventName}`));
			return this.subscribeToEvent(eventName)
		})

		return Promise.all(subscriptionPromises).then(() => {
			// console.log(chalk.green("Successfully subscribed to all task events"));
			return Promise.resolve()
		})
	}

	/**
	 * Get the time since the last activity
	 * @returns Time in milliseconds since the last activity
	 */
	public getTimeSinceLastActivity(): number {
		return Date.now() - this.lastActivityTime
	}

	/**
	 * Reset the last activity time
	 */
	public resetLastActivityTime(): void {
		this.lastActivityTime = Date.now()
	}

	/**
	 * Get the debug mode status
	 * @returns Whether debug mode is enabled
	 */
	public isDebugMode(): boolean {
		return this.debugMode
	}
}
