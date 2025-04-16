import { WebSocketClient } from "@roo-code/comms-clients"
import chalk from "chalk"
import { Command } from "commander"
import * as fs from "fs"
import * as path from "path"
import { displayBox } from "../utils/display"

/**
 * Create the set command
 * @param wsClient The WebSocket client
 * @returns The set command
 */
export function setCommand(wsClient: WebSocketClient): Command {
	const command = new Command("set").description("Set configuration values").addCommand(setConfigCommand(wsClient))

	return command
}

/**
 * Create the set config command
 * @param wsClient The WebSocket client
 * @returns The set config command
 */
function setConfigCommand(wsClient: WebSocketClient): Command {
	return new Command("config")
		.description("Set a new configuration")
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
					try {
						const filePath = path.resolve(options.file)
						const fileContent = fs.readFileSync(filePath, "utf8")
						config = JSON.parse(fileContent)
					} catch (error) {
						throw new Error(`Error reading file: ${error instanceof Error ? error.message : String(error)}`)
					}
				} else {
					throw new Error("Either --json or --file option is required")
				}

				// Add debugging to see what's being sent
				if (wsClient.isDebugMode()) {
					console.log("Sending configuration:", JSON.stringify(config, null, 2))
				}

				// Ensure config is a valid object before sending
				if (!config || typeof config !== "object") {
					throw new Error("Configuration must be a valid object")
				}

				// Make sure we're sending the right parameter format
				// Fix: Send the config object directly without wrapping it in a 'config' property
				await wsClient.sendCommand("setConfiguration", config)
				displayBox("Configuration Set", "Configuration has been successfully set", "success")
			} catch (error) {
				console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
			}
		})
}
