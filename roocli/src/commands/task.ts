import chalk from "chalk"
import { EventName, WebSocketClient } from "../../../comms-clients/websocket-client"
import { displayCollapsibleBox } from "../utils/display"
import { storeFollowupQuestion } from "../utils/followup-store"
import { parseFollowupQuestion } from "../utils/message-helpers"

/**
 * Utility functions for task operations
 * These functions are used by the create and update commands
 */

/**
 * Wait for a specified amount of time
 * @param ms Time to wait in milliseconds
 */
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Set up event listeners for a task
 * @export
 * @param wsClient The WebSocket client
 * @param taskId The ID of the task to listen for
 */
export async function setupTaskEventListeners(wsClient: WebSocketClient, taskId: string): Promise<void> {
	// First, clean up any existing event listeners to prevent duplicates
	wsClient.removeTaskEventListeners()

	// Create a set to track processed message contents to prevent duplicates
	const processedContents = new Set<string>()

	// Track the last displayed message to prevent immediate duplicates
	let lastDisplayedMessage = ""

	// Flag to track if we need to add a newline before the next message
	let needsNewline = false

	// Subscribe to all events for this task to keep the connection alive
	await wsClient.subscribeToTaskEvents(taskId)

	// Handle partial message updates
	wsClient.on("partialMessage", (data) => {
		if (data.taskId === taskId) {
			// Write the delta (new part) to stdout without a newline
			process.stdout.write(data.delta || "")
		}
	})
	// Handle complete messages
	wsClient.on("completeMessage", (data) => {
		if (data.taskId === taskId) {
			// Skip if this is exactly the same as the last displayed message
			if (data.content === lastDisplayedMessage) {
				return
			}

			// Skip if we've already processed this content
			if (processedContents.has(data.content)) {
				return
			}

			// Mark this content as processed
			processedContents.add(data.content)
			lastDisplayedMessage = data.content

			// Add a newline if needed
			if (needsNewline) {
				console.log("")
				needsNewline = false
			}

			// Check if this is a followup question with suggestions
			const followupQuestion = parseFollowupQuestion(data.content)

			if (followupQuestion) {
				// Store the followup question for later use with --interact-suggestions
				storeFollowupQuestion({
					...followupQuestion,
					taskId: data.taskId,
				})

				// Set the flag to add a newline before the next message
				needsNewline = true

				// Format and display the followup question
				console.log(chalk.blue("\nQuestion:"), followupQuestion.question)
				console.log(chalk.blue("\nSuggested answers:"))

				followupQuestion.suggest.forEach((suggestion: string, index: number) => {
					console.log(`${chalk.green(index + 1 + ".")} ${suggestion}`)
				})

				console.log(chalk.yellow("\nUse 'roocli update task --interact-suggestions' to select an answer"))
				console.log(
					chalk.yellow(
						"Or use 'roocli update task --message \"your response\"' to provide a custom response",
					),
				)
			} else {
				// Check if the content is JSON and filter out unwanted JSON output
				try {
					const jsonContent = JSON.parse(data.content)

					// If it contains a "request" field, it's likely the unwanted JSON output
					if (jsonContent.request) {
						// Skip printing this JSON
						return
					}

					// If it contains a "Result" field, it's likely the unwanted JSON output
					if (typeof jsonContent === "object" && "Result" in jsonContent) {
						// Skip printing this JSON
						return
					}

					// Check if this might be a checkpoint hash
					if (
						typeof jsonContent === "string" &&
						jsonContent.length === 40 &&
						/^[0-9a-f]+$/.test(jsonContent)
					) {
						// This looks like a checkpoint hash
						displayCollapsibleBox("Checkpoint Saved", `Checkpoint hash: ${jsonContent}`, "success")
						return
					}

					// Check if the content contains a checkpoint hash
					const content = data.content.trim()
					const hashMatch = content.match(/([0-9a-f]{40})/)
					if (hashMatch) {
						displayCollapsibleBox("Checkpoint Saved", `Checkpoint hash: ${hashMatch[1]}`, "success")
						return
					}

					// Otherwise, print the JSON content with proper spacing
					console.log(data.content)
					needsNewline = true
				} catch (e) {
					// Not JSON, check if it's a checkpoint hash in plain text
					const content = data.content.trim()

					// Check if the content contains a checkpoint hash
					const hashMatch = content.match(/([0-9a-f]{40})/)
					if (hashMatch) {
						// Add a newline before checkpoint messages
						console.log("")
						displayCollapsibleBox("Checkpoint Saved", `Checkpoint hash: ${hashMatch[1]}`, "success")
						needsNewline = true
						return
					}
					if (content.length === 40 && /^[0-9a-f]+$/.test(content)) {
						// This looks like a checkpoint hash
						// Add a newline before checkpoint messages
						console.log("")
						displayCollapsibleBox("Checkpoint Saved", `Checkpoint hash: ${content}`, "success")
						needsNewline = true
						return
					}

					// Not a checkpoint hash, just print the content
					console.log(data.content)
					needsNewline = true
				}
			}
		}
	})

	// We no longer need the original message handler as it causes duplicate output
	// The partialMessage and completeMessage handlers above handle all message types

	// Set up handlers for all events in the EventName enum
	// This ensures the CLI handles the same events as the webview-UI

	// Handle task completion events
	wsClient.on(EventName.TaskCompleted, (payload) => {
		if (payload && payload[0] && payload[0] === taskId) {
			console.log(chalk.green("\nTask completed."))
			// Clean up event listeners when the task is completed
			wsClient.removeTaskEventListeners()
			// Signal that the task is complete
			wsClient.emit("taskFinished", taskId)
		}
	})

	// Handle task aborted events
	wsClient.on(EventName.TaskAborted, (payload) => {
		if (payload && payload[0] && payload[0] === taskId) {
			console.log(chalk.yellow("\nTask aborted."))
			// Clean up event listeners when the task is aborted
			wsClient.removeTaskEventListeners()
			// Signal that the task is complete
			wsClient.emit("taskFinished", taskId)
		}
	})

	// Handle ask response events (when user interaction is required)
	wsClient.on(EventName.TaskAskResponded, (payload) => {
		if (payload && payload[0] && payload[0] === taskId) {
			console.log(chalk.blue("\nTask is waiting for your response."))
			// Clean up event listeners when the task requires user interaction
			// wsClient.removeTaskEventListeners()
			// Signal that the task is complete
			// wsClient.emit("taskFinished", taskId)
		}
	})

	// Handle task started events
	wsClient.on(EventName.TaskStarted, (payload) => {
		if (payload && payload[0] && payload[0] === taskId) {
			if (wsClient.isDebugMode()) {
				console.log(chalk.blue(`Task ${taskId} started.`))
			}
		}
	})

	// Handle task mode switched events
	wsClient.on(EventName.TaskModeSwitched, (payload) => {
		if (payload && payload.length >= 2 && payload[0] === taskId) {
			if (wsClient.isDebugMode()) {
				console.log(chalk.blue(`Task switched to mode: ${payload[1]}`))
			}
		}
	})

	// Handle task paused events
	wsClient.on(EventName.TaskPaused, (payload) => {
		if (payload && payload[0] && payload[0] === taskId) {
			if (wsClient.isDebugMode()) {
				console.log(chalk.yellow(`Task ${taskId} paused.`))
			}
		}
	})

	// Handle task unpaused events
	wsClient.on(EventName.TaskUnpaused, (payload) => {
		if (payload && payload[0] && payload[0] === taskId) {
			if (wsClient.isDebugMode()) {
				console.log(chalk.green(`Task ${taskId} resumed.`))
			}
		}
	})

	// Handle task spawned events
	wsClient.on(EventName.TaskSpawned, (payload) => {
		if (payload && payload.length >= 2 && payload[0] === taskId) {
			if (wsClient.isDebugMode()) {
				console.log(chalk.blue(`Task spawned child task: ${payload[1]}`))
			}
		}
	})

	// Handle token usage updated events
	// wsClient.on(EventName.TaskTokenUsageUpdated, (payload) => {
	// 	if (payload && payload.length >= 2 && payload[0] === taskId) {
	// 		console.log(chalk.blue(`Token usage updated: ${JSON.stringify(payload[1])}`))
	// 	}
	// })

	// Handle message events for checkpoint_saved
	wsClient.on("message", (eventData) => {
		if (Array.isArray(eventData) && eventData.length > 0) {
			for (const data of eventData) {
				if (data && data.taskId === taskId && data.message) {
					const { message } = data

					// Skip if we've already processed this content
					if (message.text && processedContents.has(message.text)) {
						continue
					}

					// Mark this content as processed if it has text
					if (message.text) {
						processedContents.add(message.text)
					}

					// Add a newline before checkpoint messages
					if (message.type === "say" && message.say === "checkpoint_saved") {
						console.log("")
						needsNewline = false
					}

					// Check if this is a checkpoint_saved message
					if (message.type === "say" && message.say === "checkpoint_saved" && message.text) {
						// Set the flag to add a newline before the next message
						needsNewline = true
						try {
							// Try to parse the checkpoint hash from the message text
							const checkpointData = JSON.parse(message.text)
							if (checkpointData && typeof checkpointData === "object") {
								// Display the checkpoint hash in a collapsible box
								const hash = checkpointData.hash || "Unknown"
								displayCollapsibleBox("Checkpoint Saved", `Checkpoint hash: ${hash}`, "success")
							}
						} catch (e) {
							// If parsing fails, just display the raw text
							displayCollapsibleBox("Checkpoint Saved", message.text, "success")
						}
					}
				}
			}
		}
	})
}

/**
 * Wait for a task to complete or timeout
 * @export
 * @param wsClient The WebSocket client
 * @param taskId The ID of the task to wait for
 * @param timeoutMs Timeout in milliseconds
 * @returns A promise that resolves when the task is complete or times out
 */
export async function waitForTaskCompletion(
	wsClient: WebSocketClient,
	taskId: string,
	timeoutMs: number = 20000,
): Promise<void> {
	return new Promise<void>((resolve) => {
		// Reset the last activity time
		wsClient.resetLastActivityTime()

		let timeoutId: NodeJS.Timeout
		let activityCheckId: NodeJS.Timeout

		// Set up a listener for the taskFinished event
		const finishListener = (id: string) => {
			if (id === taskId) {
				clearTimeout(timeoutId)
				clearInterval(activityCheckId)
				wsClient.removeListener("taskFinished", finishListener)
				resolve()
			}
		}

		// Listen for the taskFinished event
		wsClient.on("taskFinished", finishListener)

		// Set up an interval to check for activity
		activityCheckId = setInterval(() => {
			// If there's been activity in the last 5 seconds, reset the timeout
			if (wsClient.getTimeSinceLastActivity() < 5000) {
				// Activity detected, reset the timeout
				clearTimeout(timeoutId)

				// Set up a new timeout
				timeoutId = setTimeout(() => {
					clearInterval(activityCheckId)
					wsClient.removeListener("taskFinished", finishListener)
					console.log(chalk.yellow("\nTask is still running. Press Ctrl+C to exit."))
					resolve()
				}, timeoutMs)
			}
		}, 1000)

		// Set up the initial timeout
		timeoutId = setTimeout(() => {
			clearInterval(activityCheckId)
			wsClient.removeListener("taskFinished", finishListener)

			// Check if there's been any activity
			if (wsClient.getTimeSinceLastActivity() < timeoutMs) {
				// If there's been activity, keep waiting
				console.log(chalk.yellow("\nTask is still running. Press Ctrl+C to exit."))
			} else {
				// If we haven't received any events, assume the task is not going to respond
				console.log(chalk.red("\nNo response received from task within timeout period."))
				wsClient.removeTaskEventListeners()
			}

			resolve()
		}, timeoutMs)
	})
}
// No taskCommand function - this functionality has been moved to create.ts and update.ts
