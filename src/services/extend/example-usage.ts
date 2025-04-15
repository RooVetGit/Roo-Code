/**
 * Example usage of the WebSocketServer class.
 * This file is for demonstration purposes only and is not meant to be executed directly.
 */

import * as vscode from "vscode"
import { API } from "../../exports/api"
import { WebSocketServer } from "./websocket-server"

// Example of how to initialize and use the WebSocketServer
export function initializeWebSocketServer(api: API, outputChannel: vscode.OutputChannel): WebSocketServer {
	// Generate a token for authentication
	const token = Math.random().toString(36).substring(2, 15)

	// Create a new WebSocketServer instance with the API instance
	const wsServer = new WebSocketServer(api, token, outputChannel, 8765)

	// Start the WebSocket server
	wsServer.start()

	// The server will now:
	// 1. Listen for connections from CLI clients
	// 2. Require authentication with the token
	// 3. Forward API method calls from authenticated clients to the API instance
	// 4. Allow clients to subscribe to specific events
	// 5. Forward events from the API to subscribed clients

	return wsServer
}

/**
 * Example of how a CLI client would connect to the WebSocket server:
 *
 * ```javascript
 * const WebSocket = require('ws');
 * const ws = new WebSocket('ws://localhost:8765');
 *
 * // Authentication token (should be obtained securely)
 * const token = 'your-auth-token-here';
 *
 * ws.on('open', () => {
 *   console.log('Connected to RooCode WebSocket server');
 *
 *   // First authenticate with the server
 *   ws.send(JSON.stringify({
 *     message_id: 'auth-1',
 *     type: 'authentication',
 *     payload: {
 *       token: token
 *     }
 *   }));
 * });
 *
 * // After authentication succeeds, you can make method calls
 * function callMethod() {
 *   // Example: Call the getConfiguration method
 *   ws.send(JSON.stringify({
 *     message_id: 'call-1',
 *     type: 'method_call',
 *     payload: {
 *       method: 'getConfiguration',
 *       args: []
 *     }
 *   }));
 * }
 * });
 *
 * // Subscribe to events
 * function subscribeToEvent(eventName) {
 *   ws.send(JSON.stringify({
 *     message_id: `sub-${eventName}`,
 *     type: 'event_subscription',
 *     payload: {
 *       event: eventName
 *     }
 *   }));
 * }
 *
 * // Handle incoming messages
 * ws.on('message', (data) => {
 *   const message = JSON.parse(data.toString());
 *
 *   // Handle different message types
 *   switch(message.type) {
 *     case 'method_call':
 *       console.log(`Method result for ${message.message_id}:`, message.payload);
 *       break;
 *     case 'event':
 *       const eventData = message.payload;
 *       console.log(`Event received: ${eventData.event}`, eventData.data);
 *       break;
 *     case 'error':
 *       console.error(`Error: ${message.payload.code} - ${message.payload.message}`);
 *       break;
 *   }
 * });
 *
 * // Example: Start a new task
 * function startNewTask(text) {
 *   ws.send(JSON.stringify({
 *     message_id: 'task-1',
 *     type: 'method_call',
 *     payload: {
 *       method: 'startNewTask',
 *       args: [{
 *         text,
 *         newTab: true
 *       }]
 *     }
 *   }));
 * }
 * ```
 */
