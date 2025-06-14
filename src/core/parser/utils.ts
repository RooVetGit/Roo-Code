import { ParserOptions } from "./types"
import { DEFAULT_STREAM_OPTIONS } from "./options"

// Precompiled regex patterns for better performance
const XML_ENTITY_REGEX = /&(lt|gt|amp|quot|apos|#(\d+)|#x([\da-fA-F]+));/g

/**
 * Decodes XML entities in a text string
 * @param {string} text - The text containing XML entities
 * @param {Object<string, string>} commonEntities - Map of entity names to their values
 * @returns {string} The decoded text
 */
export function decodeXmlEntities(text: any, commonEntities: Record<string, string>): any {
	if (typeof text !== "string") return text

	return text.replace(XML_ENTITY_REGEX, (match, name, dec, hex) => {
		if (commonEntities[name]) return commonEntities[name]
		if (dec) return String.fromCharCode(parseInt(dec, 10))
		if (hex) return String.fromCharCode(parseInt(hex, 16))
		return match
	})
}

// Lookup table for boolean values
const BOOLEAN_VALUES: Record<string, boolean> = {
	true: true,
	false: false,
	True: true,
	False: false,
	TRUE: true,
	FALSE: false,
}

/**
 * Optimized primitive type parser with lookup tables
 * @param {string} value - The value to parse
 * @returns {boolean|number|string} The parsed primitive value or original string
 */
export function tryParsePrimitive(value: any): boolean | number | string {
	if (typeof value !== "string") return value

	// Fast boolean lookup
	if (value.length <= 5) {
		const boolResult = BOOLEAN_VALUES[value]
		if (boolResult !== undefined) return boolResult
	}

	// Fast number check - avoid trim() if possible
	if (value.charAt(0) === "-" || (value.charAt(0) >= "0" && value.charAt(0) <= "9")) {
		const num = Number(value)
		if (!isNaN(num) && String(num) === value) {
			return num
		}
	}

	return value
}

/**
 * Parses XML attributes string into an object with optimized value extraction
 * @param {string} attributesString - The raw attributes string
 * @param {string} attributeNamePrefix - Prefix to add to attribute names
 * @param {Object} customOptions - Parser options
 * @param {RegExp} attrRegexInstance - Regex for matching attributes
 * @param {Function} decodeXmlEntitiesFn - Function to decode XML entities
 * @param {Function} tryParsePrimitiveFn - Function to parse primitive values
 * @param {Object} commonEntitiesForDecode - Common XML entities map
 * @returns {Object} Parsed attributes object
 */
export function parseAttributes(
	attributesString: string,
	attributeNamePrefix: string,
	customOptions: Required<ParserOptions>,
	attrRegexInstance: RegExp,
	decodeXmlEntitiesFn: (text: any, entities: Record<string, string>) => any,
	tryParsePrimitiveFn: (value: any) => boolean | number | string,
	commonEntitiesForDecode: Record<string, string>,
): Record<string, any> {
	if (!attributesString) return {}

	const attrs: Record<string, any> = {}
	attrRegexInstance.lastIndex = 0
	let match

	while ((match = attrRegexInstance.exec(attributesString)) !== null) {
		const attrName = match[1]
		const prefixedName = attributeNamePrefix + attrName

		// Find first defined value group
		const valueGroup = match[2] || match[3] || match[4]
		const attrValue = valueGroup !== undefined ? decodeXmlEntitiesFn(valueGroup, commonEntitiesForDecode) : true

		// Set attribute value with optional primitive parsing
		attrs[prefixedName] =
			customOptions.parsePrimitives && typeof attrValue === "string" ? tryParsePrimitiveFn(attrValue) : attrValue
	}

	return attrs
}

/**
 * Checks if text content needs to be wrapped in CDATA
 * @param {string} text - The text to check
 * @returns {boolean} True if CDATA is needed
 */
export function needsCDATA(text: any): boolean {
	if (typeof text !== "string") return false

	// Use CDATA only for very specific cases where round-trip parsing would fail
	// Be conservative - only use CDATA when absolutely necessary

	// Check for simple XML tag patterns that would be parsed as actual XML
	const simpleXmlTagPattern = /<[a-zA-Z][a-zA-Z0-9]*>/

	if (simpleXmlTagPattern.test(text)) {
		// Exclude cases that should be treated as literal content:

		// 1. Content that looks like JavaScript/code with quoted XML
		if (text.includes("'") || text.includes('"')) {
			return false
		}

		// 2. Content with multiple complete XML-like structures (treat as literal)
		const completeTagPattern = /<[a-zA-Z][a-zA-Z0-9]*>[^<]*<\/[a-zA-Z][a-zA-Z0-9]*>/g
		const matches = text.match(completeTagPattern)
		if (matches && matches.length > 1) {
			return false
		}

		// 3. Simple trailing tag pattern like "value<data>" - treat as literal
		const trailingTagPattern = /^[^<]*<[a-zA-Z]+>$/
		if (trailingTagPattern.test(text)) {
			return false
		}

		// 4. Simple leading tag pattern like "<Hello&World>" with non-tag content
		const leadingNonTagPattern = /^<[a-zA-Z]+[^>]*[^a-zA-Z>][^>]*>$/
		if (leadingNonTagPattern.test(text)) {
			return false
		}

		// Only use CDATA for simple cases like "text with <tag> in middle"
		// that would cause round-trip parsing issues
		return true
	}

	return false
}

/**
 * Escapes special XML characters in text content
 * @param {*} text - The text to escape (if not a string, returns as-is)
 * @returns {string} The escaped text
 */
export function escapeXmlText(text: any): any {
	if (typeof text !== "string") {
		// Convert numbers and booleans to strings, return others as-is
		if (typeof text === "number" || typeof text === "boolean") {
			return String(text)
		}
		return text
	}

	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;")
}

/**
 * Processes CDATA content in stopnode raw content by extracting the actual content
 * and removing CDATA markers
 * @param {string} rawContent - The raw content from a stopnode
 * @returns {string} The processed content with CDATA sections extracted
 */
export function processCDATAInStopnode(rawContent: any): any {
	if (typeof rawContent !== "string") return rawContent

	// Replace complete CDATA sections with their content
	let processed = rawContent.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")

	// Handle incomplete CDATA at the beginning (streaming case)
	if (processed.startsWith("<![CDATA[")) {
		processed = processed.substring(9) // Remove '<![CDATA['
	}

	// Handle incomplete CDATA at the end (streaming case)
	if (processed.endsWith("]]>")) {
		processed = processed.substring(0, processed.length - 3) // Remove ']]>'
	}

	return processed
}

/**
 * Converts a JavaScript object (from XML parser output) back to XML string
 * @param {*} node - The node to convert (object, array, or primitive)
 * @param {Object} options - Options object
 * @returns {string} The XML string representation
 */
export function xmlObjectToString(node: any, options: Partial<ParserOptions> = {}): string {
	// Merge with provided options
	const mergedOptions = { ...DEFAULT_STREAM_OPTIONS, ...options }
	const { textNodeName, attributeNamePrefix } = mergedOptions

	// Base cases
	if (node === null || node === undefined) {
		return ""
	}

	// Handle arrays - recursively process each item
	if (Array.isArray(node)) {
		return node.map((item) => xmlObjectToString(item, mergedOptions)).join("")
	}

	// Handle primitives (string, number, boolean)
	if (typeof node !== "object") {
		// Convert to string - use CDATA for strings with XML-like content
		if (typeof node === "string") {
			return needsCDATA(node) ? `<![CDATA[${node}]]>` : node
		}
		return String(node)
	}

	// Handle objects
	let xmlString = ""

	for (const tagName of Object.keys(node)) {
		const tagContent = node[tagName]
		let attributesString = ""
		let childrenString = ""

		// If tagContent is an array, handle multiple child elements with the same tag name
		if (Array.isArray(tagContent)) {
			// Each item in the array becomes child content
			childrenString = tagContent.map((item) => xmlObjectToString(item, mergedOptions)).join("")
		} else if (typeof tagContent === "object" && tagContent !== null) {
			// Process the object's properties
			for (const subKey of Object.keys(tagContent)) {
				if (subKey === textNodeName) {
					// This is text content - check this first to avoid treating it as an attribute
					const textContent = tagContent[subKey]
					childrenString += xmlObjectToString(textContent, mergedOptions)
				} else if (subKey.startsWith(attributeNamePrefix)) {
					// This is an attribute
					const attributeName = subKey.substring(attributeNamePrefix.length)
					const attrValue = String(tagContent[subKey])
					attributesString += ` ${attributeName}="${attrValue}"`
				} else {
					// This is a child element - handle arrays properly
					if (Array.isArray(tagContent[subKey])) {
						// Multiple elements with the same name
						for (const item of tagContent[subKey]) {
							childrenString += xmlObjectToString({ [subKey]: item }, mergedOptions)
						}
					} else {
						// Single child element
						childrenString += xmlObjectToString({ [subKey]: tagContent[subKey] }, mergedOptions)
					}
				}
			}
		} else {
			// tagContent is a primitive - treat as direct content
			childrenString = xmlObjectToString(tagContent, mergedOptions)
		}

		// Build the XML tag
		xmlString += `<${tagName}${attributesString}>${childrenString}</${tagName}>`
	}

	return xmlString
}

export {
	XML_ENTITY_REGEX, // Exporting for potential direct use or testing, though not typical
	BOOLEAN_VALUES, // Exporting for potential direct use or testing
}
