/**
 * Standard tool call response object for cross-provider compatibility
 */
export interface StandardToolCall {
	id: string
	name: string
	arguments: Record<string, any>
}

export interface StandardToolCallResponse {
	toolCalls: StandardToolCall[]
}

function isJson(str: string) {
	if (typeof str !== "string") {
		return false
	}
	str = str.trim()
	if (!str.startsWith("{") || !str.endsWith("}")) {
		return false
	}
	const stack = []
	for (let i = 0; i < str.length; i++) {
		const char = str[i]
		if (char === "{" || char === "[") {
			stack.push(char)
		} else if (char === "}" || char === "]") {
			if (stack.length === 0) {
				return false
			}
			const last = stack.pop()
			if ((char === "}" && last !== "{") || (char === "]" && last !== "[")) {
				return false
			}
		}
	}
	return stack.length === 0
}

/**
 * Converts OpenAI function call format to standard format
 */
export function convertOpenAIToolCalls(toolCalls: any[]): StandardToolCall[] {
	const result: StandardToolCall[] = []
	for (const toolCall of toolCalls) {
		let args = toolCall.function.arguments
		if (typeof args === "string") {
			if (isJson(args)) {
				args = JSON.parse(args)
			} else {
				continue
			}
		}
		result.push({
			id: toolCall.id,
			name: toolCall.function.name,
			arguments: args,
		})
	}
	return result
}

/**
 * Converts Anthropic tool use format to standard format
 */
export function convertAnthropicToolCalls(toolUses: any[]): StandardToolCall[] {
	return toolUses.map((toolUse, index) => ({
		id: toolUse.id || `tool_${index}`,
		name: toolUse.name,
		arguments: toolUse.input || {},
	}))
}

/**
 * Converts VS Code LM tool call format to standard format
 */
export function convertVsCodeLmToolCalls(toolCalls: any[]): StandardToolCall[] {
	return toolCalls.map((toolCall, index) => ({
		id: toolCall.id || `tool_${index}`,
		name: toolCall.name,
		arguments: toolCall.parameters || {},
	}))
}

/**
 * Converts apply_diff arguments to proper XML format
 */
function convertApplyDiffToXml(files: any[]): string {
	const nodes = []
	for (const file of files) {
		let xml = `<file>\n`
		xml += `<path>${file.path}</path>\n`

		const diffs = Array.isArray(file.diff) ? file.diff : [file.diff]
		for (const diff of diffs) {
			xml += `<diff>\n`
			if (
				diff.search_str === undefined ||
				diff.replace_str === undefined ||
				diff.search_str === diff.replace_str
			) {
				continue
			}
			if (diff.start_line === undefined) {
				continue
			}
			const content = `<<<<<<< SEARCH\n${diff.search_str}\n=======\n${diff.replace_str}\n>>>>>>> REPLACE`
			xml += `<content>\n${content}\n</content>\n`
			xml += `<start_line>${diff.start_line}</start_line>\n`
			xml += `</diff>\n`
		}

		xml += `</file>`
		nodes.push(xml)
	}

	return nodes.join("\n")
}

/**
 * Converts standard tool calls back to XML format for backward compatibility
 */
export function convertToolCallsToXml(toolCalls: StandardToolCall[]): string {
	let xmlContent = ""

	for (const toolCall of toolCalls) {
		xmlContent += `<${toolCall.name}>\n`

		// Handle apply_diff specially for proper nested XML structure
		// if (toolCall.name === "apply_diff" && toolCall.arguments.file) {
		// 	xmlContent += `<args>\n`
		// 	xmlContent += convertApplyDiffToXml(toolCall.arguments.file)
		// 	xmlContent += `</args>\n`
		// } else
		// if (toolCall.name === "read_file" && toolCall.arguments.file) {
		// 	xmlContent += `<args>\n`
		// 	for (const fileItem of toolCall.arguments.file) {
		// 		xmlContent += `<file>${convertArgumentsToXml(fileItem)}</file>\n`
		// 	}
		// 	xmlContent += `</args>\n`
		// } else {
		// }

		// Convert arguments to XML parameters for other tools
		xmlContent += convertArgumentsToXml(toolCall.arguments, 0)
		xmlContent += `</${toolCall.name}>\n\n`
	}

	return xmlContent.trim()
}

/**
 * Converts tool arguments to XML format with proper nesting
 */
function convertArgumentsToXml(args: Record<string, any>, indentLevel: number = 0): string {
	let xml = ""
	const indent = indentLevel > 0 ? "  ".repeat(indentLevel) : ""

	for (const [key, value] of Object.entries(args)) {
		if (value === null || value === undefined) {
			continue
		}

		if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
			xml += `${indent}<${key}>${value}</${key}>\n`
		} else if (Array.isArray(value)) {
			if (value.length === 0) {
				xml += `${indent}<${key}></${key}>\n`
			} else {
				for (const item of value) {
					xml += `${indent}<${key}>`
					if (typeof item === "object" && item !== null) {
						xml += `\n`
						xml += convertArgumentsToXml(item, indentLevel + 2)
					} else {
						xml += `${item}`
					}
					xml += `${indent}</${key}>\n`
				}
			}
		} else if (typeof value === "object") {
			xml += `${indent}<${key}>\n`
			xml += convertArgumentsToXml(value, indentLevel + 1)
			xml += `${indent}</${key}>\n`
		}
	}

	return xml
}

/**
 * Detects the provider type from tool call format
 */
export function detectProviderType(response: any): "openai" | "anthropic" | "vscode-lm" | "unknown" {
	if (response.choices && response.choices[0]?.message?.tool_calls) {
		return "openai"
	}

	if (response.content && Array.isArray(response.content)) {
		const hasToolUse = response.content.some((item: any) => item.type === "tool_use")
		if (hasToolUse) {
			return "anthropic"
		}
	}

	if (response.toolCalls && Array.isArray(response.toolCalls)) {
		return "vscode-lm"
	}

	return "unknown"
}

/**
 * Converts any provider's tool call response to standard format
 */
export function convertToStandardToolCalls(response: any, providerType: string): StandardToolCall[] {
	switch (providerType) {
		case "openai":
			return convertOpenAIToolCalls(response.choices[0].message.tool_calls)

		case "anthropic":
			throw new Error("Anthropic tool calls are not supported yet")

		case "vscode-lm":
			throw new Error("VS Code LM tool calls are not supported yet")

		default:
			return []
	}
}
