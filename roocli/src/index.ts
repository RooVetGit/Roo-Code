#!/usr/bin/env node

import chalk from "chalk"
import { Command } from "commander"
import { getCommands } from "./commands"
import { WebSocketClient } from "./utils/websocket-client"
import { readWebSocketConfig } from "./utils/websocket-config"

// WebSocket client will be initialized later
let wsClient: WebSocketClient

// Create a new command instance
const program = new Command()

// Set up program metadata
program.name("roo").description("Command line interface for RooCode").version("1.0.0")

// Add global options
program.option("--debug", "Enable debug mode")

// Handle errors
program.exitOverride((err) => {
	if (err.code === "commander.help") {
		process.exit(0)
	}

	console.error(chalk.red(`Error: ${err.message}`))
	process.exit(1)
})

// Parse command line arguments
async function main() {
	try {
		// Parse global options
		const options = program.opts()
		const debug = options.debug || false

		// Read WebSocket configuration from the temp directory
		try {
			const config = await readWebSocketConfig()
			wsClient = new WebSocketClient(`ws://localhost:${config.port}`, config.token, debug)
			if (debug) {
				console.log(chalk.green(`Using WebSocket server at port ${config.port}`))
			}
		} catch (error) {
			console.error(
				chalk.yellow(
					`Warning: Could not read WebSocket configuration: ${error instanceof Error ? error.message : String(error)}`,
				),
			)
			if (debug) {
				console.log(chalk.yellow("Falling back to default WebSocket server at port 8765"))
			}
			wsClient = new WebSocketClient("ws://localhost:8765", null, debug)
		}

		// Register all commands with the initialized client
		getCommands(wsClient).forEach((command) => program.addCommand(command))

		// Connect to the WebSocket server
		await wsClient.connect()

		// Parse command line arguments
		await program.parseAsync(process.argv)

		// Don't disconnect immediately - the command will handle disconnection when it's done
		// The process will exit naturally when all event listeners are done
	} catch (error) {
		console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
		process.exit(1)
	}
}

main()
