import chalk from "chalk"
import { Command } from "commander"
import { displayBox, displayConfirmation } from "../utils/display"
import { WebSocketClient } from "../utils/websocket-client"

/**
 * Create the delete command
 * @param wsClient The WebSocket client
 * @returns The delete command
 */
export function deleteCommand(wsClient: WebSocketClient): Command {
	const command = new Command("delete")
		.description("Delete a configuration, profile, or task")
		.addCommand(deleteConfigCommand(wsClient))
		.addCommand(deleteProfileCommand(wsClient))
		.addCommand(deleteTaskCommand(wsClient))

	return command
}

/**
 * Create the delete config command
 * @param wsClient The WebSocket client
 * @returns The delete config command
 */
function deleteConfigCommand(wsClient: WebSocketClient): Command {
	return new Command("config")
		.description("Delete a configuration")
		.requiredOption("--name <name>", "Configuration name")
		.option("-f, --force", "Force deletion without confirmation")
		.action(async (options) => {
			try {
				let shouldDelete = options.force

				if (!shouldDelete) {
					shouldDelete = await displayConfirmation(
						`Are you sure you want to delete configuration "${options.name}"?`,
					)
				}

				if (shouldDelete) {
					await wsClient.sendCommand("deleteConfiguration", { name: options.name })
					displayBox("Configuration Deleted", `Configuration "${options.name}" has been deleted`, "success")
				} else {
					console.log(chalk.yellow("Configuration deletion cancelled"))
				}
			} catch (error) {
				console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
			}
		})
}

/**
 * Create the delete profile command
 * @param wsClient The WebSocket client
 * @returns The delete profile command
 */
function deleteProfileCommand(wsClient: WebSocketClient): Command {
	return new Command("profile")
		.description("Delete a profile")
		.requiredOption("--name <name>", "Profile name")
		.option("-f, --force", "Force deletion without confirmation")
		.action(async (options) => {
			try {
				let shouldDelete = options.force

				if (!shouldDelete) {
					shouldDelete = await displayConfirmation(
						`Are you sure you want to delete profile "${options.name}"?`,
					)
				}

				if (shouldDelete) {
					await wsClient.sendCommand("deleteProfile", options.name)
					displayBox("Profile Deleted", `Profile "${options.name}" has been deleted`, "success")
				} else {
					console.log(chalk.yellow("Profile deletion cancelled"))
				}
			} catch (error) {
				console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
			}
		})
}

/**
 * Create the delete task command
 * @param wsClient The WebSocket client
 * @returns The delete task command
 */
function deleteTaskCommand(wsClient: WebSocketClient): Command {
	return new Command("task")
		.description("Delete a task")
		.requiredOption("--id <id>", "Task ID")
		.option("-f, --force", "Force deletion without confirmation")
		.action(async (options) => {
			try {
				let shouldDelete = options.force

				if (!shouldDelete) {
					shouldDelete = await displayConfirmation(`Are you sure you want to delete task "${options.id}"?`)
				}

				if (shouldDelete) {
					await wsClient.sendCommand("deleteTask", { id: options.id })
					displayBox("Task Deleted", `Task "${options.id}" has been deleted`, "success")
				} else {
					console.log(chalk.yellow("Task deletion cancelled"))
				}
			} catch (error) {
				console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
			}
		})
}
