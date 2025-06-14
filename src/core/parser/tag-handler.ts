import { addValueToObject } from "./dom-builder"
import { tryParsePrimitive, decodeXmlEntities, parseAttributes, processCDATAInStopnode } from "./utils"
import { STATIC_OPENING_TAG_REGEX, STATIC_CLOSING_TAG_REGEX, COMMON_ENTITIES } from "./constants"
import { ParserContext, SpecialPrefixResult, TagHandlerResult } from "./types"

export function handleSpecialPrefixes(
	parserContext: ParserContext,
	buffer: string,
	charAfterLT: string,
): SpecialPrefixResult {
	const i = parserContext.parsingIndex
	const len = buffer.length
	const textNodeName = parserContext.customOptions.textNodeName

	if (charAfterLT === "?") {
		if (buffer.startsWith("<?xml", i)) {
			const endDeclaration = buffer.indexOf("?>", i + 5)
			if (endDeclaration === -1) {
				parserContext.incompleteStructureState = {
					type: "xmldecl",
					lookingFor: "?>",
					at: i,
					partial: buffer.substring(i, len),
				}
				parserContext.parsingIndex = len
				return { matched: true, shouldReturn: true, shouldContinue: false }
			}
			parserContext.parsingIndex = endDeclaration + 2
			parserContext.incompleteStructureState = null
			return { matched: true, shouldReturn: false, shouldContinue: true }
		}
	} else if (charAfterLT === "!") {
		if (i + 3 < len && buffer[i + 2] === "-" && buffer[i + 3] === "-") {
			// <!--
			const commentEnd = buffer.indexOf("-->", i + 4)
			if (commentEnd === -1) {
				parserContext.incompleteStructureState = {
					type: "comment",
					lookingFor: "-->",
					at: i,
					partial: buffer.substring(i, len),
				}
				parserContext.parsingIndex = len
				return { matched: true, shouldReturn: true, shouldContinue: false }
			}
			parserContext.parsingIndex = commentEnd + 3
			parserContext.incompleteStructureState = null
			return { matched: true, shouldReturn: false, shouldContinue: true }
		} else if (buffer.startsWith("<![CDATA[", i)) {
			const cdataOpenTagEnd = i + 9
			const cdataCloseMarker = "]]>"
			const cdataEnd = buffer.indexOf(cdataCloseMarker, cdataOpenTagEnd)
			if (cdataEnd === -1) {
				// Incomplete CDATA
				const partialContent = buffer.substring(cdataOpenTagEnd, len)
				let currentPartialData = ""
				if (
					parserContext.incompleteStructureState &&
					parserContext.incompleteStructureState.type === "cdata" &&
					parserContext.incompleteStructureState.at === i
				) {
					currentPartialData = parserContext.incompleteStructureState.partialData || ""
				}

				parserContext.incompleteStructureState = {
					type: "cdata",
					lookingFor: cdataCloseMarker,
					at: i,
					partialData: currentPartialData + partialContent,
				}
				if (partialContent.length > 0) {
					if (parserContext.tagStack.length > 0 && parserContext.currentPointer) {
						addValueToObject(
							parserContext.currentPointer,
							textNodeName,
							partialContent,
							parserContext.customOptions,
						)
					}
				}
				parserContext.parsingIndex = len
				return { matched: true, shouldReturn: true, shouldContinue: false }
			} else {
				// CDATA finished in this chunk
				let text = buffer.substring(cdataOpenTagEnd, cdataEnd)
				parserContext.parsingIndex = cdataEnd + cdataCloseMarker.length

				const prevPartialData =
					parserContext.incompleteStructureState &&
					parserContext.incompleteStructureState.type === "cdata" &&
					parserContext.incompleteStructureState.at === i
						? parserContext.incompleteStructureState.partialData
						: ""
				const fullTextContent = (prevPartialData || "") + text

				const processedCDATA = parserContext.customOptions.parsePrimitives
					? tryParsePrimitive(fullTextContent)
					: fullTextContent

				if (fullTextContent.length > 0) {
					if (parserContext.tagStack.length > 0 && parserContext.currentPointer) {
						addValueToObject(
							parserContext.currentPointer,
							textNodeName,
							processedCDATA,
							parserContext.customOptions,
						)
					} else if (parserContext.tagStack.length === 0) {
						parserContext.accumulator.push(processedCDATA)
					}
				}
				parserContext.incompleteStructureState = null
				return { matched: true, shouldReturn: false, shouldContinue: true }
			}
		} else if (buffer.startsWith("<!DOCTYPE", i)) {
			const endDoctype = buffer.indexOf(">", i + 9)
			if (endDoctype === -1) {
				parserContext.incompleteStructureState = {
					type: "doctype",
					lookingFor: ">",
					at: i,
					partial: buffer.substring(i, len),
				}
				parserContext.parsingIndex = len
				return { matched: true, shouldReturn: true, shouldContinue: false }
			}
			parserContext.parsingIndex = endDoctype + 1
			parserContext.incompleteStructureState = null
			return { matched: true, shouldReturn: false, shouldContinue: true }
		}
	}

	return { matched: false, shouldReturn: false, shouldContinue: false }
}

export function handleClosingTag(parserContext: ParserContext, tagString: string): boolean {
	const textNodeName = parserContext.customOptions.textNodeName

	// 1. Initial Check & Syntax Validation
	const match = tagString.match(STATIC_CLOSING_TAG_REGEX)
	if (!match) {
		// Not syntactically valid, return false to allow fallback to handleFallbackText
		return false
	}

	const closingTagName = match[1]

	// 2. Check if tagStack is empty
	if (parserContext.tagStack.length === 0) {
		// No open parent, return false
		return false
	}

	// 3. Search the tagStack for a Match
	let matchIndex = -1
	for (let i = parserContext.tagStack.length - 1; i >= 0; i--) {
		if (parserContext.tagStack[i].tagName === closingTagName) {
			matchIndex = i
			break
		}
	}

	// 4. If a Match is Found
	if (matchIndex !== -1) {
		// Handle Interrupted Tags - only process the topmost instances of each tag name
		const processedTagNames = new Set<string>()
		for (let i = parserContext.tagStack.length - 1; i > matchIndex; i--) {
			const interruptedTagState = parserContext.tagStack[i]
			const parentOfInterruptedTagState = parserContext.tagStack[i - 1]

			// Skip if we've already processed a tag with this name (process only the topmost)
			if (processedTagNames.has(interruptedTagState.tagName)) {
				continue
			}
			processedTagNames.add(interruptedTagState.tagName)

			// Construct the text representation of the opening tag
			const openingTagText = "<" + interruptedTagState.tagName + ">"

			if (parentOfInterruptedTagState && parentOfInterruptedTagState.objPtr) {
				// Remove the interrupted tag's object from its parent if it exists
				const parentObj = parentOfInterruptedTagState.objPtr
				const tagName = interruptedTagState.tagName

				if (Object.prototype.hasOwnProperty.call(parentObj, tagName)) {
					// Only remove empty objects or objects that were just created
					const shouldRemove =
						!interruptedTagState.objPtr ||
						Object.keys(interruptedTagState.objPtr).length === 0 ||
						(Object.keys(interruptedTagState.objPtr).length === 1 &&
							Object.prototype.hasOwnProperty.call(interruptedTagState.objPtr, tagName) &&
							Object.keys(interruptedTagState.objPtr[tagName]).length === 0)

					if (shouldRemove) {
						// If it's an array, remove the interrupted tag's object
						if (Array.isArray(parentObj[tagName])) {
							const arr = parentObj[tagName]
							const idx = arr.indexOf(interruptedTagState.objPtr)
							if (idx !== -1) {
								arr.splice(idx, 1)
								// If array becomes empty, remove the property
								if (arr.length === 0) {
									delete parentObj[tagName]
								}
							}
						} else if (parentObj[tagName] === interruptedTagState.objPtr) {
							// If it's a direct reference, remove it
							delete parentObj[tagName]
						}
					}
				}

				// Add the opening tag as text content to the parent
				addValueToObject(
					parentOfInterruptedTagState.objPtr,
					textNodeName,
					openingTagText,
					parserContext.customOptions,
				)
				parentOfInterruptedTagState.textOnly = false
			}
		}

		// Pop Tags: Pop all tags from matchIndex to the top of the stack (inclusive)
		parserContext.tagStack.length = matchIndex

		// Get the matched tag state before popping
		const matchedTagState = parserContext.tagStack[matchIndex]

		// Pop Tags: Pop all tags from matchIndex to the top of the stack (inclusive)
		parserContext.tagStack.length = matchIndex

		// Handle text-only optimization for the matched tag (similar to original logic)
		if (
			!parserContext.customOptions.alwaysCreateTextNode &&
			matchedTagState.textOnly &&
			Object.prototype.hasOwnProperty.call(matchedTagState.objPtr, textNodeName) &&
			Object.keys(matchedTagState.objPtr).length === 1
		) {
			const textVal = matchedTagState.objPtr[textNodeName]
			if (parserContext.tagStack.length > 0) {
				const currentParent = parserContext.tagStack[parserContext.tagStack.length - 1].objPtr
				for (const keyInParent in currentParent) {
					if (currentParent[keyInParent] === matchedTagState.objPtr) {
						currentParent[keyInParent] = textVal
						break
					} else if (Array.isArray(currentParent[keyInParent])) {
						const arr = currentParent[keyInParent]
						const idx = arr.indexOf(matchedTagState.objPtr)
						if (idx !== -1) {
							arr[idx] = textVal
							break
						}
					}
				}
			} else {
				for (let k = 0; k < parserContext.accumulator.length; k++) {
					if (typeof parserContext.accumulator[k] === "object" && parserContext.accumulator[k] !== null) {
						const rootTagNameFromAccumulator = Object.keys(parserContext.accumulator[k])[0]
						if (
							rootTagNameFromAccumulator === matchedTagState.tagName &&
							parserContext.accumulator[k][rootTagNameFromAccumulator] === matchedTagState.objPtr
						) {
							parserContext.accumulator[k][rootTagNameFromAccumulator] = textVal
							break
						}
					}
				}
			}
		}

		// Update Context
		parserContext.currentPointer =
			parserContext.tagStack.length > 0 ? parserContext.tagStack[parserContext.tagStack.length - 1].objPtr : null
		parserContext.parsingIndex += tagString.length
		parserContext.incompleteStructureState = null
		parserContext.reparsedSegmentContext = null

		return true
	}

	// 5. If No Match is Found in the Entire Stack
	// The tagString itself becomes literal text
	if (parserContext.currentPointer) {
		addValueToObject(parserContext.currentPointer, textNodeName, tagString, parserContext.customOptions)

		// Mark the current top-of-stack tag as not textOnly
		parserContext.tagStack[parserContext.tagStack.length - 1].textOnly = false

		// Advance parsing index and clear incomplete states
		parserContext.parsingIndex += tagString.length
		parserContext.incompleteStructureState = null
		parserContext.reparsedSegmentContext = null

		return true
	}

	// This shouldn't happen since we checked tagStack.length > 0 earlier,
	// but return false as fallback
	return false
}

export function handleOpeningTag(parserContext: ParserContext, tagString: string, i: number): TagHandlerResult {
	const buffer = parserContext.streamingBuffer
	const len = buffer.length
	const textNodeName = parserContext.customOptions.textNodeName
	const attributeNamePrefix =
		parserContext.customOptions.attributeNamePrefix !== undefined
			? parserContext.customOptions.attributeNamePrefix
			: "@"

	const match = tagString.match(STATIC_OPENING_TAG_REGEX)
	if (match) {
		const tagName = match[1]
		if (
			parserContext.reparsedSegmentContext &&
			parserContext.reparsedSegmentContext.parentContext &&
			parserContext.reparsedSegmentContext.partialText !== undefined &&
			parserContext.currentPointer === parserContext.reparsedSegmentContext.parentContext
		) {
			const { partialText, parentContext } = parserContext.reparsedSegmentContext
			const textNodeNameToUse = parserContext.customOptions.textNodeName

			if (Object.prototype.hasOwnProperty.call(parentContext, textNodeNameToUse)) {
				const currentTextNodeValue = parentContext[textNodeNameToUse]

				if (typeof currentTextNodeValue === "string") {
					if (currentTextNodeValue.endsWith(partialText)) {
						const newTextValue = currentTextNodeValue.slice(0, -partialText.length)
						if (newTextValue === "") {
							delete parentContext[textNodeNameToUse]
						} else {
							parentContext[textNodeNameToUse] = newTextValue
						}
					}
				} else if (Array.isArray(currentTextNodeValue)) {
					let foundAndRemoved = false
					for (let k = currentTextNodeValue.length - 1; k >= 0; k--) {
						if (currentTextNodeValue[k] === partialText) {
							currentTextNodeValue.splice(k, 1)
							foundAndRemoved = true
							break
						}
					}
					if (foundAndRemoved && currentTextNodeValue.length === 0) {
						delete parentContext[textNodeNameToUse]
					}
				}
			}
		}
		parserContext.reparsedSegmentContext = null

		const attributesString = (match[2] || "").trim()
		const isSelfClosing = match[3] === "/"
		const parsedAttributes = parseAttributes(
			attributesString,
			attributeNamePrefix,
			parserContext.customOptions,
			parserContext.attrRegex,
			decodeXmlEntities,
			tryParsePrimitive,
			COMMON_ENTITIES,
		)
		const parentPath =
			parserContext.tagStack.length > 0 ? parserContext.tagStack[parserContext.tagStack.length - 1].path : ""
		const currentPath = parentPath ? `${parentPath}.${tagName}` : tagName
		const isSimpleStopNode = parserContext.simpleStopNodes.has(tagName)

		// Check for path stopnode matches - exact matches, suffix matches, and wildcard patterns
		let isPathStopNode = parserContext.pathStopNodes.has(currentPath)

		// If no exact match, check for suffix matches and wildcard patterns
		if (!isPathStopNode) {
			for (const pathStopNode of parserContext.pathStopNodes) {
				// Check for wildcard patterns (e.g., "a.*", "*.suggest", "a.*.c")
				if (pathStopNode.includes("*")) {
					// Convert glob pattern to regex
					const regexPattern = pathStopNode
						.replace(/\./g, "\\.") // Escape dots
						.replace(/\*/g, "[^.]*") // Replace * with non-dot characters

					// Check both exact match and suffix match for wildcard patterns
					const exactRegex = new RegExp(`^${regexPattern}$`)
					const suffixRegex = new RegExp(`\\.${regexPattern}$`)

					if (exactRegex.test(currentPath) || suffixRegex.test(currentPath)) {
						isPathStopNode = true
						break
					}
				}
				// Check for suffix matches (existing logic)
				else if (
					currentPath.endsWith(pathStopNode) &&
					(currentPath === pathStopNode || currentPath.endsWith("." + pathStopNode))
				) {
					isPathStopNode = true
					break
				}
			}
		}
		// Check if maxDepth is exceeded - if so, treat as fallback text
		// tagStack.length represents the current nesting depth (0-based)
		// maxDepth=1: allow depth 0 only, treat depth 1+ as text (tagStack.length > 1)
		// maxDepth=2: allow depths 0,1,2 only, treat depth 3+ as text (tagStack.length > 2)
		// maxDepth=3: allow depths 0,1,2,3 only, treat depth 4+ as text (tagStack.length > 3)
		const isMaxDepthExceeded =
			parserContext.customOptions.maxDepth !== null &&
			parserContext.customOptions.maxDepth !== undefined &&
			parserContext.tagStack.length > parserContext.customOptions.maxDepth

		if (isMaxDepthExceeded) {
			// Treat the entire tag as fallback text instead of processing it
			return { processed: false, shouldReturn: false }
		}

		const isStopNode = !isSelfClosing && (isSimpleStopNode || isPathStopNode)

		if (isStopNode) {
			const stopNodeObject = { ...parsedAttributes }
			if (parserContext.tagStack.length === 0) {
				parserContext.accumulator.push({ [tagName]: stopNodeObject })
			} else {
				addValueToObject(parserContext.currentPointer, tagName, stopNodeObject, parserContext.customOptions)
			}
			const openTagEndOffset = tagString.length
			const contentStartIndex = i + openTagEndOffset
			let depth = 1
			let searchPos = contentStartIndex
			let rawContentEnd = -1
			let closingTagLengthVal = 0

			// CDATA-aware parsing instead of regex
			while (searchPos < len && depth > 0) {
				// Check for CDATA start
				if (buffer.startsWith("<![CDATA[", searchPos)) {
					// Skip over CDATA section
					const cdataEnd = buffer.indexOf("]]>", searchPos + 9)
					if (cdataEnd === -1) {
						// CDATA is incomplete, break out
						break
					}
					searchPos = cdataEnd + 3
					continue
				}

				// Look for next tag
				const nextLT = buffer.indexOf("<", searchPos)
				if (nextLT === -1) break

				searchPos = nextLT

				// Check if it's a closing tag for our stopnode
				const closingTagPattern = new RegExp(`^<\\/\\s*${tagName}\\s*>`, "i")
				const openingTagPattern = new RegExp(`^<\\s*${tagName}(?:\\s[^>]*)?>`, "i")

				const closingMatch = buffer.substring(searchPos).match(closingTagPattern)
				if (closingMatch) {
					depth--
					if (depth === 0) {
						rawContentEnd = searchPos
						closingTagLengthVal = closingMatch[0].length
						break
					}
					searchPos += closingMatch[0].length
					continue
				}

				const openingMatch = buffer.substring(searchPos).match(openingTagPattern)
				if (openingMatch) {
					// Check if it's self-closing
					if (!/\/\s*>$/.test(openingMatch[0])) {
						depth++
					}
					searchPos += openingMatch[0].length
					continue
				}

				// Not a tag we care about, move to next character
				searchPos++
			}
			if (rawContentEnd !== -1) {
				const rawContent = buffer.substring(contentStartIndex, rawContentEnd)
				// Process CDATA content in stopnodes
				const processedContent = processCDATAInStopnode(rawContent)
				addValueToObject(stopNodeObject, textNodeName, processedContent, parserContext.customOptions)
				parserContext.parsingIndex = rawContentEnd + closingTagLengthVal
				parserContext.incompleteStructureState = null
			} else {
				const newPartialContent = buffer.substring(contentStartIndex, len)
				// Process CDATA content in partial stopnode content
				const processedPartialContent = processCDATAInStopnode(newPartialContent)
				addValueToObject(stopNodeObject, textNodeName, processedPartialContent, parserContext.customOptions)
				parserContext.incompleteStructureState = {
					type: "stop_node_content",
					tagName,
					depth,
					contentStartIndex,
					stopNodeObjectRef: stopNodeObject,
					at: i,
				}
				parserContext.parsingIndex = len
				return { processed: true, shouldReturn: true }
			}
		} else {
			// Regular opening tag
			const newObjShell = { ...parsedAttributes }
			if (parserContext.tagStack.length === 0) {
				parserContext.accumulator.push({ [tagName]: newObjShell })
				if (!isSelfClosing) {
					parserContext.tagStack.push({
						tagName,
						objPtr: newObjShell,
						path: currentPath,
						textOnly: true,
					})
					parserContext.currentPointer = newObjShell
				} else {
					parserContext.currentPointer = null
				}
			} else {
				if (parserContext.tagStack.length > 0)
					parserContext.tagStack[parserContext.tagStack.length - 1].textOnly = false
				addValueToObject(parserContext.currentPointer, tagName, newObjShell, parserContext.customOptions)
				if (!isSelfClosing) {
					parserContext.tagStack.push({
						tagName,
						objPtr: newObjShell,
						path: currentPath,
						textOnly: true,
					})
					parserContext.currentPointer = newObjShell
				}
			}
			parserContext.parsingIndex = i + tagString.length
			parserContext.incompleteStructureState = null
		}
		return { processed: true, shouldReturn: false }
	}
	return { processed: false, shouldReturn: false }
}

export function handleFallbackText(
	parserContext: ParserContext,
	buffer: string,
	startIndex: number,
	textNodeName: string,
): number {
	let endOfProblematicText = buffer.indexOf("<", startIndex + 1)
	if (endOfProblematicText === -1) endOfProblematicText = buffer.length

	const fullFallbackText = buffer.substring(startIndex, endOfProblematicText)
	let textToProcessAsContent = fullFallbackText

	parserContext.incompleteStructureState = null

	if (endOfProblematicText === buffer.length && fullFallbackText.startsWith("<")) {
		if (fullFallbackText === "<") {
			parserContext.incompleteStructureState = {
				type: "tag_start_incomplete",
				at: startIndex,
				partial: "<",
			}
		} else if (fullFallbackText.startsWith("</")) {
			if (fullFallbackText.indexOf(">") === -1) {
				parserContext.incompleteStructureState = {
					type: "closing_tag_incomplete",
					at: startIndex,
					partial: fullFallbackText,
				}
			}
		} else if (fullFallbackText.startsWith("<")) {
			const potentialTagNameMatch = fullFallbackText.match(/^<([\w:-]+)/)
			if (potentialTagNameMatch && fullFallbackText.indexOf(">") === -1) {
				parserContext.incompleteStructureState = {
					type: "opening_tag_incomplete",
					at: startIndex,
					partial: fullFallbackText,
				}
			}
		}

		if (parserContext.incompleteStructureState) {
			textToProcessAsContent = ""
			if (parserContext.tagStack.length > 0 && parserContext.currentPointer) {
				parserContext.incompleteStructureState.parentOfPartial = parserContext.currentPointer
				const fragmentText = parserContext.incompleteStructureState.partial
				if (fragmentText && fragmentText.length > 0) {
					const decodedFragment = decodeXmlEntities(fragmentText, COMMON_ENTITIES)
					let processedFragment =
						parserContext.customOptions.parsePrimitives && typeof decodedFragment === "string"
							? tryParsePrimitive(decodedFragment)
							: decodedFragment

					parserContext.incompleteStructureState.processedPartialForCleanup = processedFragment

					let skipAddingProvisionalText = false
					if (
						parserContext.reparsedSegmentContext &&
						parserContext.reparsedSegmentContext.parentContext ===
							parserContext.incompleteStructureState.parentOfPartial &&
						parserContext.reparsedSegmentContext.partialText === processedFragment
					) {
						skipAddingProvisionalText = true
					}

					if (
						!skipAddingProvisionalText &&
						parserContext.incompleteStructureState.parentOfPartial === parserContext.currentPointer
					) {
						addValueToObject(
							parserContext.currentPointer,
							textNodeName,
							processedFragment,
							parserContext.customOptions,
						)
						if (
							parserContext.tagStack.length > 0 &&
							parserContext.tagStack[parserContext.tagStack.length - 1].objPtr ===
								parserContext.currentPointer
						) {
							parserContext.tagStack[parserContext.tagStack.length - 1].textOnly = false
						}
					}
				}
			} else if (parserContext.tagStack.length === 0) {
				parserContext.incompleteStructureState.parentOfPartial = parserContext.accumulator
			}
		}
	}

	if (textToProcessAsContent.length > 0) {
		const decodedText = decodeXmlEntities(textToProcessAsContent, COMMON_ENTITIES)
		if (decodedText.trim().length > 0) {
			let processedContent = parserContext.customOptions.parsePrimitives
				? tryParsePrimitive(decodedText)
				: decodedText
			if (parserContext.tagStack.length > 0 && parserContext.currentPointer) {
				if (parserContext.tagStack.length > 0)
					parserContext.tagStack[parserContext.tagStack.length - 1].textOnly = false
				addValueToObject(
					parserContext.currentPointer,
					textNodeName,
					processedContent,
					parserContext.customOptions,
				)
			} else if (parserContext.tagStack.length === 0) {
				parserContext.accumulator.push(processedContent)
			}
		}
	}
	return endOfProblematicText
}

export function handleTextNode(parserContext: ParserContext, i: number): void {
	const buffer = parserContext.streamingBuffer
	const len = buffer.length
	const textNodeName = parserContext.customOptions.textNodeName

	let textEnd = buffer.indexOf("<", i)
	if (textEnd === -1) textEnd = len
	const rawText = buffer.substring(i, textEnd)

	if (rawText.length > 0) {
		const decodedText = decodeXmlEntities(rawText, COMMON_ENTITIES)
		if (decodedText.trim().length > 0) {
			let processedContent = parserContext.customOptions.parsePrimitives
				? tryParsePrimitive(decodedText)
				: decodedText

			if (parserContext.tagStack.length > 0 && parserContext.currentPointer) {
				if (parserContext.tagStack.length > 0) {
					// Ensure parent tag is not marked as textOnly
					parserContext.tagStack[parserContext.tagStack.length - 1].textOnly = false
				}
				addValueToObject(
					parserContext.currentPointer,
					textNodeName,
					processedContent,
					parserContext.customOptions,
				)
			} else if (parserContext.tagStack.length === 0) {
				// Text node at the root level
				parserContext.accumulator.push(processedContent)
			}
		}
	}
	parserContext.parsingIndex = textEnd
	parserContext.incompleteStructureState = null
}
