const WebSocket = require("ws")
const fs = require("fs")
const path = require("path")
const os = require("os")

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

		ws.on("message", (data) => {
			const message = JSON.parse(data)
			console.log("Received message:", JSON.stringify(message, null, 2))

			// Handle different message types
			if (message.type === MessageType.METHOD_CALL) {
				console.log("Received method call response:", message.payload)
			} else if (message.type === MessageType.EVENT) {
				console.log("Received event:", message.payload.event)
				handleEvent(message.payload)
			} else if (message.type === MessageType.ERROR) {
				console.error("Received error:", message.payload)
			}

			// If authentication was successful, subscribe to events and call methods
			if (message.type === MessageType.METHOD_CALL && message.payload.success === true) {
				// Subscribe to events
				subscribeToEvents(ws)

				// Call methods
				setTimeout(() => {
					getConfiguration(ws)
				}, 1000)

				// Start a new task after 2 seconds
				setTimeout(() => {
					startNewTask(ws)
				}, 2000)
			}
		})

		ws.on("close", () => {
			console.log("Disconnected from WebSocket server")
		})

		ws.on("error", (error) => {
			console.error("WebSocket error:", error.message)
		})

		// Handle process termination
		process.on("SIGINT", () => {
			console.log("Closing WebSocket connection...")
			ws.close()
			process.exit(0)
		})
	} catch (error) {
		console.error("Error:", error.message)
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

// Get configuration
function getConfiguration(ws) {
	const message = {
		message_id: generateMessageId(),
		type: MessageType.METHOD_CALL,
		payload: {
			method: "getConfiguration",
			args: [],
		},
	}

	ws.send(JSON.stringify(message))
	console.log("Called getConfiguration method")
}

// Start a new task
function startNewTask(ws) {
	const message = {
		message_id: generateMessageId(),
		type: MessageType.METHOD_CALL,
		payload: {
			method: "startNewTask",
			args: [
				{
					text: "Hello from WebSocket client! Please respond with a long message that will be streamed.",
					configuration: {},
				},
			],
		},
	}

	ws.send(JSON.stringify(message))
	console.log("Called startNewTask method")
}

// Handle events
function handleEvent(payload) {
	const { event, data } = payload

	if (event === RooCodeEventName.Message) {
		const messageData = data[0]
		if (messageData && messageData.message) {
			const { partial, text } = messageData.message
			if (partial === true) {
				process.stdout.write(text || "")
			} else if (text) {
				process.stdout.write("\n" + text + "\n")
			}
		}
	}
}

// Generate a random message ID
function generateMessageId() {
	return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

// Run the main function
main().catch((error) => {
	console.error("Unhandled error:", error)
})
