import { Command } from "commander"
import { WebSocketClient } from "../../../comms-clients/websocket-client"
import { createCommand } from "./create"
import { deleteCommand } from "./delete"
import { listCommand } from "./list"
import { permissionsCommand } from "./permissions"
import { setCommand } from "./set"
import { updateCommand } from "./update"

/**
 * Get all commands for the CLI
 * @param wsClient The WebSocket client
 * @returns An array of commands
 */
export function getCommands(wsClient: WebSocketClient): Command[] {
	return [
		listCommand(wsClient),
		createCommand(wsClient),
		updateCommand(wsClient),
		deleteCommand(wsClient),
		setCommand(wsClient),
		permissionsCommand(wsClient),
	]
}
