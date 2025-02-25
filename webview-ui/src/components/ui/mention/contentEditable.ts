/**
 * Calcaulte the pixel coordinates (top, left) for cursor offset relative to the
 * contentEditable element.
 */
export const getCursorPos = (contentEditable: HTMLDivElement | null, offset: number) => {
	const selection = window.getSelection()

	if (!selection || !selection.rangeCount || !contentEditable) {
		return null
	}

	// Find the text node and relative offset that contains our target position.
	let currentOffset = 0
	let targetNode: Node | null = null
	let relativeOffset = offset

	const walker = document.createTreeWalker(contentEditable, NodeFilter.SHOW_TEXT)
	let node = walker.nextNode()

	while (node) {
		const nodeLength = node.textContent?.length || 0

		if (currentOffset + nodeLength > offset) {
			targetNode = node
			relativeOffset = offset - currentOffset
			break
		}

		currentOffset += nodeLength
		node = walker.nextNode()
	}

	if (!targetNode) {
		return null
	}

	// Create a temporary range using the found node and offset.
	let range = document.createRange()
	range.setStart(targetNode, relativeOffset)
	range.setEnd(targetNode, relativeOffset + 1)

	// Rest of the coordinate calculation remains the same.
	const rangeRect = range.getBoundingClientRect()
	const editableRect = contentEditable.getBoundingClientRect()
	const top = rangeRect.top - editableRect.top + rangeRect.height
	const left = rangeRect.left - editableRect.left
	return { top, left }
}

/**
 * Calculates the absolute text position (character offset) of a cursor within
 * a contentEditable div element.
 */
export const getCursorOffset = (container: HTMLDivElement | null, node: Node, offset: number) => {
	let total = 0

	if (!container) {
		return 0
	}

	// Walk through all nodes until we reach our target.
	const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
	let currentNode = walker.nextNode()

	while (currentNode && currentNode !== node) {
		total += currentNode.textContent?.length || 0
		currentNode = walker.nextNode()
	}

	return total + offset
}

/**
 * Replaces a typed "@" symbol and any text after it with a properly formatted
 * mention (e.g., converting "@jo" into "@john_doe ").
 */
export const replaceMention = (contentEditable: HTMLDivElement | null, mention: string) => {
	if (!contentEditable) {
		return
	}

	const selection = window.getSelection()

	if (!selection || !selection.rangeCount) {
		return
	}

	const range = selection.getRangeAt(0)
	const text = contentEditable.textContent || ""
	const lastAtPos = text.lastIndexOf("@", range.endOffset)

	if (lastAtPos >= 0) {
		const before = text.slice(0, lastAtPos)
		const after = text.slice(range.endOffset)
		const newContent = `${before}@${mention} ${after}`

		contentEditable.textContent = newContent

		// Find the correct text node and offset for the new cursor position.
		const newCursorPos = lastAtPos + mention.length + 2
		let currentOffset = 0
		let targetNode: Node | null = null
		let relativeOffset = newCursorPos

		const walker = document.createTreeWalker(contentEditable, NodeFilter.SHOW_TEXT)
		let node = walker.nextNode()

		while (node) {
			const nodeLength = node.textContent?.length || 0

			if (currentOffset + nodeLength > newCursorPos) {
				targetNode = node
				relativeOffset = newCursorPos - currentOffset
				break
			}

			currentOffset += nodeLength
			node = walker.nextNode()
		}

		if (targetNode) {
			const newRange = document.createRange()
			newRange.setStart(targetNode, relativeOffset)
			newRange.setEnd(targetNode, relativeOffset)
			selection.removeAllRanges()
			selection.addRange(newRange)
		}
	}
}
