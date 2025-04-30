import { visit } from "unist-util-visit"

/**
 * Custom remark plugin that converts plain URLs in text into clickable links
 *
 * The original bug: We were converting text nodes into paragraph nodes,
 * which broke the markdown structure because text nodes should remain as text nodes
 * within their parent elements (like paragraphs, list items, etc.).
 * This caused the entire content to disappear because the structure became invalid.
 */

export const remarkUrls = () => (tree: any) => {
	// Visit all "text" nodes in the markdown AST
	visit(tree, "text", (node: any, index, parent) => {
		const urlRegex = /https?:\/\/[^\s<>)"]+/g
		const matches = node.value.match(urlRegex)

		if (!matches) {
			return
		}

		const parts = node.value.split(urlRegex)
		const children: any[] = []

		parts.forEach((part: string, i: number) => {
			if (part) {
				children.push({ type: "text", value: part })
			}

			if (matches[i]) {
				children.push({ type: "link", url: matches[i], children: [{ type: "text", value: matches[i] }] })
			}
		})

		// Fix: Instead of converting the node to a paragraph (which broke things),
		// we replace the original text node with our new nodes in the parent's children array.
		// This preserves the document structure while adding our links.
		if (parent) {
			parent.children.splice(index, 1, ...children)
		}
	})
}

export const remarkCodeLang = () => (tree: any) => {
	visit(tree, "code", (node: any) => {
		if (!node.lang) {
			node.lang = "text"
		} else if (node.lang.includes(".")) {
			node.lang = node.lang.split(".").slice(-1)[0]
		}
	})
}
