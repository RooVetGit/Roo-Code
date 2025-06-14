import { DEFAULT_STREAM_OPTIONS } from "./options"
import { ParserContext, ParserOptions } from "./types"

export function initializeParserOptions(parserContext: ParserContext, options?: Partial<ParserOptions>): void {
	const mergedOptions = { ...DEFAULT_STREAM_OPTIONS, ...options }
	parserContext.customOptions = mergedOptions

	if (mergedOptions.allowedRootNodes) {
		if (Array.isArray(mergedOptions.allowedRootNodes) && mergedOptions.allowedRootNodes.length > 0) {
			parserContext.allowedRootNodes = new Set(mergedOptions.allowedRootNodes)
		} else if (typeof mergedOptions.allowedRootNodes === "string") {
			parserContext.allowedRootNodes = new Set([mergedOptions.allowedRootNodes])
		} else if (Array.isArray(mergedOptions.allowedRootNodes) && mergedOptions.allowedRootNodes.length === 0) {
			parserContext.allowedRootNodes = null // Empty array means parse all as XML
		} else {
			parserContext.allowedRootNodes = null // Default to no restrictions
		}
	} else {
		parserContext.allowedRootNodes = null // No restrictions
	}

	parserContext.attrRegex = /([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s/>]+)))?/g
	parserContext.commentRegex = /<!--/g
	parserContext.cdataOpenRegex = /<!\[CDATA\[/g
	parserContext.doctypeRegex = /<!DOCTYPE/g
	parserContext.xmlDeclRegex = /<\?xml/g

	parserContext.stopNodeRegexCache = {}
	parserContext.simpleStopNodes = new Set()
	parserContext.pathStopNodes = new Set()

	if (mergedOptions.stopNodes) {
		const stopNodesArray = Array.isArray(mergedOptions.stopNodes)
			? mergedOptions.stopNodes
			: [mergedOptions.stopNodes]
		stopNodesArray.forEach((node) => {
			if (typeof node === "string") {
				if (node.includes(".")) {
					parserContext.pathStopNodes.add(node)
				} else {
					parserContext.simpleStopNodes.add(node)
				}
			}
		})
	}
}

export function resetParserState(parserContext: ParserContext): void {
	parserContext.streamingBuffer = ""
	parserContext._activelyStreaming = false
	parserContext.accumulator = []
	parserContext.currentPointer = null
	parserContext.tagStack = []
	parserContext.parsingIndex = 0
	parserContext.incompleteStructureState = null
	parserContext.reparsedSegmentContext = null
	parserContext.streamingBufferBeforeClear = ""
	parserContext._originalBufferHadContent = false
	parserContext._lastClearedIncompleteStateWasSpecial = false

	parserContext._rootDeterminationBuffer = ""
	parserContext._plainTextAccumulator = ""
	parserContext._treatAsPlainText = false
	parserContext._initialSegmentTypeDecided = false // Renamed from _rootTagDecisionMade
}
