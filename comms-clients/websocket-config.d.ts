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
export declare function getWebSocketConfigPath(): string
/**
 * Read WebSocket server configuration from the temp directory
 * @returns A promise that resolves with the WebSocket server configuration
 * @throws Error if the configuration file does not exist or is invalid
 */
export declare function readWebSocketConfig(): Promise<WebSocketConfig>
