import { ToolCallProviderType } from "../../../shared/api"
import { convertToStandardToolCalls, convertToolCallsToXml } from "./tool-call-response"

/**
 * Converts function call responses to XML format for backward compatibility
 */
export function convertFunctionCallResponseToXml(response: any, providerType: ToolCallProviderType): string | null {
	try {
		// Check if this response contains function calls
		const standardToolCalls = convertToStandardToolCalls(response, providerType)

		if (standardToolCalls.length === 0) {
			return null // No function calls to convert
		}

		// Convert to XML format using the improved XML converter
		return convertToolCallsToXml(standardToolCalls)
	} catch (error) {
		console.error("Error converting function call response to XML:", error)
		return null
	}
}

/**
 * Detects if a response contains function calls
 */
export function hasFunctionCalls(response: any): boolean {
	// OpenAI format
	if (response.choices && response.choices[0]?.message?.tool_calls) {
		return true
	}

	// Anthropic format
	if (response.content && Array.isArray(response.content)) {
		return response.content.some((item: any) => item.type === "tool_use")
	}

	// VS Code LM format
	if (response.toolCalls && Array.isArray(response.toolCalls)) {
		return true
	}

	return false
}

/**
 * Extracts text content from a response, excluding function calls
 */
export function extractTextFromResponse(response: any): string {
	// OpenAI format
	if (response.choices && response.choices[0]?.message?.content) {
		return response.choices[0].message.content
	}

	// Anthropic format
	if (response.content && Array.isArray(response.content)) {
		const textBlocks = response.content.filter((item: any) => item.type === "text")
		return textBlocks.map((block: any) => block.text).join("")
	}

	// VS Code LM format
	if (response.text) {
		return response.text
	}

	return ""
}
