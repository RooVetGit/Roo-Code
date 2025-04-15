const WebSocket = require("ws")
const fs = require("fs")
const path = require("path")
const os = require("os")
const readline = require("readline")

// Function to read WebSocket configuration
async function readWebSocketConfig() {
	try {
		const configPath = path.join(os.tmpdir(), "roocode-websocket-config.json")
		const configData = await fs.promises.readFile(configPath, "utf-8")
		const config = JSON.parse(configData)

		if (!config.port || !config.token) {
			throw new Error("Invalid WebSocket configuration")
		}

		return config
	} catch (error) {
		console.error(`Error reading WebSocket config: ${error.message}`)
		throw error
	}
}

// Message types
const MessageType = {
	METHOD_CALL: "method_call",
	EVENT_SUBSCRIPTION: "event_subscription",
	EVENT: "event",
	ERROR: "error",
	AUTHENTICATION: "authentication",
}

// RooCodeEventName enum
const RooCodeEventName = {
	Message: "message",
	TaskCreated: "taskCreated",
	TaskStarted: "taskStarted",
	TaskModeSwitched: "taskModeSwitched",
	TaskPaused: "taskPaused",
	TaskUnpaused: "taskUnpaused",
	TaskAskResponded: "taskAskResponded",
	TaskAborted: "taskAborted",
	TaskSpawned: "taskSpawned",
	TaskCompleted: "taskCompleted",
	TaskTokenUsageUpdated: "taskTokenUsageUpdated",
}

// Create readline interface for user input
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
})

// Main function
async function main() {
	try {
		// Read WebSocket configuration
		const config = await readWebSocketConfig()
		console.log(`Using WebSocket configuration: port=${config.port}, token=${config.token.substring(0, 3)}...`)

		// Connect to WebSocket server
		const ws = new WebSocket(`ws://localhost:${config.port}`)

		// Set up event handlers
		ws.on("open", () => {
			console.log("Connected to WebSocket server")

			// Authenticate
			authenticate(ws, config.token)
		})

		// Track current task and message state
		let currentTaskId = null
		let currentMessage = ""
		let messageCount = 0
		let partialCount = 0

		ws.on("message", (data) => {
			const message = JSON.parse(data)

			// Handle different message types
			if (message.type === MessageType.METHOD_CALL) {
				console.log("\nReceived method call response:", JSON.stringify(message.payload, null, 2))

				// If this is a response to startNewTask, store the task ID
				if (message.payload && typeof message.payload === "string" && message.payload.length > 0) {
					currentTaskId = message.payload
					console.log(`\nTask started with ID: ${currentTaskId}`)
				}
			} else if (message.type === MessageType.EVENT) {
				const { event, data } = message.payload

				// Handle different event types
				if (event === RooCodeEventName.Message) {
					handleMessageEvent(data)
				} else if (event === RooCodeEventName.TaskStarted) {
					console.log(`\nTask started: ${data[0]}`)
				} else if (event === RooCodeEventName.TaskCompleted) {
					console.log(`\nTask completed: ${data[0]}`)
					console.log(`Token usage: ${JSON.stringify(data[1], null, 2)}`)
				} else {
					console.log(`\nReceived event: ${event}`)
				}
			} else if (message.type === MessageType.ERROR) {
				console.error("\nReceived error:", message.payload)
			}

			// If authentication was successful, subscribe to events
			if (message.type === MessageType.METHOD_CALL && message.payload.success === true) {
				// Subscribe to events
				subscribeToEvents(ws)

				// Show prompt for user input
				showPrompt()
			}
		})

		// Handle message events
		function handleMessageEvent(data) {
			if (!Array.isArray(data) || data.length === 0) {
				return
			}

			const messageData = data[0]
			if (!messageData || !messageData.message) {
				return
			}

			const { partial, text, type, say } = messageData.message

			// Only process assistant messages
			if (type === "say" && say === "assistant") {
				if (partial === true) {
					// This is a partial update
					partialCount++
					process.stdout.write(text || "")
					currentMessage += text || ""
				} else {
					// This is a complete message
					messageCount++
					if (text) {
						process.stdout.write("\n" + text + "\n")
						currentMessage = text
					}

					// Show stats after complete message
					console.log(
						`\n\n[Stats] Received ${messageCount} complete messages and ${partialCount} partial updates`,
					)

					// Show prompt for user input
					showPrompt()
				}
			}
		}

		ws.on("close", () => {
			console.log("Disconnected from WebSocket server")
			rl.close()
			process.exit(0)
		})

		ws.on("error", (error) => {
			console.error("WebSocket error:", error.message)
		})

		// Show prompt for user input
		function showPrompt() {
			rl.question('\nEnter a prompt (or "exit" to quit): ', (input) => {
				if (input.toLowerCase() === "exit") {
					console.log("Closing WebSocket connection...")
					ws.close()
					rl.close()
					process.exit(0)
				} else if (input.toLowerCase() === "stats") {
					console.log(
						`\n[Stats] Received ${messageCount} complete messages and ${partialCount} partial updates`,
					)
					showPrompt()
				} else {
					// Send the message
					if (currentTaskId) {
						// If we have a task ID, send a message to the existing task
						sendMessage(ws, input)
					} else {
						// Otherwise, start a new task
						startNewTask(ws, input)
					}
				}
			})
		}

		// Handle process termination
		process.on("SIGINT", () => {
			console.log("Closing WebSocket connection...")
			ws.close()
			rl.close()
			process.exit(0)
		})
	} catch (error) {
		console.error("Error:", error.message)
		rl.close()
		process.exit(1)
	}
}

// Authenticate with the WebSocket server
function authenticate(ws, token) {
	const message = {
		message_id: generateMessageId(),
		type: MessageType.AUTHENTICATION,
		payload: {
			token: token,
		},
	}

	ws.send(JSON.stringify(message))
	console.log("Sent authentication request")
}

// Subscribe to events
function subscribeToEvents(ws) {
	// Subscribe to all events
	Object.values(RooCodeEventName).forEach((eventName) => {
		const message = {
			message_id: generateMessageId(),
			type: MessageType.EVENT_SUBSCRIPTION,
			payload: {
				event: eventName,
			},
		}

		ws.send(JSON.stringify(message))
		console.log(`Subscribed to event: ${eventName}`)
	})
}

// Start a new task
function startNewTask(ws, prompt) {
	const message = {
		message_id: generateMessageId(),
		type: MessageType.METHOD_CALL,
		payload: {
			method: "startNewTask",
			args: [
				{
					text: prompt,
					configuration: {},
				},
			],
		},
	}

	ws.send(JSON.stringify(message))
	console.log("Called startNewTask method")
}

// Send a message to the current task
function sendMessage(ws, text) {
	const message = {
		message_id: generateMessageId(),
		type: MessageType.METHOD_CALL,
		payload: {
			method: "sendMessage",
			args: [text],
		},
	}

	ws.send(JSON.stringify(message))
	console.log("Called sendMessage method")
}

// Generate a random message ID
function generateMessageId() {
	return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

// Run the main function
main().catch((error) => {
	console.error("Unhandled error:", error)
	process.exit(1)
})
