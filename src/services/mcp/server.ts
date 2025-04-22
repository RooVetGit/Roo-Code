import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { zodToJsonSchema } from "zod-to-json-schema"
import {
	ToolName,
	NewTaskMessageSchema,
	SendMessageSchema,
	PressPrimaryButtonSchema,
	PressSecondaryButtonSchema,
	Event,
	ASK_REPLY_EVENT,
} from "./types"
import type { JsonSchema7ObjectType } from "zod-to-json-schema"
import { NotificationEventHub } from "./NotificationEventHub"

export const createServer = (
	eventHub: NotificationEventHub,
	handler: (params: { toolName: any; arguments: any }) => Promise<string>,
	timeoutMs: number = 5_000,
	triggerLogging: boolean = false,
) => {
	const server = new Server(
		{
			name: "roo-code-mcp",
			version: "1.0.0",
		},
		{
			capabilities: {
				prompts: {},
				resources: { subscribe: true },
				tools: {},
				logging: {},
			},
		},
	)

	server.setRequestHandler(ListToolsRequestSchema, async () => {
		const tools = [
			{
				name: ToolName.START_NEW_TASK,
				description: "Start a new task with initial instructions",
				inputSchema: {
					type: "object",
					properties: (zodToJsonSchema(NewTaskMessageSchema) as JsonSchema7ObjectType).properties,
				},
			},
			{
				name: ToolName.SEND_MESSAGE,
				description: "Send a message for the current task",
				inputSchema: {
					type: "object",
					properties: (zodToJsonSchema(SendMessageSchema) as JsonSchema7ObjectType).properties,
				},
			},
			{
				name: ToolName.PRESS_PRIMARY_BUTTON,
				description: "Press the primary action button",
				inputSchema: {
					type: "object",
					properties: (zodToJsonSchema(PressPrimaryButtonSchema) as JsonSchema7ObjectType).properties,
				},
			},
			{
				name: ToolName.PRESS_SECONDARY_BUTTON,
				description: "Press the secondary action button",
				inputSchema: {
					type: "object",
					properties: (zodToJsonSchema(PressSecondaryButtonSchema) as JsonSchema7ObjectType).properties,
				},
			},
		]
		return { tools }
	})

	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		const toolName = request.params.name
		const args = request.params.arguments
		// console.log("Tool handler called with request:", request.params);
		const clientId = `client-${Date.now()}`
		const emitter = eventHub.subscribe(clientId)
		// console.log("Tool handler called with:", toolName, args);
		const waitForEndCurrentTurnOrTimeout = new Promise<void>((resolve) => {
			let timeoutId: NodeJS.Timeout

			// Function to reset or set the timeout
			const resetTimeout = () => {
				// Clear existing timeout if any
				if (timeoutId) clearTimeout(timeoutId)

				// Set a new timeout
				timeoutId = setTimeout(() => {
					if (triggerLogging) {
						server.sendLoggingMessage({
							level: "info",
							data: {
								message: `timout event`,
							},
						})
					}
					eventHub.unsubscribe(clientId)
					emitter.removeListener(ASK_REPLY_EVENT, eventListener)
					resolve()
				}, timeoutMs)
			}

			// Set initial timeout
			resetTimeout()

			const eventListener = (event: Event) => {
				// Log the event
				if (triggerLogging) {
					server.sendLoggingMessage({
						level: "info",
						data: {
							event: event.event,
							payload: event.data,
						},
					})
				}

				// Reset timeout on any event
				resetTimeout()

				if (event.event === "EndCurrentTurn") {
					clearTimeout(timeoutId)
					eventHub.unsubscribe(clientId)
					emitter.removeListener(ASK_REPLY_EVENT, eventListener)
					resolve()
				}
			}

			emitter.on(ASK_REPLY_EVENT, eventListener)
		})

		const [result] = await Promise.all([
			handler({ toolName: toolName, arguments: args }),
			waitForEndCurrentTurnOrTimeout,
		])
		eventHub.unsubscribe(clientId)
		return {
			content: [
				{
					type: "text",
					text: result,
				},
			],
		}
	})

	return server
}
