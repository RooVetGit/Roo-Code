import chalk from "chalk"
import { Command } from "commander"
import { displayBox } from "../utils/display"
import { WebSocketClient } from "../utils/websocket-client"

/**
 * Create the get command
 * @param wsClient The WebSocket client
 * @returns The get command
 */
export function getCommand(wsClient: WebSocketClient): Command {
	const command = new Command("get")
		.description("Get configuration or profile information")
		.option("-c, --config", "Get the current configuration")
		.option("-p, --profiles", "Get all profiles")
		.option("-a, --active-profile", "Get the active profile")
		.option("-r, --ready", "Check if RooCode is ready")
		.option("-t, --tasks", "Get the current task stack")
		.action(async (options) => {
			try {
				if (options.config) {
					const config = await wsClient.sendCommand("getConfiguration")
					displayBox("Configuration", JSON.stringify(config, null, 2), "info")
				} else if (options.profiles) {
					const profiles = await wsClient.sendCommand("getProfiles")
					displayBox("Profiles", profiles.join("\n"), "info")
				} else if (options.activeProfile) {
					const activeProfile = await wsClient.sendCommand("getActiveProfile")
					displayBox("Active Profile", activeProfile || "No active profile", "info")
				} else if (options.ready) {
					const ready = await wsClient.sendCommand("isReady")
					displayBox("RooCode Status", ready ? "Ready" : "Not Ready", ready ? "success" : "warning")
				} else if (options.tasks) {
					const tasks = await wsClient.sendCommand("getCurrentTaskStack")
					displayBox("Current Task Stack", tasks.length > 0 ? tasks.join("\n") : "No active tasks", "info")
				} else {
					command.help()
				}
			} catch (error) {
				console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
			}
		})

	return command
}
