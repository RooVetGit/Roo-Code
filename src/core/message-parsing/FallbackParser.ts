import { Directive, ToolDirective } from "./directives"
import { TextDirective } from "./directives"
import { ToolName, toolNames } from "@roo-code/types"

export class FallbackParser {
	static parse(assistantMessage: string): Directive[] {
		const contentBlocks: Directive[] = []

		// Check if we're inside code blocks before parsing log messages
		const codeBlockRegex = /```[\s\S]*?```/g
		const codeBlocks: Array<{ start: number; end: number }> = []
		let codeBlockMatch

		// Find all code block ranges
		while ((codeBlockMatch = codeBlockRegex.exec(assistantMessage)) !== null) {
			codeBlocks.push({
				start: codeBlockMatch.index,
				end: codeBlockMatch.index + codeBlockMatch[0].length,
			})
		}

		// Helper function to check if a position is inside a code block
		const isInsideCodeBlock = (position: number): boolean => {
			return codeBlocks.some((block) => position >= block.start && position < block.end)
		}

		let lastIndex = 0

		// If no log messages were found, check for tool use
		if (contentBlocks.length === 0) {
			for (const toolName of toolNames) {
				const toolRegex = new RegExp(`<${toolName}>[\\s\\S]*?(?:<\\/${toolName}>|$)`)
				const toolMatch = assistantMessage.match(toolRegex)
				if (toolMatch) {
					const toolContent = toolMatch[0]
					const params: Record<string, string> = {}

					// Extract parameters - need to be more careful about nested structures
					// Find direct child parameters of the tool, not nested ones
					const toolInnerContent = toolContent
						.replace(new RegExp(`^<${toolName}>`), "")
						.replace(new RegExp(`</${toolName}>$`), "")

					// Use a more sophisticated approach to find top-level parameters
					let currentIndex = 0
					while (currentIndex < toolInnerContent.length) {
						// Find the next opening tag
						const tagMatch = toolInnerContent.substring(currentIndex).match(/<(\w+)>/)
						if (!tagMatch) break

						const paramName = tagMatch[1]
						const tagStart = currentIndex + tagMatch.index!
						const contentStart = tagStart + tagMatch[0].length

						// Find the matching closing tag, accounting for nested tags
						let depth = 1
						let searchIndex = contentStart
						let paramValue = ""

						while (depth > 0 && searchIndex < toolInnerContent.length) {
							const nextTag = toolInnerContent.substring(searchIndex).match(/<\/?(\w+)>/)
							if (!nextTag) {
								// No more tags, take the rest as content
								paramValue = toolInnerContent.substring(contentStart)
								break
							}

							const tagName = nextTag[1]
							const isClosing = nextTag[0].startsWith("</")

							if (tagName === paramName) {
								if (isClosing) {
									depth--
									if (depth === 0) {
										// Found the matching closing tag
										paramValue = toolInnerContent.substring(
											contentStart,
											searchIndex + nextTag.index!,
										)
										currentIndex = searchIndex + nextTag.index! + nextTag[0].length
										break
									}
								} else {
									depth++
								}
							}

							searchIndex += nextTag.index! + nextTag[0].length
						}

						if (paramName !== toolName && paramValue !== undefined) {
							params[paramName] = paramValue
						}

						if (depth > 0) {
							// Unclosed tag, take the rest
							paramValue = toolInnerContent.substring(contentStart)
							params[paramName] = paramValue
							break
						}
					}

					const ToolDirective: ToolDirective = {
						type: "tool_use",
						name: toolName as ToolName,
						params,
						partial: !assistantMessage.includes(`</${toolName}>`),
					}

					contentBlocks.push(ToolDirective)
					return contentBlocks
				}
			}
		}

		// Add any remaining text after the last log message
		if (lastIndex < assistantMessage.length) {
			const remainingText = assistantMessage.substring(lastIndex).trim()
			if (remainingText) {
				contentBlocks.push({
					type: "text",
					content: remainingText,
					partial: true,
				} as TextDirective)
			}
		}

		// If no structured content was found, treat as plain text
		if (contentBlocks.length === 0) {
			contentBlocks.push({
				type: "text",
				content: assistantMessage,
				partial: true,
			} as TextDirective)
		}

		return contentBlocks
	}
}
