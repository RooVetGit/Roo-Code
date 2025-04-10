import { ClineAskUseMcpServer } from "../../../shared/ExtensionMessage"
import { RemoveClosingTag } from "../types"
import { ToolUse } from "../../assistant-message"
import { AskApproval, HandleError, PushToolResult } from "../types"
import { Cline } from "../../Cline"
import { formatResponse } from "../../prompts/responses"
import { BaseTool } from "../BaseTool"

export class AccessMcpResourceTool extends BaseTool {
	public getName(): string {
		return "access_mcp_resource"
	}

	public async execute(
		cline: Cline,
		block: ToolUse,
		askApproval: AskApproval,
		handleError: HandleError,
		pushToolResult: PushToolResult,
		removeClosingTag: RemoveClosingTag,
	): Promise<void> {
		const server_name: string | undefined = block.params.server_name
		const uri: string | undefined = block.params.uri

		try {
			if (block.partial) {
				const partialMessage = JSON.stringify({
					type: "access_mcp_resource",
					serverName: removeClosingTag("server_name", server_name),
					uri: removeClosingTag("uri", uri),
				} satisfies ClineAskUseMcpServer)
				await cline.ask("use_mcp_server", partialMessage, block.partial).catch(() => {})
				return
			} else {
				if (!server_name) {
					cline.consecutiveMistakeCount++
					pushToolResult(await cline.sayAndCreateMissingParamError("access_mcp_resource", "server_name"))
					return
				}
				if (!uri) {
					cline.consecutiveMistakeCount++
					pushToolResult(await cline.sayAndCreateMissingParamError("access_mcp_resource", "uri"))
					return
				}

				cline.consecutiveMistakeCount = 0
				const completeMessage = JSON.stringify({
					type: "access_mcp_resource",
					serverName: server_name,
					uri,
				} satisfies ClineAskUseMcpServer)

				const didApprove = await askApproval("use_mcp_server", completeMessage)
				if (!didApprove) {
					return
				}

				// now execute the tool
				await cline.say("mcp_server_request_started") // same as browser_action_result
				const resourceResult = await cline.providerRef.deref()?.getMcpHub()?.getResource(server_name, uri)

				if (!resourceResult) {
					await cline.say("mcp_server_response", "Resource not found")
					pushToolResult(formatResponse.toolError(`Resource not found: ${uri}`))
					return
				}

				// TODO: add progress indicator and ability to parse images and non-text responses
				const resourceResultPretty = resourceResult.content
					.map((item) => {
						if (item.type === "text") {
							return item.text
						}
						if (item.type === "resource") {
							const { blob, ...rest } = item.resource
							return JSON.stringify(rest, null, 2)
						}
						return ""
					})
					.filter(Boolean)
					.join("\n\n")

				await cline.say("mcp_server_response", resourceResultPretty)
				pushToolResult(formatResponse.toolResult(resourceResultPretty))
				return
			}
		} catch (error) {
			await handleError("accessing MCP resource", error)
			return
		}
	}
}
