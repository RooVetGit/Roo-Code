import { WebSocketClient } from "@roo-code/comms-clients"
import chalk from "chalk"
import { Command } from "commander"
import { displayBox, displayConfirmation, displayPrompt } from "../utils/display"
import { listPermissionsCommand } from "./permissions"
import { listProfilesCommand } from "./profile"

/**
 * Create the list command
 * @param wsClient The WebSocket client
 * @returns The list command
 */
export function listCommand(wsClient: WebSocketClient): Command {
	const command = new Command("list")
		.description("List configurations, profiles, or tasks")
		.addCommand(listConfigsCommand(wsClient))
		.addCommand(listProfilesCommand(wsClient))
		.addCommand(listTasksCommand(wsClient))
		.addCommand(listPermissionsCommand())

	return command
}

/**
 * Create the list configs command
 * @param wsClient The WebSocket client
 * @returns The list configs command
 */
function listConfigsCommand(wsClient: WebSocketClient): Command {
	return new Command("configs")
		.description("List all configurations")
		.option("--verbose", "Show detailed configuration information")
		.option("--expandable", "Show concise view with ability to expand individual configurations")
		.action(async (options) => {
			try {
				const configs = await wsClient.sendCommand("getConfiguration")

				if (options.verbose) {
					// Display full configuration details
					displayBox("Configurations", JSON.stringify(configs, null, 2), "info")
				} else {
					// Only use the listApiConfigMeta data
					if (configs && configs.listApiConfigMeta) {
						const configList = configs.listApiConfigMeta

						// Format the configuration list in the required format
						const formattedLines = Object.entries(configList).map(([key, config]: [string, any]) => {
							const name = config.name || key
							const provider = config.provider || config.apiProvider || "unknown"
							return `name: ${name}, provider: ${provider}`
						})

						if (options.expandable) {
							// For expandable view, we'll use the displayBox directly with our formatted lines
							// and then implement the expandable functionality manually
							displayBox("Configurations", formattedLines.join("\n"), "info")

							// Ask if user wants to expand any configuration
							const shouldExpand = await displayConfirmation(
								"Would you like to view the full details of any configuration?",
							)

							if (shouldExpand) {
								const configNames = Object.keys(configList)
								const selectedConfig = await displayPrompt(
									"Select a configuration to view:",
									configNames,
								)

								if (selectedConfig && configList[selectedConfig]) {
									displayBox(
										`Configuration: ${selectedConfig}`,
										JSON.stringify(configList[selectedConfig], null, 2),
										"info",
									)
								}
							}
						} else {
							// For concise view, just display the formatted lines
							displayBox("Configurations", formattedLines.join("\n"), "info")
						}
					} else {
						displayBox("Configurations", "No configuration metadata available", "info")
					}
				}
			} catch (error) {
				console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
			}
		})
}

/**
 * Create the list tasks command
 * @param wsClient The WebSocket client
 * @returns The list tasks command
 */
function listTasksCommand(wsClient: WebSocketClient): Command {
	return new Command("tasks").description("List all tasks").action(async () => {
		try {
			const tasks = await wsClient.sendCommand("getCurrentTaskStack")
			displayBox("Current Task Stack", tasks.length > 0 ? tasks.join("\n") : "No active tasks", "info")
		} catch (error) {
			console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
		}
	})
}
