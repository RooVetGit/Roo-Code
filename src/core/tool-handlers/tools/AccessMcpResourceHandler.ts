import { ToolUse } from "../../assistant-message" // Using generic ToolUse
import { Cline } from "../../Cline"
import { ToolUseHandler } from "../ToolUseHandler"
import { formatResponse } from "../../prompts/responses"
import { ClineAskUseMcpServer } from "../../../shared/ExtensionMessage"
import { telemetryService } from "../../../services/telemetry/TelemetryService"

export class AccessMcpResourceHandler extends ToolUseHandler {
	// No specific toolUse type override needed

	constructor(cline: Cline, toolUse: ToolUse) {
		super(cline, toolUse)
	}

	async handle(): Promise<boolean> {
		if (this.toolUse.partial) {
			await this.handlePartial()
			return false // Indicate partial handling
		} else {
			await this.handleComplete()
			return true // Indicate complete handling
		}
	}

	validateParams(): void {
		if (!this.toolUse.params.server_name) {
			throw new Error("Missing required parameter 'server_name'")
		}
		if (!this.toolUse.params.uri) {
			throw new Error("Missing required parameter 'uri'")
		}
	}

	protected async handlePartial(): Promise<void> {
		const serverName = this.toolUse.params.server_name
		const uri = this.toolUse.params.uri
		if (!serverName || !uri) return // Need server and uri for message

		const partialMessage = JSON.stringify({
			type: "access_mcp_resource",
			serverName: this.removeClosingTag("server_name", serverName),
			uri: this.removeClosingTag("uri", uri),
		} satisfies ClineAskUseMcpServer)

		try {
			await this.cline.ask("use_mcp_server", partialMessage, true)
		} catch (error) {
			console.warn("AccessMcpResourceHandler: ask for partial update interrupted.", error)
		}
	}

	protected async handleComplete(): Promise<void> {
		const serverName = this.toolUse.params.server_name
		const uri = this.toolUse.params.uri

		// --- Parameter Validation ---
		if (!serverName) {
			this.cline.consecutiveMistakeCount++
			await this.cline.pushToolResult(
				this.toolUse,
				await this.cline.sayAndCreateMissingParamError("access_mcp_resource", "server_name"),
			)
			return
		}
		if (!uri) {
			this.cline.consecutiveMistakeCount++
			await this.cline.pushToolResult(
				this.toolUse,
				await this.cline.sayAndCreateMissingParamError("access_mcp_resource", "uri"),
			)
			return
		}

		// --- Access MCP Resource ---
		try {
			this.cline.consecutiveMistakeCount = 0 // Reset on successful validation

			// --- Ask for Approval ---
			const completeMessage = JSON.stringify({
				type: "access_mcp_resource",
				serverName: serverName,
				uri: uri,
			} satisfies ClineAskUseMcpServer)

			const didApprove = await this.cline.askApprovalHelper(this.toolUse, "use_mcp_server", completeMessage)
			if (!didApprove) {
				// pushToolResult handled by helper
				return
			}

			// --- Call MCP Hub ---
			await this.cline.say("mcp_server_request_started") // Show loading/request state
			const mcpHub = this.cline.providerRef.deref()?.getMcpHub()
			if (!mcpHub) {
				throw new Error("MCP Hub is not available.")
			}

			const resourceResult = await mcpHub.readResource(serverName, uri)

			// --- Process Result ---
			const resourceResultPretty =
				resourceResult?.contents
					?.map((item) => item.text) // Extract only text content for the main result
					.filter(Boolean)
					.join("\n\n") || "(Empty response)"

			// Extract images separately
			const images: string[] = []
			resourceResult?.contents?.forEach((item) => {
				if (item.mimeType?.startsWith("image") && item.blob) {
					images.push(item.blob) // Assuming blob is base64 data URL
				}
			})

			await this.cline.say("mcp_server_response", resourceResultPretty, images.length > 0 ? images : undefined) // Show result text and images
			await this.cline.pushToolResult(
				this.toolUse,
				formatResponse.toolResult(resourceResultPretty, images.length > 0 ? images : undefined),
			)
			telemetryService.captureToolUsage(this.cline.taskId, this.toolUse.name)
		} catch (error: any) {
			// Handle errors during approval or MCP call
			await this.cline.handleErrorHelper(this.toolUse, "accessing MCP resource", error)
		}
	}
}
