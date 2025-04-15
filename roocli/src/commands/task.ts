import chalk from "chalk"
import { EventName, WebSocketClient } from "../utils/websocket-client"

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
			// Write the complete message with a newline
			console.log("\n" + data.content)
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
			console.log(chalk.blue(`Task ${taskId} started.`))
		}
	})

	// Handle task mode switched events
	wsClient.on(EventName.TaskModeSwitched, (payload) => {
		if (payload && payload.length >= 2 && payload[0] === taskId) {
			console.log(chalk.blue(`Task switched to mode: ${payload[1]}`))
		}
	})

	// Handle task paused events
	wsClient.on(EventName.TaskPaused, (payload) => {
		if (payload && payload[0] && payload[0] === taskId) {
			console.log(chalk.yellow(`Task ${taskId} paused.`))
		}
	})

	// Handle task unpaused events
	wsClient.on(EventName.TaskUnpaused, (payload) => {
		if (payload && payload[0] && payload[0] === taskId) {
			console.log(chalk.green(`Task ${taskId} resumed.`))
		}
	})

	// Handle task spawned events
	wsClient.on(EventName.TaskSpawned, (payload) => {
		if (payload && payload.length >= 2 && payload[0] === taskId) {
			console.log(chalk.blue(`Task spawned child task: ${payload[1]}`))
		}
	})

	// Handle token usage updated events
	// wsClient.on(EventName.TaskTokenUsageUpdated, (payload) => {
	// 	if (payload && payload.length >= 2 && payload[0] === taskId) {
	// 		console.log(chalk.blue(`Token usage updated: ${JSON.stringify(payload[1])}`))
	// 	}
	// })
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
