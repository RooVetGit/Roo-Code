import chalk from "chalk"
import { Command } from "commander"
import { displayBox, displayTextInput } from "../utils/display"
import { WebSocketClient } from "../utils/websocket-client"
import { updateProfileCommand } from "./profile"
import { setupTaskEventListeners, waitForTaskCompletion } from "./task"

/**
 * Create the update command
 * @param wsClient The WebSocket client
 * @returns The update command
 */
export function updateCommand(wsClient: WebSocketClient): Command {
	const command = new Command("update")
		.description("Update a configuration, profile, or task")
		.addCommand(updateConfigCommand(wsClient))
		.addCommand(updateProfileCommand(wsClient))
		.addCommand(updateTaskCommand(wsClient))

	return command
}

/**
 * Create the update config command
 * @param wsClient The WebSocket client
 * @returns The update config command
 */
function updateConfigCommand(wsClient: WebSocketClient): Command {
	return new Command("config")
		.description("Update an existing configuration")
		.requiredOption("--name <name>", "Configuration name")
		.option("--json <json>", "JSON configuration string")
		.option("--file <file>", "Path to JSON configuration file")
		.action(async (options) => {
			try {
				let config

				if (options.json) {
					try {
						config = JSON.parse(options.json)
					} catch (error) {
						throw new Error("Invalid JSON format")
					}
				} else if (options.file) {
					// Implementation for reading from file would go here
					throw new Error("File reading not implemented yet")
				} else {
					throw new Error("Either --json or --file option is required")
				}

				const result = await wsClient.sendCommand("updateConfiguration", { name: options.name, config })
				displayBox(
					"Configuration Updated",
					`Configuration "${options.name}" has been successfully updated`,
					"success",
				)
			} catch (error) {
				console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
			}
		})
}

/**
 * Create the update task command
 * @param wsClient The WebSocket client
 * @returns The update task command
 */
function updateTaskCommand(wsClient: WebSocketClient): Command {
	return new Command("task")
		.description("Update a task")
		.option("--mode <mode>", "Change task mode")
		.option("--message <message>", "Send a message to the task")
		.option("--interactive", "Enter message interactively")
		.option("--interact <type>", "Interact with the task (primary or secondary)")
		.option("--resume", "Resume a paused task")
		.option("--taskId <taskId>", "Task ID to operate on (required for --resume)")
		.option("--clear", "Clear the current task")
		.option("--final-message <message>", "Final message for the task when clearing")
		.option("--cancel", "Cancel the current task")
		.action(async (options) => {
			try {
				// Handle resume task
				if (options.resume) {
					if (!options.taskId) {
						throw new Error("--taskId is required when using --resume")
					}

					// Check if task exists
					const exists = await wsClient.sendCommand("isTaskInHistory", { taskId: options.taskId })

					if (!exists) {
						throw new Error(`Task with ID ${options.taskId} does not exist`)
					}

					await wsClient.sendCommand("resumeTask", { taskId: options.taskId })
					displayBox("Task Resumed", `Task ${options.taskId} has been resumed`, "success")

					// Set up event listeners for the task
					await setupTaskEventListeners(wsClient, options.taskId)

					// Wait for the task to complete or timeout
					console.log(chalk.blue("Waiting for task to respond..."))
					await waitForTaskCompletion(wsClient, options.taskId)
					return
				}

				// Handle clear task
				if (options.clear) {
					await wsClient.sendCommand("clearCurrentTask", { lastMessage: options.finalMessage })
					displayBox("Task Cleared", "Current task has been cleared", "success")
					return
				}

				// Handle cancel task
				if (options.cancel) {
					await wsClient.sendCommand("cancelCurrentTask")
					displayBox("Task Cancelled", "Current task has been cancelled", "success")
					return
				}

				// Handle interact with task
				if (options.interact) {
					if (options.interact !== "primary" && options.interact !== "secondary") {
						throw new Error('Interact type must be either "primary" or "secondary"')
					}

					const method = options.interact === "primary" ? "pressPrimaryButton" : "pressSecondaryButton"
					await wsClient.sendCommand(method, {})
					displayBox("Task Interaction", `Initiated ${options.interact} interaction with the task`, "success")
					return
				}

				// Handle mode change
				if (options.mode) {
					// There doesn't seem to be a direct API method for updating task mode
					console.error(chalk.red(`Error: Updating task mode is not currently supported`))
					return
				}

				// Handle sending message to task
				if (options.message || options.interactive) {
					let taskMessage = options.message

					if (options.interactive) {
						taskMessage = await displayTextInput("Enter your message:", options.message || "")
					}

					if (!taskMessage) {
						console.log(chalk.yellow("No message provided. Operation cancelled."))
						return
					}

					// Get the current task ID
					console.log(chalk.blue("Getting current task stack..."))
					const currentTaskStack = await wsClient.sendCommand("getCurrentTaskStack")
					console.log(chalk.blue("Current task stack:"), currentTaskStack)

					if (!currentTaskStack || !Array.isArray(currentTaskStack) || currentTaskStack.length === 0) {
						console.error(chalk.red("Error: No active task found"))
						return
					}

					const taskId = currentTaskStack[currentTaskStack.length - 1]
					console.log(chalk.blue(`Using task ID: ${taskId}`))

					// First set the message in the chat box
					console.log(chalk.blue(`Setting message in chat box: "${taskMessage}"`))
					await wsClient.sendCommand("sendMessage", { text: taskMessage })

					// Then press the primary button to send it
					console.log(chalk.blue(`Sending message by pressing primary button`))
					await wsClient.sendCommand("pressPrimaryButton")
					displayBox("Message Sent", "Message has been sent to the current task", "success")

					// Set up event listeners for the task to receive streaming responses
					await setupTaskEventListeners(wsClient, taskId)

					// Wait for the task to complete or timeout
					console.log(chalk.blue("Waiting for task to respond..."))
					await waitForTaskCompletion(wsClient, taskId)
					return
				}

				throw new Error(
					"At least one of --resume, --clear, --cancel, --mode, --message, or --interact option is required",
				)
			} catch (error) {
				console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
			}
		})
}
