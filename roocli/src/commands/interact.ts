import chalk from "chalk"
import { Command } from "commander"
import { WebSocketClient } from "../../../comms-clients/websocket-client"
import { displayBox } from "../utils/display"

/**
 * Create the interact command
 * @param wsClient The WebSocket client
 * @returns The interact command
 */
export function interactCommand(wsClient: WebSocketClient): Command {
	const command = new Command("interact")
		.description("Interact with the current task")
		.option("-p, --primary", "Press the primary button")
		.option("-s, --secondary", "Press the secondary button")
		.action(async (options) => {
			try {
				if (options.primary) {
					await wsClient.sendCommand("pressPrimaryButton")
					displayBox("Button Pressed", "Primary button pressed", "success")
				} else if (options.secondary) {
					await wsClient.sendCommand("pressSecondaryButton")
					displayBox("Button Pressed", "Secondary button pressed", "success")
				} else {
					console.log(chalk.yellow("Please specify either --primary or --secondary"))
					command.help()
				}
			} catch (error) {
				console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
			}
		})

	return command
}
