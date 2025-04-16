import chalk from "chalk"
import { Command } from "commander"
import { displayBox, displayFollowupQuestion, displayTextInput } from "../utils/display"
import { getLastFollowupQuestion } from "../utils/followup-store"
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
		.option(
			"--interact-suggestions [number]",
			"Interact with followup questions and select from suggested answers (optionally specify suggestion number)",
		)
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

				// Handle sending message to task or interacting with suggestions
				if (options.message || options.interactive || options.interactSuggestions) {
					// Get the current task ID
					if (wsClient.isDebugMode()) {
						console.log(chalk.blue("Getting current task stack..."))
					}
					const currentTaskStack = await wsClient.sendCommand("getCurrentTaskStack")
					if (wsClient.isDebugMode()) {
						console.log(chalk.blue("Current task stack:"), currentTaskStack)
					}

					if (!currentTaskStack || !Array.isArray(currentTaskStack) || currentTaskStack.length === 0) {
						console.error(chalk.red("Error: No active task found"))
						return
					}

					const taskId = currentTaskStack[currentTaskStack.length - 1]
					if (wsClient.isDebugMode()) {
						console.log(chalk.blue(`Using task ID: ${taskId}`))
					}

					// Check if we need to handle ask-type message with suggestions
					if (options.interactSuggestions) {
						// Get the last stored followup question
						const followupQuestion = getLastFollowupQuestion()

						if (!followupQuestion) {
							console.error(
								chalk.red(
									"Error: No followup question found. Run a task first to get a question with suggestions.",
								),
							)
							return
						}

						// Check if the stored question is for the current task
						if (followupQuestion.taskId !== taskId) {
							console.log(chalk.yellow("Warning: The stored followup question is from a different task."))
							console.log(chalk.yellow(`Stored question task ID: ${followupQuestion.taskId}`))
							console.log(chalk.yellow(`Current task ID: ${taskId}`))

							// Ask for confirmation
							const proceed = await displayTextInput(
								"Do you want to proceed with this question from a different task? (y/n)",
								"n",
							)

							if (proceed.toLowerCase() !== "y" && proceed.toLowerCase() !== "yes") {
								console.log(chalk.yellow("Operation cancelled."))
								return
							}
						}

						// Get the selected suggestion
						let selectedMessage: string

						// Check if a suggestion number was provided directly
						if (options.interactSuggestions !== true) {
							// A suggestion number was provided
							const suggestionIndex = parseInt(options.interactSuggestions, 10) - 1

							// Validate the suggestion index
							if (
								isNaN(suggestionIndex) ||
								suggestionIndex < 0 ||
								suggestionIndex >= followupQuestion.suggest.length
							) {
								console.error(
									chalk.red(
										`Error: Invalid suggestion number. Please provide a number between 1 and ${followupQuestion.suggest.length}`,
									),
								)
								return
							}

							// Get the selected suggestion
							const selectedSuggestion = followupQuestion.suggest[suggestionIndex]

							// If there's an additional message, append it to the selected suggestion
							if (options.message) {
								selectedMessage = `${selectedSuggestion}\n${options.message}`
							} else {
								selectedMessage = selectedSuggestion
							}

							// Display what was selected
							console.log(chalk.blue(`Selected suggestion ${suggestionIndex + 1}: ${selectedSuggestion}`))
						} else {
							// Use the interactive selection
							selectedMessage = await displayFollowupQuestion(followupQuestion, options.message)
						}

						// Set the selected message in the chat box
						if (wsClient.isDebugMode()) {
							console.log(chalk.blue(`Setting selected message in chat box: "${selectedMessage}"`))
						}
						await wsClient.sendCommand("sendMessage", { text: selectedMessage })

						// Then press the primary button to send it
						if (wsClient.isDebugMode()) {
							console.log(chalk.blue(`Sending message by pressing primary button`))
						}
						await wsClient.sendCommand("pressPrimaryButton")
						displayBox("Message Sent", "Selected suggestion has been sent to the task", "success")
					} else {
						// Handle regular message sending
						let taskMessage = options.message

						if (options.interactive) {
							taskMessage = await displayTextInput("Enter your message:", options.message || "")
						}

						if (!taskMessage) {
							console.log(chalk.yellow("No message provided. Operation cancelled."))
							return
						}

						// First set the message in the chat box
						if (wsClient.isDebugMode()) {
							console.log(chalk.blue(`Setting message in chat box: "${taskMessage}"`))
						}
						await wsClient.sendCommand("sendMessage", { text: taskMessage })

						// Then press the primary button to send it
						if (wsClient.isDebugMode()) {
							console.log(chalk.blue(`Sending message by pressing primary button`))
						}
						await wsClient.sendCommand("pressPrimaryButton")
						displayBox("Message Sent", "Message has been sent to the current task", "success")
					}

					// Set up event listeners for the task to receive streaming responses
					await setupTaskEventListeners(wsClient, taskId)

					// Wait for the task to complete or timeout
					if (wsClient.isDebugMode()) {
						console.log(chalk.blue("Waiting for task to respond..."))
					}
					await waitForTaskCompletion(wsClient, taskId)
					return
				}

				throw new Error(
					"At least one of --resume, --clear, --cancel, --mode, --message, --interact, or --interact-suggestions option is required",
				)
			} catch (error) {
				console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
			}
		})
}
