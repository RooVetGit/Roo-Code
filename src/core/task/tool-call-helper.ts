/**
 * @fileoverview
 * This file contains the implementation of a streaming JSON to XML converter
 * for handling tool calls from AI models. It uses a state machine and stacks
 * to process incoming JSON chunks incrementally and generate corresponding XML representations.
 */

import Anthropic from "@anthropic-ai/sdk"
import { ToolCallProviderType } from "../../shared/tools"

/**
 * Defines the possible states of the JSON parser.
 */
enum ParserState {
	EXPECT_ROOT, // Expecting root object or array
	EXPECT_VALUE,
	EXPECT_KEY,
	EXPECT_COLON,
	EXPECT_COMMA_OR_CLOSING,
}

export interface ToolCallParam {
	providerType: ToolCallProviderType
	toolName: string
	toolUserId: string
	chunkContent: string
	anthropicContent?: Anthropic.ToolUseBlockParam
	originContent: any[]
}

/**
 * Represents the processing state for a single tool call.
 * It tracks the parsing progress, state, and structural information.
 */
class ToolCallProcessingState {
	functionNameOutputted = false
	functionClosed = false

	// The full arguments string accumulated so far.
	arguments = ""
	// The index of the next character to process in the arguments string.
	cursor = 0

	// The current state of the parser FSM (Finite State Machine).
	parserState = ParserState.EXPECT_ROOT

	// Flags for handling string parsing.
	inString = false
	isEscaped = false
	isStreamingStringValue = false

	// Stack to keep track of JSON objects ({) and arrays ([).
	bracketStack: ("{" | "[")[] = []
	// Stack to keep track of XML tags for generating closing tags correctly.
	xmlTagStack: string[] = []
	// Buffer for the current string literal (key or value) being parsed.
	currentString = ""
	// Buffer for accumulating primitive values across chunks
	primitiveBuffer = ""
	// Flag to track if we're at the start of an array to prevent duplicate tags.
	justOpenedArray = false
}

/**
 * A streaming processor that converts tool call JSON chunks into XML format in real-time.
 */
export class StreamingToolCallProcessor {
	private accumulatedToolCalls: any[] = []
	private processingStates: Map<number, ToolCallProcessingState> = new Map()

	/**
	 * Processes a new chunk of tool call data and returns the resulting XML segment.
	 * @param chunk - The tool call chunk, typically from a streaming API.
	 * @returns A string containing the newly generated XML.
	 */
	public processChunk(chunk: any, providerType: ToolCallProviderType = "openai"): string {
		switch (providerType) {
			case "openai":
				return this.processChunkOpenAIFormat(chunk).chunkContent
			default:
				throw new Error(`Unsupported provider type: ${providerType}`)
		}
	}

	/**
	 * Processes a new chunk of tool call data and returns the resulting XML segment.
	 * @param chunk - The tool call chunk, typically from a streaming API.
	 * @returns A string containing the newly generated XML.
	 */
	public processChunkTool(chunk: any, providerType: ToolCallProviderType = "openai"): ToolCallParam {
		switch (providerType) {
			case "openai":
				return this.processChunkOpenAIFormat(chunk)
			default:
				throw new Error(`Unsupported provider type: ${providerType}`)
		}
	}

	/**
	 * Processes a new chunk of tool call data for the OpenAI provider.
	 * @param chunk - The tool call chunk to process.
	 * @returns A string containing the resulting XML segment.
	 */
	private processChunkOpenAIFormat(chunk: any): ToolCallParam {
		let xmlOutput = ""
		let index = 0
		for (const delta of chunk) {
			index = delta.index || 0

			// Initialize state for a new tool call.
			if (!this.accumulatedToolCalls[index]) {
				this.accumulatedToolCalls[index] = {
					id: delta.id || "",
					type: "function",
					function: { name: "", arguments: "" },
				}
				this.processingStates.set(index, new ToolCallProcessingState())
			}

			const toolCall = this.accumulatedToolCalls[index]
			const state = this.processingStates.get(index)!

			// Accumulate function name and arguments.
			if (delta.function?.name) {
				toolCall.function.name += delta.function.name
			}
			if (delta.function?.arguments) {
				toolCall.function.arguments += delta.function.arguments
			}

			// Output the opening function tag once the name is known.
			if (toolCall.function.name && !state.functionNameOutputted) {
				xmlOutput += `<${toolCall.function.name}>`
				state.functionNameOutputted = true
			}

			// Process the new arguments chunk.
			if (toolCall.function.arguments.length > state.arguments.length) {
				state.arguments = toolCall.function.arguments
				xmlOutput += this.processArguments(state, toolCall.function.name)
			}

			// Check if the JSON is complete and close the function tag.
			if (!state.functionClosed && state.bracketStack.length === 0 && state.cursor > 0) {
				// A simple check to see if we've reached a terminal state.
				// A more robust check might be necessary for edge cases.
				const remaining = state.arguments.substring(state.cursor).trim()
				if (remaining === "") {
					xmlOutput += `</${toolCall.function.name}>\n\n`
					state.functionClosed = true
				}
			}
		}
		// the index of GPT-5 tool_call not start by 0
		const toolCall = this.accumulatedToolCalls[index]
		const result: ToolCallParam = {
			providerType: "openai",
			toolName: toolCall?.function?.name,
			toolUserId: toolCall.id || undefined,
			chunkContent: xmlOutput,
			originContent: this.accumulatedToolCalls,
		}

		if (this.processingStates.get(index)?.functionClosed) {
			let input
			try {
				input = JSON.parse(toolCall.function.arguments)
			} catch (e) {
				input = ""
			}
			result.anthropicContent = {
				id: result.toolUserId,
				name: result.toolName,
				input: input,
				type: "tool_use",
			}
		}
		return result
	}

	/**
	 * Finalizes the XML output, closing any remaining open tags.
	 * @returns a string with the closing XML tags.
	 */
	public finalize(): string {
		let finalXml = ""
		for (let i = 0; i < this.accumulatedToolCalls.length; i++) {
			const state = this.processingStates.get(i)
			const toolCall = this.accumulatedToolCalls[i]

			if (!state || !toolCall || state.functionClosed) {
				continue
			}

			// Process any remaining buffered arguments
			if (toolCall.function.arguments.length > state.arguments.length) {
				state.arguments = toolCall.function.arguments
				finalXml += this.processArguments(state, toolCall.function.name)
			}

			// Close remaining tags from the stack in reverse order.
			while (state.xmlTagStack.length > 0) {
				const tag = state.xmlTagStack.pop()!
				const indentLevel = state.bracketStack.filter((b) => b === "{").length - 1
				finalXml += `${this.getIndent(indentLevel)}${this.onCloseTag(tag, toolCall.function.name)}`
			}

			if (state.functionNameOutputted) {
				finalXml += `</${toolCall.function.name}>\n`
			}
		}
		return finalXml
	}

	/**
	 * Resets the processor to its initial state for a new sequence of tool calls.
	 */
	public reset(): void {
		this.accumulatedToolCalls = []
		this.processingStates.clear()
	}

	/**
	 * Generates indentation for pretty-printing the XML output.
	 * @param level - The desired indentation level.
	 * @returns A string of tabs.
	 */
	private getIndent(level: number): string {
		if (level >= 0) {
			return "\t".repeat(level)
		}
		return ""
	}

	/**
	 * The core state machine for parsing JSON arguments and generating XML.
	 * @param state - The current processing state for a tool call.
	 * @param toolName - The name of the current tool being processed.
	 * @returns The generated XML string for the processed chunk.
	 */
	private processArguments(state: ToolCallProcessingState, toolName: string): string {
		let xml = ""
		const args = state.arguments

		while (state.cursor < args.length) {
			const char = args[state.cursor]

			if (state.inString) {
				if (state.isStreamingStringValue) {
					// --- Streaming Logic for String Values (character by character) ---
					if (char === "\\") {
						// Handle escape sequence.
						const escapeSequence = this.getFullEscapeSequence(args, state.cursor)
						if (escapeSequence) {
							try {
								// Use JSON.parse on the smallest possible valid JSON string
								// to robustly unescape the sequence.
								xml += JSON.parse('"' + escapeSequence + '"')
							} catch (e) {
								// Fallback for incomplete escape sequences at the end of a chunk.
								xml += escapeSequence
							}
							state.cursor += escapeSequence.length
						} else {
							// Incomplete escape sequence (e.g., `\` at the end of a chunk).
							// Stop processing this chunk and wait for the next one.
							return xml
						}
					} else if (char === '"') {
						// End of string value.
						state.inString = false
						state.isStreamingStringValue = false
						const parent = state.bracketStack[state.bracketStack.length - 1]
						if (parent === "{") {
							const tag = state.xmlTagStack.pop()!
							if (tag) {
								xml += `${this.onCloseTag(tag, toolName)}`
							}
						}
						state.parserState = ParserState.EXPECT_COMMA_OR_CLOSING
						state.cursor++ // Consume the quote
					} else {
						// Regular character in a string, output directly.
						xml += char
						state.cursor++
					}
				} else {
					// --- Buffering Logic for String Keys ---
					if (char === "\\" && !state.isEscaped) {
						state.currentString += "\\"
						state.isEscaped = true
					} else if (char === '"' && !state.isEscaped) {
						state.inString = false
						let finalString
						try {
							finalString = JSON.parse('"' + state.currentString + '"')
						} catch (e) {
							finalString = state.currentString
						}

						// This must be a key, because values are streamed.
						state.xmlTagStack.push(finalString)
						const indentLevel = state.bracketStack.filter((b) => b === "{").length - 1
						xml += `${this.getIndent(indentLevel)}${this.onOpenTag(finalString, toolName)}`
						state.parserState = ParserState.EXPECT_COLON
						state.currentString = ""
					} else {
						state.currentString += char
						state.isEscaped = false
					}
					state.cursor++
				}
				continue
			}

			if (/\s/.test(char)) {
				state.cursor++
				continue
			}

			// Handle primitives - accumulate characters until we hit a delimiter
			if (state.parserState === ParserState.EXPECT_VALUE) {
				// Check if this character could be part of a primitive value
				if (
					(char >= "0" && char <= "9") ||
					char === "-" ||
					char === "." ||
					(char >= "a" && char <= "z") ||
					(char >= "A" && char <= "Z")
				) {
					// Accumulate the character
					state.primitiveBuffer += char
					state.cursor++
					continue
				} else if (state.primitiveBuffer.length > 0) {
					// We've hit a delimiter, check if we have a complete primitive
					const value = state.primitiveBuffer.trim()
					if (value === "true" || value === "false" || value === "null" || /^-?\d+(\.\d+)?$/.test(value)) {
						// We have a valid primitive
						const tag = state.xmlTagStack.pop()!
						if (tag) {
							xml += `${value}${this.onCloseTag(tag, toolName)}`
						}
						state.parserState = ParserState.EXPECT_COMMA_OR_CLOSING
						state.primitiveBuffer = ""
						// Don't increment cursor - let the delimiter be processed in the switch
						continue
					} else {
						// Invalid primitive, reset buffer and continue
						state.primitiveBuffer = ""
					}
				}
			}

			switch (char) {
				case "{":
					if (
						state.parserState === ParserState.EXPECT_VALUE ||
						state.parserState === ParserState.EXPECT_ROOT
					) {
						const parent = state.bracketStack[state.bracketStack.length - 1]
						if (parent === "[") {
							// For an object inside an array, we might need to add the repeating tag.
							// But not if it's the very first element, because the tag for the array
							// itself has already been output.
							if (!state.justOpenedArray) {
								const arrayElementTag = state.xmlTagStack[state.xmlTagStack.length - 1]
								if (arrayElementTag) {
									const indentLevel = state.bracketStack.filter((b) => b === "{").length - 1
									xml += `${this.getIndent(indentLevel)}${this.onOpenTag(arrayElementTag, toolName)}`
								}
							}
						}
						state.bracketStack.push("{")
						state.parserState = ParserState.EXPECT_KEY
						xml += "\n"
						// Any value inside an array consumes the "justOpenedArray" state.
						state.justOpenedArray = false
					}
					break
				case "}":
					if (
						state.parserState === ParserState.EXPECT_KEY ||
						state.parserState === ParserState.EXPECT_COMMA_OR_CLOSING
					) {
						const parentBeforePop = state.bracketStack[state.bracketStack.length - 1]
						state.bracketStack.pop() // Pop '{'
						const parentAfterPop = state.bracketStack[state.bracketStack.length - 1]

						if (parentBeforePop === "{" && parentAfterPop === "[") {
							// Closing an object that is inside an array.
							const arrayElementTag = state.xmlTagStack[state.xmlTagStack.length - 1]
							if (arrayElementTag) {
								const indentLevel = state.bracketStack.filter((b) => b === "{").length - 1
								xml += `${this.getIndent(indentLevel)}${this.onCloseTag(arrayElementTag, toolName)}`
							}
						} else {
							// Normal object closure.
							const tag = state.xmlTagStack.pop()!
							if (tag) {
								const indentLevel = state.bracketStack.filter((b) => b === "{").length - 1
								xml += `${this.getIndent(indentLevel)}${this.onCloseTag(tag, toolName)}`
							}
						}
						state.parserState = ParserState.EXPECT_COMMA_OR_CLOSING
					}
					break
				case "[":
					if (
						state.parserState === ParserState.EXPECT_VALUE ||
						state.parserState === ParserState.EXPECT_ROOT
					) {
						state.bracketStack.push("[")
						state.parserState = ParserState.EXPECT_VALUE // An array contains values
						state.justOpenedArray = true
					}
					break
				case "]":
					if (
						state.parserState === ParserState.EXPECT_VALUE || // handles empty array e.g. []
						state.parserState === ParserState.EXPECT_COMMA_OR_CLOSING
					) {
						state.bracketStack.pop() // Pop '['
						state.xmlTagStack.pop() // Pop the array's tag name, its job is done.
						state.parserState = ParserState.EXPECT_COMMA_OR_CLOSING
					}
					break
				case '"':
					if (state.parserState === ParserState.EXPECT_VALUE) {
						// We've encountered the start of a string that is a JSON value.
						state.isStreamingStringValue = true
						state.inString = true
					} else if (state.parserState === ParserState.EXPECT_KEY) {
						// This is the start of a string that is a JSON key.
						state.isStreamingStringValue = false
						state.inString = true
					}
					break
				case ":":
					if (state.parserState === ParserState.EXPECT_COLON) {
						state.parserState = ParserState.EXPECT_VALUE
					}
					break
				case ",":
					if (state.parserState === ParserState.EXPECT_COMMA_OR_CLOSING) {
						const parent = state.bracketStack[state.bracketStack.length - 1]
						state.parserState = parent === "{" ? ParserState.EXPECT_KEY : ParserState.EXPECT_VALUE
					}
					break
			}
			state.cursor++
		}
		return xml
	}

	/**
	 * Extracts a complete JSON escape sequence from a string, starting at a given position.
	 * @param str - The string containing the escape sequence.
	 * @param pos - The starting position of the backslash.
	 * @returns The full escape sequence (e.g., "\\n", "\\uABCD") or null if incomplete.
	 */
	private getFullEscapeSequence(str: string, pos: number): string | null {
		if (pos < 0 || str[pos] !== "\\") {
			return null
		}
		// If the backslash is the last character, we need more data.
		if (pos + 1 >= str.length) {
			return null
		}
		const nextChar = str[pos + 1]
		if (nextChar === "u") {
			// A unicode escape sequence requires 4 hex digits.
			if (pos + 5 >= str.length) {
				return null // Incomplete unicode sequence.
			}
			const hex = str.substring(pos + 2, pos + 6)
			// Basic validation for hex characters.
			if (/^[0-9a-fA-F]{4}$/.test(hex)) {
				return "\\u" + hex
			}
			return null
		}
		// For simple escapes like \n, \", \\, etc.
		return str.substring(pos, pos + 2)
	}

	private onOpenTag(tag: string, toolName: string): string {
		return `<${tag}>`
	}

	private onCloseTag(tag: string, toolName: string): string {
		return `</${tag}>\n`
	}
}

/**
 * A handler function that uses the StreamingToolCallProcessor to process streaming tool calls.
 * @param processor - An instance of StreamingToolCallProcessor.
 * @param chunk - The tool call chunk to process.
 * @param providerType - The type of tool call provider (e.g., OpenAI).
 * @returns The generated XML string.
 */
export const handleOpenaiToolCallStreaming = (
	processor: StreamingToolCallProcessor,
	chunk: any,
	providerType: ToolCallProviderType,
): ToolCallParam => {
	return processor.processChunkTool(chunk, providerType)
}
