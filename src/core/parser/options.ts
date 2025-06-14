import { ParserOptions } from "./types"

// Default options relevant to the lenient streaming parser
export const DEFAULT_STREAM_OPTIONS: Required<ParserOptions> = {
	textNodeName: "#text", // Key for text content when a tag has other children or for consistency
	attributeNamePrefix: "@", // Prefix for attribute names in the parsed object
	stopNodes: [], // Array of tag names that should not have their children parsed
	maxDepth: null, // Maximum nesting depth; tags beyond this depth are treated like stopNodes
	alwaysCreateTextNode: true, // If true, text content is always in a #text node. Changed default for performance.
	parsePrimitives: false, // If true, attempts to parse numbers and booleans
	allowedRootNodes: null, // Allowed root nodes
	ignoreWhitespace: false, // Whether to ignore whitespace
}
