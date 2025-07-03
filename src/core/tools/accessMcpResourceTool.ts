import { ClineAskUseMcpServer } from "../../shared/ExtensionMessage"
import { ToolUse, RemoveClosingTag, AskApproval, HandleError, PushToolResult } from "../../shared/tools"
import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { validateToolUse } from "./validateToolUse"
import { defaultModeSlug } from "../../shared/modes"

export async function accessMcpResourceTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
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
				cline.recordToolError("access_mcp_resource")
				pushToolResult(await cline.sayAndCreateMissingParamError("access_mcp_resource", "server_name"))
				return
			}

			if (!uri) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("access_mcp_resource")
				pushToolResult(await cline.sayAndCreateMissingParamError("access_mcp_resource", "uri"))
				return
			}

			try {
				const provider = await cline.providerRef.deref()
				const { mode: currentMode, customModes } = (await provider?.getState()) ?? {}

				// Get server configuration to check allowedInModesByDefault setting
				const mcpHub = provider?.getMcpHub()
				const serverConfig = mcpHub?.getServerConfig(server_name)
				const allowedInModesByDefault = serverConfig?.allowedInModesByDefault ?? true // Default to true if not specified

				validateToolUse(
					"access_mcp_resource",
					currentMode ?? defaultModeSlug, // Use proper fallback
					customModes ?? [],
					undefined,
					undefined,
					{ serverName: server_name, toolName: undefined, allowedInModesByDefault }, // No specific tool for resource access
				)
			} catch (error) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("access_mcp_resource")

				await cline.say("error", `Mode restriction: ${error instanceof Error ? error.message : String(error)}`)
				pushToolResult(
					formatResponse.toolError(
						`Mode restriction: ${error instanceof Error ? error.message : String(error)}`,
					),
				)
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

			// Now execute the tool
			await cline.say("mcp_server_request_started")
			const resourceResult = await cline.providerRef.deref()?.getMcpHub()?.readResource(server_name, uri)

			const resourceResultPretty =
				resourceResult?.contents
					.map((item) => {
						if (item.text) {
							return item.text
						}
						return ""
					})
					.filter(Boolean)
					.join("\n\n") || "(Empty response)"

			// Handle images (image must contain mimetype and blob)
			let images: string[] = []

			resourceResult?.contents.forEach((item) => {
				if (item.mimeType?.startsWith("image") && item.blob) {
					images.push(item.blob)
				}
			})

			await cline.say("mcp_server_response", resourceResultPretty, images)
			pushToolResult(formatResponse.toolResult(resourceResultPretty, images))

			return
		}
	} catch (error) {
		await handleError("accessing MCP resource", error)
		return
	}
}
