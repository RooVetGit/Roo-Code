import { Anthropic } from "@anthropic-ai/sdk"
import { parseMentions } from "./index"
import { UrlContentFetcher } from "../../services/browser/UrlContentFetcher"
import { FileContextTracker } from "../context-tracking/FileContextTracker"

/**
 * Process mentions in user content, specifically within task and feedback tags
 */
export async function processUserContentMentions({
	userContent,
	cwd,
	urlContentFetcher,
	fileContextTracker,
	rooIgnoreController,
	showRooIgnoredFiles = true,
}: {
	userContent: Anthropic.Messages.ContentBlockParam[]
	cwd: string
	urlContentFetcher: UrlContentFetcher
	fileContextTracker: FileContextTracker
	rooIgnoreController?: any
	showRooIgnoredFiles?: boolean
}) {
	console.log("[DEBUG] Processing user content mentions, input userContent:", JSON.stringify(userContent, null, 2))

	// Process userContent array, which contains various block types:
	// TextBlockParam, ImageBlockParam, ToolUseBlockParam, and ToolResultBlockParam.
	// We need to apply parseMentions() to:
	// 1. All TextBlockParam's text (first user message with task)
	// 2. ToolResultBlockParam's content/context text arrays if it contains
	// "<feedback>" (see formatToolDeniedFeedback, attemptCompletion,
	// executeCommand, and consecutiveMistakeCount >= 3) or "<answer>"
	// (see askFollowupQuestion), we place all user generated content in
	// these tags so they can effectively be used as markers for when we
	// should parse mentions).
	const result = await Promise.all(
		userContent.map(async (block) => {
			const shouldProcessMentions = (text: string) => text.includes("<task>") || text.includes("<feedback>")

			if (block.type === "text") {
				if (shouldProcessMentions(block.text)) {
					console.log("[DEBUG] Processing mentions in text block:", block.text)
					const processedText = await parseMentions(
						block.text,
						cwd,
						urlContentFetcher,
						fileContextTracker,
						rooIgnoreController,
						showRooIgnoredFiles,
					)
					console.log("[DEBUG] Processed text block result:", processedText)
					return {
						...block,
						text: processedText,
					}
				}

				return block
			} else if (block.type === "tool_result") {
				if (typeof block.content === "string") {
					if (shouldProcessMentions(block.content)) {
						console.log("[DEBUG] Processing mentions in tool_result string content:", block.content)
						const processedContent = await parseMentions(
							block.content,
							cwd,
							urlContentFetcher,
							fileContextTracker,
							rooIgnoreController,
							showRooIgnoredFiles,
						)
						console.log("[DEBUG] Processed tool_result string content result:", processedContent)
						return {
							...block,
							content: processedContent,
						}
					}

					return block
				} else if (Array.isArray(block.content)) {
					const parsedContent = await Promise.all(
						block.content.map(async (contentBlock) => {
							if (contentBlock.type === "text" && shouldProcessMentions(contentBlock.text)) {
								console.log(
									"[DEBUG] Processing mentions in tool_result array content:",
									contentBlock.text,
								)
								const processedText = await parseMentions(
									contentBlock.text,
									cwd,
									urlContentFetcher,
									fileContextTracker,
									rooIgnoreController,
									showRooIgnoredFiles,
								)
								console.log("[DEBUG] Processed tool_result array content result:", processedText)
								return {
									...contentBlock,
									text: processedText,
								}
							}

							return contentBlock
						}),
					)

					return { ...block, content: parsedContent }
				}

				return block
			}

			return block
		}),
	)

	console.log("[DEBUG] Final processed userContent for AI:", JSON.stringify(result, null, 2))
	return result
}
