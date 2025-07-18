import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { ClineAskUseMcpServer } from "../../shared/ExtensionMessage"
import { McpExecutionStatus } from "@roo-code/types"
import { t } from "../../i18n"

const SUPPORTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"]

interface McpToolParams {
	server_name?: string
	tool_name?: string
	arguments?: string
}

type ValidationResult =
	| { isValid: false }
	| {
			isValid: true
			serverName: string
			toolName: string
			parsedArguments?: Record<string, unknown>
	  }

async function handlePartialRequest(
	cline: Task,
	params: McpToolParams,
	removeClosingTag: RemoveClosingTag,
): Promise<void> {
	const partialMessage = JSON.stringify({
		type: "use_mcp_tool",
		serverName: removeClosingTag("server_name", params.server_name),
		toolName: removeClosingTag("tool_name", params.tool_name),
		arguments: removeClosingTag("arguments", params.arguments),
	} satisfies ClineAskUseMcpServer)

	await cline.ask("use_mcp_server", partialMessage, true).catch(() => {})
}

async function validateParams(
	cline: Task,
	params: McpToolParams,
	pushToolResult: PushToolResult,
): Promise<ValidationResult> {
	if (!params.server_name) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("use_mcp_tool")
		pushToolResult(await cline.sayAndCreateMissingParamError("use_mcp_tool", "server_name"))
		return { isValid: false }
	}

	if (!params.tool_name) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("use_mcp_tool")
		pushToolResult(await cline.sayAndCreateMissingParamError("use_mcp_tool", "tool_name"))
		return { isValid: false }
	}

	let parsedArguments: Record<string, unknown> | undefined

	if (params.arguments) {
		try {
			parsedArguments = JSON.parse(params.arguments)
		} catch (error) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("use_mcp_tool")
			await cline.say("error", t("mcp:errors.invalidJsonArgument", { toolName: params.tool_name }))

			pushToolResult(
				formatResponse.toolError(
					formatResponse.invalidMcpToolArgumentError(params.server_name, params.tool_name),
				),
			)
			return { isValid: false }
		}
	}

	return {
		isValid: true,
		serverName: params.server_name,
		toolName: params.tool_name,
		parsedArguments,
	}
}

async function sendExecutionStatus(cline: Task, status: McpExecutionStatus): Promise<void> {
	const clineProvider = await cline.providerRef.deref()
	clineProvider?.postMessageToWebview({
		type: "mcpExecutionStatus",
		text: JSON.stringify(status),
	})
}

/**
 * Calculate the approximate size of a base64 encoded image in MB
 */
function calculateImageSizeMB(base64Data: string): number {
	// Base64 encoding increases size by ~33%, so actual bytes = base64Length * 0.75
	const sizeInBytes = base64Data.length * 0.75
	return sizeInBytes / (1024 * 1024) // Convert to MB
}

async function processToolContent(toolResult: any, cline: Task): Promise<{ text: string; images: string[] }> {
	if (!toolResult?.content || toolResult.content.length === 0) {
		return { text: "", images: [] }
	}

	const textParts: string[] = []
	const images: string[] = []

	// Get MCP settings from the extension's global state
	const state = await cline.providerRef.deref()?.getState()
	const maxImagesPerResponse = state?.mcpMaxImagesPerResponse ?? 20
	const maxImageSizeMB = state?.mcpMaxImageSizeMB ?? 10

	toolResult.content.forEach((item: any) => {
		if (item.type === "text") {
			textParts.push(item.text)
		} else if (item.type === "image") {
			// Check if we've exceeded the maximum number of images
			if (images.length >= maxImagesPerResponse) {
				console.warn(
					`MCP response contains more than ${maxImagesPerResponse} images. Additional images will be ignored to prevent performance issues.`,
				)
				return // Skip processing additional images
			}

			if (item.mimeType && item.data !== undefined && item.data !== null) {
				if (SUPPORTED_IMAGE_TYPES.includes(item.mimeType)) {
					try {
						// Validate base64 data before constructing data URL
						if (typeof item.data !== "string" || item.data.trim() === "") {
							console.warn("Invalid MCP ImageContent: base64 data is not a valid string")
							return
						}

						// Basic validation for base64 format
						const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/
						if (!base64Regex.test(item.data.replace(/\s/g, ""))) {
							console.warn("Invalid MCP ImageContent: base64 data contains invalid characters")
							return
						}

						// Check image size
						const imageSizeMB = calculateImageSizeMB(item.data)
						if (imageSizeMB > maxImageSizeMB) {
							console.warn(
								`MCP image exceeds size limit: ${imageSizeMB.toFixed(2)}MB > ${maxImageSizeMB}MB. Image will be ignored.`,
							)
							return
						}

						const dataUrl = `data:${item.mimeType};base64,${item.data}`
						images.push(dataUrl)
					} catch (error) {
						console.warn("Failed to process MCP image content:", error)
						// Continue processing other content instead of failing entirely
					}
				} else {
					console.warn(`Unsupported image MIME type: ${item.mimeType}`)
				}
			} else {
				console.warn("Invalid MCP ImageContent: missing data or mimeType")
			}
		} else if (item.type === "resource") {
			const { blob: _, ...rest } = item.resource
			textParts.push(JSON.stringify(rest, null, 2))
		}
	})

	return {
		text: textParts.filter(Boolean).join("\n\n"),
		images,
	}
}

async function executeToolAndProcessResult(
	cline: Task,
	serverName: string,
	toolName: string,
	parsedArguments: Record<string, unknown> | undefined,
	executionId: string,
	pushToolResult: PushToolResult,
): Promise<void> {
	await cline.say("mcp_server_request_started")

	// Send started status
	await sendExecutionStatus(cline, {
		executionId,
		status: "started",
		serverName,
		toolName,
	})

	const toolResult = await cline.providerRef.deref()?.getMcpHub()?.callTool(serverName, toolName, parsedArguments)

	let toolResultPretty = "(No response)"
	let images: string[] = []

	if (toolResult) {
		const { text: outputText, images: outputImages } = await processToolContent(toolResult, cline)
		images = outputImages

		if (outputText || images.length > 0) {
			await sendExecutionStatus(cline, {
				executionId,
				status: "output",
				response: outputText,
			})

			toolResultPretty = (toolResult.isError ? "Error:\n" : "") + outputText
		}

		// Send completion status
		await sendExecutionStatus(cline, {
			executionId,
			status: toolResult.isError ? "error" : "completed",
			response: toolResultPretty,
			error: toolResult.isError ? "Error executing MCP tool" : undefined,
		})
	} else {
		// Send error status if no result
		await sendExecutionStatus(cline, {
			executionId,
			status: "error",
			error: "No response from MCP server",
		})
	}

	await cline.say("mcp_server_response", toolResultPretty, images)
	pushToolResult(formatResponse.toolResult(toolResultPretty, images))
}

export async function useMcpToolTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	try {
		const params: McpToolParams = {
			server_name: block.params.server_name,
			tool_name: block.params.tool_name,
			arguments: block.params.arguments,
		}

		// Handle partial requests
		if (block.partial) {
			await handlePartialRequest(cline, params, removeClosingTag)
			return
		}

		// Validate parameters
		const validation = await validateParams(cline, params, pushToolResult)
		if (!validation.isValid) {
			return
		}

		const { serverName, toolName, parsedArguments } = validation

		// Reset mistake count on successful validation
		cline.consecutiveMistakeCount = 0

		// Get user approval
		const completeMessage = JSON.stringify({
			type: "use_mcp_tool",
			serverName,
			toolName,
			arguments: params.arguments,
		} satisfies ClineAskUseMcpServer)

		const executionId = cline.lastMessageTs?.toString() ?? Date.now().toString()
		const didApprove = await askApproval("use_mcp_server", completeMessage)

		if (!didApprove) {
			return
		}

		// Execute the tool and process results
		await executeToolAndProcessResult(cline, serverName!, toolName!, parsedArguments, executionId, pushToolResult)
	} catch (error) {
		await handleError("executing MCP tool", error)
	}
}
