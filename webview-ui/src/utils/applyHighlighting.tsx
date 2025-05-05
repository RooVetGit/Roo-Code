import React from "react"

/**
 * Recursively traverses a React node tree and wraps occurrences of searchText
 * within text content in <mark> tags.
 *
 * @param node The React node (or string, array, etc.) to process.
 * @param searchText The text to search for (case-insensitive).
 * @returns The processed React node tree with highlighting applied.
 */
export function applyHighlighting(node: React.ReactNode, searchText: string): React.ReactNode {
	if (!searchText) {
		return node // No search text, return node as is
	}

	if (typeof node === "string") {
		const lowerNode = node.toLowerCase()
		const lowerSearchText = searchText.toLowerCase()
		const parts: React.ReactNode[] = []
		let lastIndex = 0
		let index = lowerNode.indexOf(lowerSearchText, lastIndex)
		let keyIndex = 0 // Unique key for mapped elements

		while (index !== -1) {
			// Push the text before the match
			if (index > lastIndex) {
				parts.push(node.substring(lastIndex, index))
			}
			// Push the highlighted match
			const matchedText = node.substring(index, index + searchText.length)
			parts.push(<mark key={`mark-${keyIndex++}`}>{matchedText}</mark>)

			lastIndex = index + searchText.length
			index = lowerNode.indexOf(lowerSearchText, lastIndex)
		}

		// Push the remaining text after the last match
		if (lastIndex < node.length) {
			parts.push(node.substring(lastIndex))
		}

		// If parts were created, return the array, otherwise the original string
		return parts.length > 0 ? parts : node
	} else if (React.isValidElement(node)) {
		// If the element is already a <mark>, don't process its children further for highlighting
		if (node.type === "mark") {
			return node
		}

		// Recursively process children if they exist
		if (node.props.children) {
			const processedChildren = applyHighlighting(node.props.children, searchText)
			// Clone the element with the potentially modified children
			return React.cloneElement(node, { ...node.props }, processedChildren)
		} else {
			// Element has no children, return as is
			return node
		}
	} else if (Array.isArray(node)) {
		// Recursively process each item in the array
		// Prefixed index with _: Fix @typescript-eslint/no-unused-vars
		return node.map((item, _index) => applyHighlighting(item, searchText))
	} else {
		// Node is null, undefined, boolean, number, etc. - return unchanged
		return node
	}
}
