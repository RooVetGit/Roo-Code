import { ToolUse } from "../../assistant-message" // Using generic ToolUse
import { Cline } from "../../Cline"
import { ToolUseHandler } from "../ToolUseHandler"
import { formatResponse } from "../../prompts/responses"
import { ClineAskUseMcpServer } from "../../../shared/ExtensionMessage"
import { telemetryService } from "../../../services/telemetry/TelemetryService"

export class UseMcpToolHandler extends ToolUseHandler {
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
		if (!this.toolUse.params.tool_name) {
			throw new Error("Missing required parameter 'tool_name'")
		}
		// arguments is optional, but JSON format is validated in handleComplete
	}

	protected async handlePartial(): Promise<void> {
		const serverName = this.toolUse.params.server_name
		const toolName = this.toolUse.params.tool_name
		const mcpArguments = this.toolUse.params.arguments
		if (!serverName || !toolName) return // Need server and tool name for message

		const partialMessage = JSON.stringify({
			type: "use_mcp_tool",
			serverName: this.removeClosingTag("server_name", serverName),
			toolName: this.removeClosingTag("tool_name", toolName),
			arguments: this.removeClosingTag("arguments", mcpArguments), // Optional
		} satisfies ClineAskUseMcpServer)

		try {
			await this.cline.ask("use_mcp_server", partialMessage, true)
		} catch (error) {
			console.warn("UseMcpToolHandler: ask for partial update interrupted.", error)
		}
	}

	protected async handleComplete(): Promise<void> {
		const serverName = this.toolUse.params.server_name
		const toolName = this.toolUse.params.tool_name
		const mcpArguments = this.toolUse.params.arguments

		// --- Parameter Validation ---
		if (!serverName) {
			this.cline.consecutiveMistakeCount++
			await this.cline.pushToolResult(
				this.toolUse,
				await this.cline.sayAndCreateMissingParamError("use_mcp_tool", "server_name"),
			)
			return
		}
		if (!toolName) {
			this.cline.consecutiveMistakeCount++
			await this.cline.pushToolResult(
				this.toolUse,
				await this.cline.sayAndCreateMissingParamError("use_mcp_tool", "tool_name"),
			)
			return
		}

		let parsedArguments: Record<string, unknown> | undefined
		if (mcpArguments) {
			try {
				parsedArguments = JSON.parse(mcpArguments)
			} catch (error: any) {
				this.cline.consecutiveMistakeCount++
				await this.cline.say("error", `Roo tried to use ${toolName} with an invalid JSON argument. Retrying...`)
				await this.cline.pushToolResult(
					this.toolUse,
					formatResponse.toolError(formatResponse.invalidMcpToolArgumentError(serverName, toolName)),
				)
				return
			}
		}

		// --- Execute MCP Tool ---
		try {
			this.cline.consecutiveMistakeCount = 0 // Reset on successful validation

			// --- Ask for Approval ---
			const completeMessage = JSON.stringify({
				type: "use_mcp_tool",
				serverName: serverName,
				toolName: toolName,
				arguments: mcpArguments, // Show raw JSON string in approval
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

			const toolResult = await mcpHub.callTool(serverName, toolName, parsedArguments)

			// --- Process Result ---
			// TODO: Handle progress indicators and non-text/resource responses if needed
			const toolResultPretty =
				(toolResult?.isError ? "Error:\n" : "") +
				(toolResult?.content
					?.map((item) => {
						if (item.type === "text") return item.text
						// Basic representation for resource types in the result text
						if (item.type === "resource") {
							const { blob, ...rest } = item.resource // Exclude blob from stringification
							return `[Resource: ${JSON.stringify(rest, null, 2)}]`
						}
						return ""
					})
					.filter(Boolean)
					.join("\n\n") || "(No response)")

			await this.cline.say("mcp_server_response", toolResultPretty) // Show formatted result
			await this.cline.pushToolResult(this.toolUse, formatResponse.toolResult(toolResultPretty))
			telemetryService.captureToolUsage(this.cline.taskId, this.toolUse.name)
		} catch (error: any) {
			// Handle errors during approval or MCP call
			await this.cline.handleErrorHelper(this.toolUse, "executing MCP tool", error)
		}
	}
}
