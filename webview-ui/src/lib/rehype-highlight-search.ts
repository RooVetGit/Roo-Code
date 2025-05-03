import { visit } from "unist-util-visit"
import type { Element, Text } from "hast"
import type { Plugin } from "unified" // Import Plugin type

interface Options {
	searchText: string
}

/**
 * Rehype plugin to highlight search terms within text nodes, skipping code blocks.
 * Conforms to the unified Plugin interface.
 */
export const rehypeHighlightSearch: Plugin<[Options?], any> = (options) => {
	const searchText = options?.searchText?.trim().toLowerCase()

	// Return the transformer function
	return (tree: any) => {
		if (!searchText) {
			return // No search text, do nothing
		}

		visit(tree, "text", (node: Text, index, parent: Element | null) => {
			if (!parent || typeof index !== "number") {
				return // Should not happen in valid HAST
			}

			// Skip highlighting within code blocks or preformatted text
			let currentParent = parent
			while (currentParent) {
				if (currentParent.tagName === "pre" || currentParent.tagName === "code") {
					return // Skip this text node
				}
				// Traverse up the tree if needed (though usually text is direct child)
				// This part might need adjustment based on complex structures, but
				// for typical markdown (p > text, li > text), checking immediate parent is enough.
				break // Only check immediate parent for performance in common cases
			}

			const nodeValue = node.value
			const lowerNodeValue = nodeValue.toLowerCase()
			const matches: { start: number; end: number }[] = []
			let startIndex = 0
			let matchIndex = lowerNodeValue.indexOf(searchText, startIndex)

			while (matchIndex !== -1) {
				matches.push({ start: matchIndex, end: matchIndex + searchText.length })
				startIndex = matchIndex + 1 // Move past the start of the current match
				matchIndex = lowerNodeValue.indexOf(searchText, startIndex)
			}

			if (matches.length === 0) {
				return // No matches in this node
			}

			const newChildren: (Text | Element)[] = []
			let lastIndex = 0

			matches.forEach((match) => {
				// Add text before the match
				if (match.start > lastIndex) {
					newChildren.push({ type: "text", value: nodeValue.substring(lastIndex, match.start) })
				}
				// Add the highlighted match
				newChildren.push({
					type: "element",
					tagName: "mark",
					properties: {}, // Add properties if needed (e.g., className)
					children: [{ type: "text", value: nodeValue.substring(match.start, match.end) }],
				})
				lastIndex = match.end
			})

			// Add any remaining text after the last match
			if (lastIndex < nodeValue.length) {
				newChildren.push({ type: "text", value: nodeValue.substring(lastIndex) })
			}

			// Replace the original text node with the new sequence
			parent.children.splice(index, 1, ...newChildren)

			// Adjust visitor index to continue after the newly inserted nodes
			return index + newChildren.length
		})
	}
}
