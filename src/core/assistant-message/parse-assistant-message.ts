import { TextContent, ToolUse, ToolParamName, toolParamNames } from "../../shared/tools"
import { toolNames, ToolName, logLevels } from "../../schemas"
import { LogDirective } from "./directives/log-directive"

export type AssistantMessageContent = TextContent | ToolUse | LogDirective

//TODO: If we have agreement on the new type names
// Rename TextContent to DisplayDirective
// Rename ToolUse to ToolDirective
// export type Directive = DisplayDirective | ToolDirective | LogDirective

/**
 * Parses a tool parameter within a tool use
 */
function parseToolParam(
	currentToolUse: ToolUse,
	currentParamName: ToolParamName,
	currentParamValueStartIndex: number,
	accumulator: string,
): { completed: boolean; toolUse: ToolUse } {
	const currentParamValue = accumulator.slice(currentParamValueStartIndex)
	const paramClosingTag = `</${currentParamName}>`

	if (currentParamValue.endsWith(paramClosingTag)) {
		// End of param value
		currentToolUse.params[currentParamName] = currentParamValue.slice(0, -paramClosingTag.length).trim()
		return { completed: true, toolUse: currentToolUse }
	} else {
		// Partial param value is accumulating
		return { completed: false, toolUse: currentToolUse }
	}
}

/**
 * Handles the special case for write_to_file content parameter
 */
function handleWriteToFileContent(
	currentToolUse: ToolUse,
	currentToolUseStartIndex: number,
	accumulator: string,
): ToolUse {
	const contentParamName: ToolParamName = "content"
	if (currentToolUse.name === "write_to_file" && accumulator.endsWith(`</${contentParamName}>`)) {
		const toolContent = accumulator.slice(currentToolUseStartIndex)
		const contentStartTag = `<${contentParamName}>`
		const contentEndTag = `</${contentParamName}>`
		const contentStartIndex = toolContent.indexOf(contentStartTag) + contentStartTag.length
		const contentEndIndex = toolContent.lastIndexOf(contentEndTag)

		if (contentStartIndex !== -1 && contentEndIndex !== -1 && contentEndIndex > contentStartIndex) {
			currentToolUse.params[contentParamName] = toolContent.slice(contentStartIndex, contentEndIndex).trim()
		}
	}
	return currentToolUse
}

/**
 * Processes a tool use and checks if it's complete
 */
function processToolUse(
	currentToolUse: ToolUse,
	currentToolUseStartIndex: number,
	accumulator: string,
): {
	completed: boolean
	toolUse: ToolUse
	newParamName?: ToolParamName
	newParamValueStartIndex?: number
} {
	const currentToolValue = accumulator.slice(currentToolUseStartIndex)
	const toolUseClosingTag = `</${currentToolUse.name}>`

	if (currentToolValue.endsWith(toolUseClosingTag)) {
		// End of a tool use
		currentToolUse.partial = false
		return { completed: true, toolUse: currentToolUse }
	} else {
		// Check for parameter opening tags
		const possibleParamOpeningTags = toolParamNames.map((name) => `<${name}>`)
		for (const paramOpeningTag of possibleParamOpeningTags) {
			if (accumulator.endsWith(paramOpeningTag)) {
				// Start of a new parameter
				const newParamName = paramOpeningTag.slice(1, -1) as ToolParamName
				return {
					completed: false,
					toolUse: currentToolUse,
					newParamName,
					newParamValueStartIndex: accumulator.length,
				}
			}
		}

		// Handle special case for write_to_file content
		currentToolUse = handleWriteToFileContent(currentToolUse, currentToolUseStartIndex, accumulator)

		// Partial tool value is accumulating
		return { completed: false, toolUse: currentToolUse }
	}
}

/**
 * Processes a log entry and checks if it's complete
 */
function processLogEntry(
	currentLogEntry: LogDirective,
	currentLogEntryStartIndex: number,
	accumulator: string,
): { completed: boolean; logEntry: LogDirective } {
	const currentLogValue = accumulator.slice(currentLogEntryStartIndex)
	const logEntryClosingTag = `</log_message>`

	if (currentLogValue.endsWith(logEntryClosingTag)) {
		// End of a log entry
		currentLogEntry.partial = false

		// Parse the log entry content to extract message and level
		const messageMatch = /<message>(.*?)<\/message>/s.exec(currentLogValue)
		const levelMatch = /<level>(.*?)<\/level>/s.exec(currentLogValue)

		if (messageMatch) {
			currentLogEntry.message = messageMatch[1].trim()
		}

		if (levelMatch && logLevels.includes(levelMatch[1].trim() as any)) {
			currentLogEntry.level = levelMatch[1].trim() as (typeof logLevels)[number]
		}

		return { completed: true, logEntry: currentLogEntry }
	} else {
		// Partial log entry is accumulating
		return { completed: false, logEntry: currentLogEntry }
	}
}

/**
 * Creates a new text content object
 */
function createTextContent(startIndex: number, accumulator: string): TextContent {
	return {
		type: "text",
		content: accumulator.slice(startIndex).trim(),
		partial: true,
	}
}

/**
 * Detects the start of a new log entry
 */
function detectLogEntryStart(
	accumulator: string,
	currentTextContent: TextContent | undefined,
): {
	isLogEntry: boolean
	logEntry?: LogDirective
	updatedTextContent?: TextContent
	shouldPushTextContent: boolean
} {
	const logEntryOpeningTag = `<log_message>`
	if (accumulator.endsWith(logEntryOpeningTag)) {
		// Start of a new log entry
		const logEntry = {
			type: "log_message",
			message: "",
			level: "info", // Default level
			partial: true,
		} as LogDirective

		let updatedTextContent = currentTextContent
		let shouldPushTextContent = false

		// This also indicates the end of the current text content
		if (currentTextContent) {
			updatedTextContent = { ...currentTextContent, partial: false }
			// Remove the partially accumulated log entry tag from the end of text
			updatedTextContent.content = updatedTextContent.content
				.slice(0, -logEntryOpeningTag.slice(0, -1).length)
				.trim()
			shouldPushTextContent = true
		}

		return {
			isLogEntry: true,
			logEntry,
			updatedTextContent,
			shouldPushTextContent,
		}
	}

	return { isLogEntry: false, shouldPushTextContent: false }
}

/**
 * Detects the start of a new tool use
 */
function detectToolUseStart(
	accumulator: string,
	currentTextContent: TextContent | undefined,
): {
	isToolUse: boolean
	toolUse?: ToolUse
	toolName?: ToolName
	updatedTextContent?: TextContent
	shouldPushTextContent: boolean
} {
	const possibleToolUseOpeningTags = toolNames.map((name) => `<${name}>`)

	for (const toolUseOpeningTag of possibleToolUseOpeningTags) {
		if (accumulator.endsWith(toolUseOpeningTag)) {
			// Start of a new tool use
			const toolName = toolUseOpeningTag.slice(1, -1) as ToolName
			const toolUse = {
				type: "tool_use",
				name: toolName,
				params: {},
				partial: true,
			} as ToolUse

			let updatedTextContent = currentTextContent
			let shouldPushTextContent = false

			// This also indicates the end of the current text content
			if (currentTextContent) {
				updatedTextContent = { ...currentTextContent, partial: false }
				// Remove the partially accumulated tool use tag from the end of text
				updatedTextContent.content = updatedTextContent.content
					.slice(0, -toolUseOpeningTag.slice(0, -1).length)
					.trim()
				shouldPushTextContent = true
			}

			return {
				isToolUse: true,
				toolUse,
				toolName,
				updatedTextContent,
				shouldPushTextContent,
			}
		}
	}

	return { isToolUse: false, shouldPushTextContent: false }
}

/**
 * Finalizes any partial content at the end of parsing
 */
function finalizePartialContent(
	contentBlocks: AssistantMessageContent[],
	currentToolUse: ToolUse | undefined,
	currentParamName: ToolParamName | undefined,
	currentParamValueStartIndex: number,
	currentLogEntry: LogDirective | undefined,
	currentLogEntryStartIndex: number,
	currentTextContent: TextContent | undefined,
	accumulator: string,
): AssistantMessageContent[] {
	if (currentToolUse) {
		// Stream did not complete tool call, add it as partial
		if (currentParamName) {
			// Tool call has a parameter that was not completed
			currentToolUse.params[currentParamName] = accumulator.slice(currentParamValueStartIndex).trim()
		}
		contentBlocks.push(currentToolUse)
	} else if (currentLogEntry) {
		// Stream did not complete log entry, add it as partial
		// Try to extract any partial message or level information
		const partialContent = accumulator.slice(currentLogEntryStartIndex)
		const messageMatch = /<message>(.*?)(?:<\/message>)?$/s.exec(partialContent)
		const levelMatch = /<level>(.*?)(?:<\/level>)?$/s.exec(partialContent)

		if (messageMatch) {
			currentLogEntry.message = messageMatch[1].trim()
		}

		if (levelMatch && logLevels.includes(levelMatch[1].trim() as any)) {
			currentLogEntry.level = levelMatch[1].trim() as (typeof logLevels)[number]
		}

		contentBlocks.push(currentLogEntry)
	} else if (currentTextContent) {
		// Stream did not complete text content, add it as partial
		contentBlocks.push(currentTextContent)
	}

	return contentBlocks
}

/**
 * Parses an assistant message into content blocks
 * @param assistantMessage The message to parse0
 * @returns Array of content blocks (text, tool use, log entry)
 */
export function parseAssistantMessage(assistantMessage: string) {
	let contentBlocks: AssistantMessageContent[] = []
	let currentTextContent: TextContent | undefined = undefined
	let currentTextContentStartIndex = 0
	let currentToolUse: ToolUse | undefined = undefined
	let currentToolUseStartIndex = 0
	let currentLogEntry: LogDirective | undefined = undefined
	let currentLogEntryStartIndex = 0
	let currentParamName: ToolParamName | undefined = undefined
	let currentParamValueStartIndex = 0
	let accumulator = ""
	let insideCodeBlock = false // Track if we're inside a code block (triple backticks)

	for (let i = 0; i < assistantMessage.length; i++) {
		const char = assistantMessage[i]
		accumulator += char

		// Check for code block markers (triple backticks)
		if (accumulator.endsWith("```")) {
			insideCodeBlock = !insideCodeBlock // Toggle the code block state
			continue
		}

		// Skip tag detection when inside a code block
		if (insideCodeBlock) {
			continue
		}

		// Handle tool parameter parsing
		if (currentToolUse && currentParamName) {
			const result = parseToolParam(currentToolUse, currentParamName, currentParamValueStartIndex, accumulator)

			currentToolUse = result.toolUse

			if (result.completed) {
				currentParamName = undefined
			}
			continue
		}

		// Handle tool use parsing
		if (currentToolUse) {
			const result = processToolUse(currentToolUse, currentToolUseStartIndex, accumulator)

			if (result.completed) {
				currentToolUse = result.toolUse
				contentBlocks.push(currentToolUse)
				currentToolUse = undefined
			} else {
				currentToolUse = result.toolUse
				if (result.newParamName) {
					currentParamName = result.newParamName
					currentParamValueStartIndex = result.newParamValueStartIndex!
				}
			}
			continue
		}

		// Handle log entry parsing
		if (currentLogEntry) {
			const result = processLogEntry(currentLogEntry, currentLogEntryStartIndex, accumulator)

			currentLogEntry = result.logEntry

			if (result.completed) {
				contentBlocks.push(currentLogEntry)
				currentLogEntry = undefined
			}
			continue
		}

		// Detect log entry start
		const logEntryResult = detectLogEntryStart(accumulator, currentTextContent)
		if (logEntryResult.isLogEntry) {
			currentLogEntry = logEntryResult.logEntry
			currentLogEntryStartIndex = accumulator.length

			if (logEntryResult.shouldPushTextContent && logEntryResult.updatedTextContent) {
				currentTextContent = logEntryResult.updatedTextContent
				contentBlocks.push(currentTextContent)
				currentTextContent = undefined
			}
			continue
		}

		// Detect tool use start
		const toolUseResult = detectToolUseStart(accumulator, currentTextContent)
		if (toolUseResult.isToolUse) {
			currentToolUse = toolUseResult.toolUse
			currentToolUseStartIndex = accumulator.length

			if (toolUseResult.shouldPushTextContent && toolUseResult.updatedTextContent) {
				currentTextContent = toolUseResult.updatedTextContent
				contentBlocks.push(currentTextContent)
				currentTextContent = undefined
			}
			continue
		}

		// Handle text content
		if (currentTextContent === undefined) {
			currentTextContentStartIndex = i
		}
		currentTextContent = createTextContent(currentTextContentStartIndex, accumulator)
	}

	// Finalize any partial content
	return finalizePartialContent(
		contentBlocks,
		currentToolUse,
		currentParamName,
		currentParamValueStartIndex,
		currentLogEntry,
		currentLogEntryStartIndex,
		currentTextContent,
		accumulator,
	)
}
