import { addValueToObject } from "./dom-builder"
import { tryParsePrimitive, processCDATAInStopnode } from "./utils"
import { ParserContext, StateHandlerResult } from "./types"

/**
 * Handles text content for CDATA and stop node sections
 */
function handleTextContent(context: ParserContext, content: string, target: any, textNodeName: string): void {
	if (!content || content.length === 0) return

	// Process CDATA content in stopnodes
	const processedContent = processCDATAInStopnode(content)

	const textToAdd = context.customOptions.parsePrimitives ? tryParsePrimitive(processedContent) : processedContent

	addValueToObject(target, textNodeName, textToAdd, context.customOptions)
}

/**
 * Creates and caches a regex pattern for finding XML tags
 */
function getOrCreateTagPattern(tagName: string, cache: Record<string, RegExp>): RegExp {
	if (!cache[tagName]) {
		const pattern = `<\\s*${tagName}(?:\\s[^>]*)?>|<\\/\\s*${tagName}\\s*>`
		cache[tagName] = new RegExp(pattern, "g")
	}
	return cache[tagName]
}

/**
 * Processes incomplete XML parsing states
 */
export function handleIncompleteState(parserContext: ParserContext): StateHandlerResult {
	const {
		incompleteStructureState: state,
		streamingBuffer: buffer,
		customOptions,
		parsingIndex,
		tagStack,
		currentPointer,
		accumulator,
	} = parserContext

	if (!state) {
		return { shouldReturn: false }
	}

	const searchStartIndex = Math.max(parsingIndex, state.at || 0)
	const bufferLength = buffer.length
	const textNodeName = customOptions.textNodeName
	let endIdx: number

	switch (state.type) {
		case "comment":
		case "doctype":
		case "xmldecl": {
			endIdx = buffer.indexOf(state.lookingFor!, searchStartIndex)
			if (endIdx !== -1 && endIdx >= (state.at || 0)) {
				parserContext.parsingIndex = endIdx + state.lookingFor!.length
				parserContext.incompleteStructureState = null
			} else {
				return { shouldReturn: true }
			}
			break
		}
		case "cdata": {
			const cdataCloseMarker = state.lookingFor!
			endIdx = buffer.indexOf(cdataCloseMarker, parsingIndex)

			if (endIdx === -1) {
				const newContent = buffer.substring(parsingIndex, bufferLength)
				if (newContent.length > 0) {
					state.partialData = (state.partialData || "") + newContent
					if (tagStack.length > 0 && currentPointer) {
						handleTextContent(parserContext, newContent, currentPointer, textNodeName)
					}
				}
				parserContext.parsingIndex = bufferLength
				return { shouldReturn: true }
			}

			const newSegment = buffer.substring(parsingIndex, endIdx)
			const fullContent = (state.partialData || "") + newSegment

			if (fullContent.length > 0) {
				if (tagStack.length > 0 && currentPointer) {
					handleTextContent(parserContext, fullContent, currentPointer, textNodeName)
				} else if (tagStack.length === 0) {
					accumulator.push(customOptions.parsePrimitives ? tryParsePrimitive(fullContent) : fullContent)
				}
			}

			parserContext.parsingIndex = endIdx + cdataCloseMarker.length
			parserContext.incompleteStructureState = null
			break
		}
		case "tag_start_incomplete": {
			if (parserContext.parsingIndex + 1 < bufferLength) {
				parserContext.incompleteStructureState = null
			} else {
				return { shouldReturn: true }
			}
			break
		}
		case "opening_tag_incomplete":
		case "closing_tag_incomplete": {
			if (state.at !== undefined) {
				const tagType = state.type === "opening_tag_incomplete" ? "opening" : "closing"
				parserContext.parsingIndex = state.at
				parserContext.reparsedSegmentContext = {
					originalIndex: state.at,
					partialText: state.partial || "",
					parentContext: state.parentOfPartial,
					tagType,
				}
			}
			parserContext.incompleteStructureState = null
			break
		}
		case "stop_node_content": {
			const { tagName: stopNodeTagName, stopNodeObjectRef } = state
			let { depth: stopNodeDepth } = state
			let currentSearchPos = parsingIndex

			const contentSearchRegex = getOrCreateTagPattern(stopNodeTagName!, parserContext.stopNodeRegexCache)
			contentSearchRegex.lastIndex = currentSearchPos

			let rawContentEnd = -1
			let closingTagLength = 0
			let match

			while (currentSearchPos < bufferLength && (match = contentSearchRegex.exec(buffer))) {
				const matchedTag = match[0]
				const isClosingTag = matchedTag.startsWith("</") || matchedTag.startsWith("<\\/")
				const isSelfClosing = /\/\s*>$/.test(matchedTag)

				if (isClosingTag && --stopNodeDepth! === 0) {
					rawContentEnd = match.index
					closingTagLength = matchedTag.length
					break
				} else if (!isClosingTag && !isSelfClosing) {
					stopNodeDepth!++
				}
				currentSearchPos = contentSearchRegex.lastIndex
			}

			if (rawContentEnd === -1) {
				const newContent = buffer.substring(parsingIndex, bufferLength)
				if (newContent.length > 0) {
					handleTextContent(parserContext, newContent, stopNodeObjectRef, textNodeName)
				}
				parserContext.parsingIndex = bufferLength
				if (parserContext.incompleteStructureState) {
					parserContext.incompleteStructureState.depth = stopNodeDepth
				}
				return { shouldReturn: true }
			}

			const newSegment = buffer.substring(parsingIndex, rawContentEnd)
			handleTextContent(parserContext, newSegment, stopNodeObjectRef, textNodeName)
			parserContext.parsingIndex = rawContentEnd + closingTagLength
			parserContext.incompleteStructureState = null
			break
		}
		default:
			parserContext.incompleteStructureState = null
	}
	return { shouldReturn: false }
}
