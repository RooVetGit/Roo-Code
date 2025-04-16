"use strict"
var __importDefault =
	(this && this.__importDefault) ||
	function (mod) {
		return mod && mod.__esModule ? mod : { default: mod }
	}
Object.defineProperty(exports, "__esModule", { value: true })
exports.WebSocketClient = exports.EventName = void 0
const chalk_1 = __importDefault(require("chalk"))
const events_1 = require("events")
const ora_1 = __importDefault(require("ora"))
const ws_1 = __importDefault(require("ws"))
// Event names that can be subscribed to
var EventName
;(function (EventName) {
	EventName["Message"] = "message"
	EventName["TaskCreated"] = "taskCreated"
	EventName["TaskStarted"] = "taskStarted"
	EventName["TaskModeSwitched"] = "taskModeSwitched"
	EventName["TaskPaused"] = "taskPaused"
	EventName["TaskUnpaused"] = "taskUnpaused"
	EventName["TaskAskResponded"] = "taskAskResponded"
	EventName["TaskAborted"] = "taskAborted"
	EventName["TaskSpawned"] = "taskSpawned"
	EventName["TaskCompleted"] = "taskCompleted"
	EventName["TaskTokenUsageUpdated"] = "taskTokenUsageUpdated"
})(EventName || (exports.EventName = EventName = {}))
class WebSocketClient extends events_1.EventEmitter {
	constructor(url, token = null, debug = false) {
		super()
		this.ws = null
		this.token = null
		this.messageCounter = 0
		this.pendingRequests = new Map()
		this.connected = false
		this.spinner = null
		this.partialMessages = new Map()
		this.activeTaskId = null
		this.connectionTimeoutId = null
		this.debugMode = false
		this.lastActivityTime = Date.now()
		this.url = url
		this.token = token
		this.debugMode = debug
	}
	/**
	 * Connect to the WebSocket server
	 */
	connect() {
		return new Promise((resolve, reject) => {
			try {
				this.spinner = (0, ora_1.default)("Connecting to RooCode...").start()
				this.ws = new ws_1.default(this.url)
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
				this.ws.on("message", (data) => {
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
						console.error(chalk_1.default.red("Error sending pong:"), error)
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
	disconnect() {
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
	sendCommand(method, params = {}) {
		return new Promise((resolve, reject) => {
			if (!this.ws || this.ws.readyState !== ws_1.default.OPEN) {
				reject(new Error("WebSocket is not connected"))
				return
			}
			// Convert params to an array if it's an object
			// The server expects args to be an array, not an object
			const args = Array.isArray(params) ? params : [params]
			// Log the command being sent for debugging
			if (this.debugMode) {
				console.log(
					chalk_1.default.blue(`Sending command: ${method}`),
					chalk_1.default.gray(JSON.stringify(args).substring(0, 100)),
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
				resolve: (result) => {
					if (this.debugMode) {
						console.log(chalk_1.default.green(`Command ${method} completed successfully`))
					}
					resolve(result)
				},
				reject: (error) => {
					console.error(chalk_1.default.red(`Command ${method} failed: ${error.message}`))
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
	authenticate(token) {
		return new Promise((resolve, reject) => {
			if (!this.ws || this.ws.readyState !== ws_1.default.OPEN) {
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
	handleMessage(data) {
		try {
			const message = JSON.parse(data.toString())
			// Handle command responses
			if (message.message_id && this.pendingRequests.has(message.message_id)) {
				const { resolve, reject } = this.pendingRequests.get(message.message_id)
				this.pendingRequests.delete(message.message_id)
				if (message.type === "error") {
					console.error(chalk_1.default.red(`Received error response: ${message.payload.message}`))
					reject(new Error(message.payload.message))
				} else {
					if (this.debugMode) {
						console.log(
							chalk_1.default.green(`Received successful response for message ID: ${message.message_id}`),
						)
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
					// IMPORTANT: Also emit the original message event with the full data structure
					// This is needed for task.ts to process tool messages and tool ask messages
					if (this.debugMode) {
						console.log("DEBUG: Emitting original message event with full data structure")
					}
					this.emit(eventName, eventData)
					// For debugging
					if (this.debugMode) {
						for (const data of eventData) {
							if (data && data.message && data.taskId) {
								const { taskId, message, action } = data
								const { partial, text } = message
								if (partial === true) {
									console.log(
										chalk_1.default.gray(
											`Received partial message for task ${taskId}: ${text?.substring(0, 20)}...`,
										),
									)
								} else if (action === "created" || action === "updated") {
									console.log(
										chalk_1.default.green(
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
				console.log(chalk_1.default.yellow("Received unknown message:"), message)
			}
		} catch (error) {
			console.error(chalk_1.default.red("Error parsing message:"), error)
		}
	}
	/**
	 * Remove all event listeners for a specific task
	 * This prevents memory leaks and ensures that event listeners from previous tasks
	 * don't interfere with new tasks
	 */
	removeTaskEventListeners() {
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
			console.log(chalk_1.default.blue("Removed all task event listeners"))
		}
	}
	/**
	 * Handle partial message updates from the WebSocket server
	 * @param messageData The message data array
	 */
	handlePartialMessageUpdates(messageData) {
		for (const data of messageData) {
			if (!data || !data.message || !data.taskId) continue
			const { taskId, message, action } = data
			// Extract fields from the ClineMessage structure
			const { partial, text, type, ask, say } = message
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
							console.log(chalk_1.default.gray(`Delta (substring): "${delta}"`))
						}
					} else {
						// If we can't determine the delta, just use the text as is
						// This is a fallback and shouldn't normally happen
						delta = text
						if (this.debugMode) {
							console.log(chalk_1.default.yellow(`Delta (fallback): "${delta}"`))
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
	isConnected() {
		return this.connected && this.ws !== null && this.ws.readyState === ws_1.default.OPEN
	}
	/**
	 * Subscribe to an event
	 * @param event The event to subscribe to
	 * @returns A promise that resolves when the subscription is successful
	 */
	subscribeToEvent(event) {
		return new Promise((resolve, reject) => {
			if (!this.ws || this.ws.readyState !== ws_1.default.OPEN) {
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
	subscribeToTaskEvents(taskId) {
		this.activeTaskId = taskId
		if (this.debugMode) {
			console.log(chalk_1.default.blue(`Subscribing to events for task: ${taskId}`))
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
	getTimeSinceLastActivity() {
		return Date.now() - this.lastActivityTime
	}
	/**
	 * Reset the last activity time
	 */
	resetLastActivityTime() {
		this.lastActivityTime = Date.now()
	}
	/**
	 * Get the debug mode status
	 * @returns Whether debug mode is enabled
	 */
	isDebugMode() {
		return this.debugMode
	}
}
exports.WebSocketClient = WebSocketClient
