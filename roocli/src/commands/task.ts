import chalk from "chalk"
import { Command } from "commander"
import { displayBox, displayTextInput } from "../utils/display"
import { WebSocketClient } from "../utils/websocket-client"

/**
 * Create the task command
 * @param wsClient The WebSocket client
 * @returns The task command
 */
export function taskCommand(wsClient: WebSocketClient): Command {
	const task = new Command("task").description("Manage tasks")

	// New task command
	task.command("new [message]")
		.description("Start a new task with an optional message")
		.option("-i, --interactive", "Enter message interactively")
		.option("-t, --tab", "Open in a new tab")
		.action(async (message, options) => {
			try {
				let taskMessage = message

				if (options.interactive || !taskMessage) {
					taskMessage = await displayTextInput("Enter your task message:")
				}

				if (!taskMessage) {
					console.log(chalk.yellow("No message provided. Task creation cancelled."))
					return
				}

				const taskId = await wsClient.sendCommand("startNewTask", {
					text: taskMessage,
					newTab: options.tab || false,
				})

				displayBox("Task Created", `New task created with ID: ${taskId}`, "success")

				// Set up event listeners for streaming responses
				wsClient.on("message", (payload) => {
					if (payload && payload[0] && payload[0].taskId === taskId) {
						const message = payload[0].message
						if (message && message.text) {
							console.log(message.text)
						}
					}
				})
			} catch (error) {
				console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
			}
		})

	// Resume task command
	task.command("resume <taskId>")
		.description("Resume a paused task")
		.action(async (taskId) => {
			try {
				// Check if task exists
				const exists = await wsClient.sendCommand("isTaskInHistory", { taskId })

				if (!exists) {
					console.error(chalk.red(`Error: Task with ID ${taskId} does not exist`))
					return
				}

				await wsClient.sendCommand("resumeTask", { taskId })
				displayBox("Task Resumed", `Task ${taskId} has been resumed`, "success")
			} catch (error) {
				console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
			}
		})

	// Clear task command
	task.command("clear")
		.description("Clear the current task")
		.option("-m, --message <message>", "Final message for the task")
		.action(async (options) => {
			try {
				await wsClient.sendCommand("clearCurrentTask", { lastMessage: options.message })
				displayBox("Task Cleared", "Current task has been cleared", "success")
			} catch (error) {
				console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
			}
		})

	// Cancel task command
	task.command("cancel")
		.description("Cancel the current task")
		.action(async () => {
			try {
				await wsClient.sendCommand("cancelCurrentTask")
				displayBox("Task Cancelled", "Current task has been cancelled", "success")
			} catch (error) {
				console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
			}
		})

	// Send message to task command
	task.command("message <message>")
		.description("Send a message to the current task")
		.option("-i, --interactive", "Enter message interactively")
		.action(async (message, options) => {
			try {
				let taskMessage = message

				if (options.interactive) {
					taskMessage = await displayTextInput("Enter your message:", message)
				}

				await wsClient.sendCommand("sendMessage", { text: taskMessage })
				displayBox("Message Sent", "Message has been sent to the current task", "success")
			} catch (error) {
				console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
			}
		})

	return task
}
