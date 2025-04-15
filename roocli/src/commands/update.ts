import chalk from "chalk"
import { Command } from "commander"
import { displayBox } from "../utils/display"
import { WebSocketClient } from "../utils/websocket-client"
import { updateProfileCommand } from "./profile"

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
		.option("--interact <type>", "Interact with the task (primary or secondary)")
		.action(async (options) => {
			try {
				if (options.interact) {
					if (options.interact !== "primary" && options.interact !== "secondary") {
						throw new Error('Interact type must be either "primary" or "secondary"')
					}

					const method = options.interact === "primary" ? "pressPrimaryButton" : "pressSecondaryButton"
					await wsClient.sendCommand(method, {})
					displayBox("Task Interaction", `Initiated ${options.interact} interaction with the task`, "success")
				} else if (options.mode) {
					// There doesn't seem to be a direct API method for updating task mode
					console.error(chalk.red(`Error: Updating task mode is not currently supported`))
				} else if (options.message) {
					await wsClient.sendCommand("sendMessage", { text: options.message })
					displayBox("Message Sent", "Message has been sent to the task", "success")
				} else {
					throw new Error("At least one of --mode, --message, or --interact option is required")
				}
			} catch (error) {
				console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
			}
		})
}
