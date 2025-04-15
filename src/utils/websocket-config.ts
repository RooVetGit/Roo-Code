import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"
import { fileExistsAtPath } from "./fs"

/**
 * Interface for WebSocket server configuration
 */
export interface WebSocketConfig {
	port: number
	token: string
}

/**
 * Get the path to the WebSocket configuration file
 * @returns The path to the WebSocket configuration file
 */
export function getWebSocketConfigPath(): string {
	return path.join(os.tmpdir(), "roocode-websocket-config.json")
}

/**
 * Write WebSocket server configuration to a file in the temp directory
 * @param config The WebSocket server configuration
 * @returns A promise that resolves when the file is written
 */
export async function writeWebSocketConfig(config: WebSocketConfig): Promise<void> {
	try {
		const configPath = getWebSocketConfigPath()
		await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8")
	} catch (error) {
		console.error(`Error writing WebSocket config: ${error instanceof Error ? error.message : String(error)}`)
		throw error
	}
}

/**
 * Read WebSocket server configuration from the temp directory
 * @returns A promise that resolves with the WebSocket server configuration
 * @throws Error if the configuration file does not exist or is invalid
 */
export async function readWebSocketConfig(): Promise<WebSocketConfig> {
	try {
		const configPath = getWebSocketConfigPath()

		if (!(await fileExistsAtPath(configPath))) {
			throw new Error("WebSocket configuration file not found. Is the RooCode extension running?")
		}

		const configData = await fs.readFile(configPath, "utf-8")
		const config = JSON.parse(configData) as WebSocketConfig

		if (!config.port || !config.token) {
			throw new Error("Invalid WebSocket configuration")
		}

		return config
	} catch (error) {
		console.error(`Error reading WebSocket config: ${error instanceof Error ? error.message : String(error)}`)
		throw error
	}
}
