import { handleIncompleteState } from "./state-processor"
import {
	handleSpecialPrefixes,
	handleClosingTag,
	handleOpeningTag,
	handleFallbackText,
	handleTextNode,
} from "./tag-handler"
import { ParserContext } from "./types"

export function coreProcessBuffer(parserContext: ParserContext): void {
	const textNodeName = parserContext.customOptions.textNodeName
	const attributeNamePrefix =
		parserContext.customOptions.attributeNamePrefix !== undefined
			? parserContext.customOptions.attributeNamePrefix
			: "@"
	const buffer = parserContext.streamingBuffer
	let len = buffer.length

	if (parserContext.incompleteStructureState) {
		const stateResult = handleIncompleteState(parserContext)
		if (stateResult.shouldReturn) {
			return
		}
	}

	while (parserContext.parsingIndex < len) {
		const i = parserContext.parsingIndex
		if (buffer[i] === "<") {
			if (i + 1 >= len) {
				parserContext.incompleteStructureState = {
					type: "tag_start_incomplete",
					at: i,
					partial: "<",
				}
				parserContext.parsingIndex = len
				return
			}

			const charAfterLT = buffer[i + 1]
			const specialPrefixResult = handleSpecialPrefixes(parserContext, buffer, charAfterLT)

			if (specialPrefixResult.matched) {
				if (specialPrefixResult.shouldReturn) {
					return
				}
				if (specialPrefixResult.shouldContinue) {
					continue
				}
				// If matched but not returning or continuing, it implies an incomplete state was set,
				// or parsingIndex was advanced. The loop will re-evaluate or exit.
			} else {
				// Not a special prefix, try regular tags
				const tagEndMarker = buffer.indexOf(">", i)
				if (tagEndMarker === -1) {
					parserContext.parsingIndex = handleFallbackText(parserContext, buffer, i, textNodeName)
					if (
						parserContext.incompleteStructureState &&
						(parserContext.incompleteStructureState.type === "opening_tag_incomplete" ||
							parserContext.incompleteStructureState.type === "closing_tag_incomplete" ||
							parserContext.incompleteStructureState.type === "tag_start_incomplete")
					) {
						return
					}
					continue
				}

				const tagString = buffer.substring(i, tagEndMarker + 1)

				if (buffer[i + 1] === "/") {
					// Potential closing tag
					if (!handleClosingTag(parserContext, tagString)) {
						// If not a valid closing tag, treat as fallback text
						parserContext.parsingIndex = handleFallbackText(parserContext, buffer, i, textNodeName)
					}
				} else {
					// Potential opening tag
					const openingTagResult = handleOpeningTag(parserContext, tagString, i)
					if (!openingTagResult.processed) {
						// If not a valid opening tag, treat as fallback text
						parserContext.parsingIndex = handleFallbackText(parserContext, buffer, i, textNodeName)
					} else if (openingTagResult.shouldReturn) {
						return
					}
				}
			}
		} else {
			// Not starting with '<', must be a text node
			handleTextNode(parserContext, i) // 'i' is parserContext.parsingIndex here
		}
	}
}
