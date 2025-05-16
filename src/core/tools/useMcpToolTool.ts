import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { ClineAskUseMcpServer } from "../../shared/ExtensionMessage"
import { McpExecutionStatus } from "../../schemas"

export async function useMcpToolTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const server_name: string | undefined = block.params.server_name
	const tool_name: string | undefined = block.params.tool_name
	const mcp_arguments: string | undefined = block.params.arguments
	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({
				type: "use_mcp_tool",
				serverName: removeClosingTag("server_name", server_name),
				toolName: removeClosingTag("tool_name", tool_name),
				arguments: removeClosingTag("arguments", mcp_arguments),
			} satisfies ClineAskUseMcpServer)

			await cline.ask("use_mcp_server", partialMessage, block.partial).catch(() => {})
			return
		} else {
			if (!server_name) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("use_mcp_tool")
				pushToolResult(await cline.sayAndCreateMissingParamError("use_mcp_tool", "server_name"))
				return
			}

			if (!tool_name) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("use_mcp_tool")
				pushToolResult(await cline.sayAndCreateMissingParamError("use_mcp_tool", "tool_name"))
				return
			}

			let parsedArguments: Record<string, unknown> | undefined

			if (mcp_arguments) {
				try {
					parsedArguments = JSON.parse(mcp_arguments)
				} catch (error) {
					cline.consecutiveMistakeCount++
					cline.recordToolError("use_mcp_tool")
					await cline.say("error", `Roo tried to use ${tool_name} with an invalid JSON argument. Retrying...`)

					pushToolResult(
						formatResponse.toolError(formatResponse.invalidMcpToolArgumentError(server_name, tool_name)),
					)

					return
				}
			}

			cline.consecutiveMistakeCount = 0

			const completeMessage = JSON.stringify({
				type: "use_mcp_tool",
				serverName: server_name,
				toolName: tool_name,
				arguments: mcp_arguments,
			} satisfies ClineAskUseMcpServer)

			const executionId = cline.lastMessageTs?.toString() ?? Date.now().toString()
			const didApprove = await askApproval("use_mcp_server", completeMessage)

			if (!didApprove) {
				return
			}

			// Now execute the tool
			await cline.say("mcp_server_request_started") // same as browser_action_result

			// Send started status
			const clineProvider = await cline.providerRef.deref()
			const startedStatus: McpExecutionStatus = {
				executionId,
				status: "started",
				serverName: server_name,
				toolName: tool_name,
			}
			clineProvider?.postMessageToWebview({
				type: "mcpExecutionStatus",
				text: JSON.stringify(startedStatus),
			})

			const toolResult = await cline.providerRef
				.deref()
				?.getMcpHub()
				?.callTool(server_name, tool_name, parsedArguments)

			// Process the result
			let toolResultPretty = "(No response)"

			if (toolResult) {
				// Send output status if there's content
				if (toolResult.content && toolResult.content.length > 0) {
					const outputText = toolResult.content
						.map((item) => {
							if (item.type === "text") {
								return item.text
							}
							if (item.type === "resource") {
								const { blob: _, ...rest } = item.resource
								return JSON.stringify(rest, null, 2)
							}
							return ""
						})
						.filter(Boolean)
						.join("\n\n")

					if (outputText) {
						const outputStatus: McpExecutionStatus = {
							executionId,
							status: "output",
							response: outputText,
						}
						clineProvider?.postMessageToWebview({
							type: "mcpExecutionStatus",
							text: JSON.stringify(outputStatus),
						})

						toolResultPretty = (toolResult.isError ? "Error:\n" : "") + outputText
					}
				}

				// Send completed or error status
				const completedStatus: McpExecutionStatus = {
					executionId,
					status: toolResult.isError ? "error" : "completed",
					response: toolResultPretty,
					error: toolResult.isError ? "Error executing MCP tool" : undefined,
				}
				clineProvider?.postMessageToWebview({
					type: "mcpExecutionStatus",
					text: JSON.stringify(completedStatus),
				})
			} else {
				// Send error status if no result
				const errorStatus: McpExecutionStatus = {
					executionId,
					status: "error",
					error: "No response from MCP server",
				}
				clineProvider?.postMessageToWebview({
					type: "mcpExecutionStatus",
					text: JSON.stringify(errorStatus),
				})

				toolResultPretty = "(No response)"
			}

			await cline.say("mcp_server_response", toolResultPretty)
			pushToolResult(formatResponse.toolResult(toolResultPretty))

			return
		}
	} catch (error) {
		await handleError("executing MCP tool", error)
		return
	}
}
