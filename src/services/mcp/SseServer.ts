import express from "express"
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
import { createServer } from "./server"

import { NotificationEventHub } from "./NotificationEventHub"
import { apiToolHandler } from "./ToolCallHandler"
import { API } from "../../exports/api"

export async function runSseServer(event_hub: NotificationEventHub, cline: API) {
	const server = createServer(event_hub, apiToolHandler(event_hub, cline, 30_000), 30_000, false)
	const app = express()
	let transport: SSEServerTransport | null = null

	app.get("/sse", async (req, res) => {
		transport = new SSEServerTransport("/messages", res)
		await server.connect(transport)
	})

	app.post("/messages", async (req, res) => {
		// Note: to support multiple simultaneous connections, these messages will
		// need to be routed to a specific matching transport. (This logic isn't
		// implemented here, for simplicity.)
		if (transport) {
			await transport.handlePostMessage(req, res)
		}
	})

	try {
		app.listen(3001)
		console.log("SSE server started on port 3001")
	} catch (err: any) {
		console.error("Failed to start SSE server", err)
	}
}
