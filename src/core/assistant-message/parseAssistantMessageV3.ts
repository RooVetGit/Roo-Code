const { PartialXMLStreamParser, xmlObjectToString } = require("partial-xml-stream-parser")
import { ToolParamName, toolParamNames } from "../../shared/tools"
import { AssistantMessageContent } from "./parseAssistantMessage"
import { ToolName, toolNames } from "@roo-code/types"

export function parseAssistantMessageV3(assistantMessage: string): AssistantMessageContent[] {
	const textNodeNameKey = "#text"
	const attributeNamePrefixKey = "@"
	const parser = new PartialXMLStreamParser({
		textNodeName: textNodeNameKey,
		attributeNamePrefix: attributeNamePrefixKey,
		alwaysCreateTextNode: true,
		parsePrimitives: false,
		stopNodes: [
			"thinking",
			"execute_command.command",
			"search_files.regex",
			"apply_diff.diff",
			"apply_diff.args.file.diff.content",
			"insert_content.content",
			// Note: write_to_file.content removed to support CDATA sections
			"search_and_replace.search",
			"search_and_replace.replace",
			"attempt_completion.result",
			"ask_followup_question.question",
			"ask_followup_question.follow_up.suggest",
			"codebase_search.query",
			"use_mcp_tool.arguments",
			"new_task.message",
			"browser_action.text",
		],
		allowedRootNodes: ["thinking", ...toolNames],
	})

	const contentBlocks: AssistantMessageContent[] = []
	let isPartial = false

	// Process the message and capture intermediate results
	const parseResult = parser.parseStream(assistantMessage)
	const finalResult = parser.parseStream(null)

	// Use the final result if available, otherwise use the parse result
	const result = finalResult || parseResult
	isPartial = result?.metadata?.partial || false

	// Helper function to extract text content from various value types
	function extractTextContent(value: any): string {
		if (typeof value === "string") {
			// Handle CDATA sections - strip CDATA markers if present
			if (value.startsWith("<![CDATA[") && value.includes("]]>")) {
				// Find the actual end of CDATA content
				const cdataStart = 9 // length of "<![CDATA["
				const cdataEndIndex = value.indexOf("]]>")
				if (cdataEndIndex !== -1) {
					return value.substring(cdataStart, cdataEndIndex)
				}
			}
			return value
		} else if (typeof value === "number" || typeof value === "boolean") {
			return String(value)
		} else if (value === null || value === undefined) {
			return ""
		} else if (typeof value === "object") {
			// Check for #text property first
			if (textNodeNameKey in value) {
				return extractTextContent(value[textNodeNameKey])
			}
			// If it's an array, concatenate all text content
			if (Array.isArray(value)) {
				return value.map((item) => extractTextContent(item)).join("")
			}
			// If it's an object without #text, it might be from a stopNode
			// or contain nested structure - use xmlObjectToString to reconstruct
			return xmlObjectToString(value, {
				attributeNamePrefix: attributeNamePrefixKey,
				textNodeName: textNodeNameKey,
			})
		}
		return ""
	}

	// Helper function to extract parameters from tool data
	function extractToolParams(toolData: any): { [key in ToolParamName]?: string } {
		const params: { [key in ToolParamName]?: string } = {}

		if (typeof toolData === "object" && toolData !== null) {
			// Handle nested args structure (e.g., apply_diff has args.file structure)
			const dataToProcess = toolData.args || toolData

			for (const paramKey in dataToProcess) {
				if (toolParamNames.includes(paramKey as ToolParamName)) {
					params[paramKey as ToolParamName] = extractTextContent(dataToProcess[paramKey])
				} else if (paramKey === "file" && typeof dataToProcess[paramKey] === "object") {
					// Special handling for apply_diff's file structure
					const fileData = dataToProcess[paramKey]
					for (const fileParam in fileData) {
						if (toolParamNames.includes(fileParam as ToolParamName)) {
							params[fileParam as ToolParamName] = extractTextContent(fileData[fileParam])
						}
					}
				}
			}
		}

		return params
	}

	if (result && result.xml) {
		for (const item of result.xml) {
			if (typeof item === "string") {
				// Plain text content
				contentBlocks.push({
					type: "text",
					content: item,
					partial: false,
				})
			} else if (typeof item === "object" && item !== null) {
				// Get the root tag name
				const rootTagName = Object.keys(item)[0]

				if (rootTagName === "thinking") {
					// Handle thinking tags as text content
					const thinkingContent = extractTextContent(item[rootTagName])
					const reconstructed = `<thinking>${thinkingContent}</thinking>`

					// Append to last text block or create new
					const lastBlock = contentBlocks.length > 0 ? contentBlocks[contentBlocks.length - 1] : null
					if (lastBlock && lastBlock.type === "text") {
						lastBlock.content += reconstructed
					} else {
						contentBlocks.push({ type: "text", content: reconstructed, partial: false })
					}
				} else if (toolNames.includes(rootTagName as ToolName)) {
					// This is a tool call
					const toolName = rootTagName as ToolName
					const toolData = item[toolName]
					const params = extractToolParams(toolData)

					contentBlocks.push({
						type: "tool_use",
						name: toolName,
						params: params as { [key in ToolParamName]: string },
						partial: false, // Will be updated later based on context
					})
				} else {
					// Unknown tag, reconstruct using xmlObjectToString
					const reconstructed = xmlObjectToString(item, {
						attributeNamePrefix: attributeNamePrefixKey,
						textNodeName: textNodeNameKey,
					})

					// Append to last text block or create new
					const lastBlock = contentBlocks.length > 0 ? contentBlocks[contentBlocks.length - 1] : null
					if (lastBlock && lastBlock.type === "text") {
						lastBlock.content += reconstructed
					} else {
						contentBlocks.push({ type: "text", content: reconstructed, partial: false })
					}
				}
			}
		}
	}

	// Final pass to trim content and parameter values, and filter out empty text blocks
	const processedBlocks = contentBlocks
		.map((block) => {
			if (block.type === "text") {
				return { ...block, content: block.content.trim() }
			}
			if (block.type === "tool_use") {
				const trimmedParams: { [key in ToolParamName]?: string } = {}
				for (const key in block.params) {
					const value = block.params[key as ToolParamName]
					if (value !== undefined) {
						trimmedParams[key as ToolParamName] = value.trim()
					}
				}
				return { ...block, params: trimmedParams as { [key in ToolParamName]: string } }
			}
			return block
		})
		.filter((block) => {
			if (block.type === "text" && block.content.length === 0) {
				return false // Remove empty text blocks
			}
			return true
		})

	// Update partial status based on parser result and content analysis
	if (processedBlocks.length > 0) {
		const lastBlock = processedBlocks[processedBlocks.length - 1]

		if (isPartial) {
			// If parser indicates partial, mark the last block as partial
			lastBlock.partial = true
		} else if (lastBlock.type === "text") {
			// For text blocks, always mark the last one as partial
			// (matches original parser behavior)
			lastBlock.partial = true
		} else if (lastBlock.type === "tool_use") {
			// Check if the tool tag is properly closed
			const toolClosingTag = `</${lastBlock.name}>`
			const trimmedMessage = assistantMessage.trimEnd()

			// If message doesn't end with closing tag, it's partial
			if (!trimmedMessage.endsWith(toolClosingTag)) {
				lastBlock.partial = true
			} else {
				// Additional check: see if any parameter might be incomplete
				// by checking if the message ends with a parameter closing tag
				const paramTags = Object.keys(lastBlock.params).map((param) => `</${param}>`)
				const endsWithParamTag = paramTags.some((tag) => trimmedMessage.endsWith(tag))

				// If it ends with the tool closing tag but not a param tag,
				// the last param might be incomplete
				if (!endsWithParamTag && Object.keys(lastBlock.params).length > 0) {
					// Check if there's an unclosed parameter tag
					const lastParamKey = Object.keys(lastBlock.params).pop()
					if (lastParamKey) {
						const lastParamOpenTag = `<${lastParamKey}>`
						const lastParamCloseTag = `</${lastParamKey}>`
						const lastOpenIndex = trimmedMessage.lastIndexOf(lastParamOpenTag)
						const lastCloseIndex = trimmedMessage.lastIndexOf(lastParamCloseTag)

						if (lastOpenIndex > lastCloseIndex) {
							lastBlock.partial = true
						}
					}
				}
			}
		}
	}

	return processedBlocks
}
