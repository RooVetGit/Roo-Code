import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { ClineAskUseExtTool } from "../../shared/ExtensionMessage"

export async function useExtToolTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const extension_id: string | undefined = block.params.extension_id
	const tool_name: string | undefined = block.params.tool_name
	const tool_arguments: string | undefined = block.params.arguments

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({
				type: "use_ext_tool",
				extensionId: removeClosingTag("extension_id", extension_id),
				toolName: removeClosingTag("tool_name", tool_name),
				arguments: removeClosingTag("arguments", tool_arguments),
			} satisfies ClineAskUseExtTool)

			await cline.ask("use_ext_tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			if (!extension_id) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("use_ext_tool")
				pushToolResult(await cline.sayAndCreateMissingParamError("use_ext_tool", "extension_id"))
				return
			}

			if (!tool_name) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("use_ext_tool")
				pushToolResult(await cline.sayAndCreateMissingParamError("use_ext_tool", "tool_name"))
				return
			}

			let parsedArguments: Record<string, unknown> | undefined

			if (tool_arguments) {
				try {
					parsedArguments = JSON.parse(tool_arguments)
				} catch (error) {
					cline.consecutiveMistakeCount++
					cline.recordToolError("use_ext_tool")
					await cline.say("error", `Roo tried to use ${tool_name} with an invalid JSON argument. Retrying...`)

					pushToolResult(
						formatResponse.toolError(formatResponse.invalidExtToolArgumentError(extension_id, tool_name)),
					)

					return
				}
			}

			cline.consecutiveMistakeCount = 0

			const completeMessage = JSON.stringify({
				type: "use_ext_tool",
				extensionId: extension_id,
				toolName: tool_name,
				arguments: tool_arguments,
			} satisfies ClineAskUseExtTool)

			const didApprove = await askApproval("use_ext_tool", completeMessage)

			if (!didApprove) {
				return
			}

			// Get the extension tool manager from the provider reference
			const extensionToolManager = await cline.providerRef.deref()?.getExtensionToolManagerAsync()

			// Check if the tool exists
			if (!extensionToolManager || !extensionToolManager.isToolRegistered(extension_id, tool_name)) {
				pushToolResult(
					formatResponse.toolError(`Extension tool '${tool_name}' not found for extension '${extension_id}'`),
				)
				return
			}

			// Now execute the tool - important to call say before the actual execution
			await cline.say("extension_tool_request_started")

			const toolResult = await extensionToolManager.executeExtensionTool(extension_id, tool_name, parsedArguments)

			// Format the result
			const toolResultPretty =
				(toolResult?.isError ? "Error:\n" : "") +
					toolResult?.content
						.map((item) => {
							if (item.type === "text") {
								return item.text
							}
							if (item.type === "resource" && "resource" in item) {
								const { blob: _, ...rest } = item.resource
								return JSON.stringify(rest, null, 2)
							}
							return ""
						})
						.filter(Boolean)
						.join("\n\n") || "(No response)"

			await cline.say("extension_tool_response", toolResultPretty)
			pushToolResult(formatResponse.toolResult(toolResultPretty))

			return
		}
	} catch (error) {
		await handleError("executing extension tool", error)
		return
	}
}
