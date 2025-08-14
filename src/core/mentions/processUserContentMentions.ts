import { Anthropic } from "@anthropic-ai/sdk"
import { parseMentions } from "./index"
import { UrlContentFetcher } from "../../services/browser/UrlContentFetcher"
import { FileContextTracker } from "../context-tracking/FileContextTracker"
import { DEFAULT_MAX_IMAGE_FILE_SIZE_MB, DEFAULT_MAX_TOTAL_IMAGE_SIZE_MB } from "../tools/helpers/imageHelpers"

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
	includeDiagnosticMessages = true,
	maxDiagnosticMessages = 50,
	maxReadFileLine,
	supportsImages = false,
	maxImageFileSize = DEFAULT_MAX_IMAGE_FILE_SIZE_MB,
	maxTotalImageSize = DEFAULT_MAX_TOTAL_IMAGE_SIZE_MB,
}: {
	userContent: Anthropic.Messages.ContentBlockParam[]
	cwd: string
	urlContentFetcher: UrlContentFetcher
	fileContextTracker: FileContextTracker
	rooIgnoreController?: any
	showRooIgnoredFiles?: boolean
	includeDiagnosticMessages?: boolean
	maxDiagnosticMessages?: number
	maxReadFileLine?: number
	supportsImages?: boolean
	maxImageFileSize?: number
	maxTotalImageSize?: number
}) {
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
	return Promise.all(
		userContent.map(async (block) => {
			const shouldProcessMentions = (text: string) =>
				text.includes("<task>") ||
				text.includes("<feedback>") ||
				text.includes("<answer>") ||
				text.includes("<user_message>")

			if (block.type === "text") {
				if (shouldProcessMentions(block.text)) {
					const result = await parseMentions(
						block.text,
						cwd,
						urlContentFetcher,
						fileContextTracker,
						rooIgnoreController,
						showRooIgnoredFiles,
						includeDiagnosticMessages,
						maxDiagnosticMessages,
						maxReadFileLine,
						supportsImages,
						maxImageFileSize,
						maxTotalImageSize,
					)

					// Handle backward compatibility - result can be string or object
					if (typeof result === "string") {
						// No images found, just return the text block with updated text
						return {
							...block,
							text: result,
						}
					}

					// If there are images, we need to add them as separate image blocks
					const blocks: Anthropic.Messages.ContentBlockParam[] = [
						{
							...block,
							text: result.text,
						},
					]

					// Add image blocks for each image found
					for (const imageDataUrl of result.images) {
						blocks.push({
							type: "image",
							source: {
								type: "base64",
								media_type: imageDataUrl.substring(5, imageDataUrl.indexOf(";")) as
									| "image/jpeg"
									| "image/png"
									| "image/gif"
									| "image/webp",
								data: imageDataUrl.substring(imageDataUrl.indexOf(",") + 1),
							},
						})
					}

					// Return array if we have images, otherwise single block
					return result.images.length > 0 ? blocks : blocks[0]
				}

				return block
			} else if (block.type === "tool_result") {
				if (typeof block.content === "string") {
					if (shouldProcessMentions(block.content)) {
						const result = await parseMentions(
							block.content,
							cwd,
							urlContentFetcher,
							fileContextTracker,
							rooIgnoreController,
							showRooIgnoredFiles,
							includeDiagnosticMessages,
							maxDiagnosticMessages,
							maxReadFileLine,
							supportsImages,
							maxImageFileSize,
							maxTotalImageSize,
						)

						// Handle backward compatibility - result can be string or object
						const textContent = typeof result === "string" ? result : result.text

						// For tool_result, we can only return text content, not images
						return {
							...block,
							content: textContent,
						}
					}

					return block
				} else if (Array.isArray(block.content)) {
					const parsedContent = await Promise.all(
						block.content.map(async (contentBlock) => {
							if (contentBlock.type === "text" && shouldProcessMentions(contentBlock.text)) {
								const result = await parseMentions(
									contentBlock.text,
									cwd,
									urlContentFetcher,
									fileContextTracker,
									rooIgnoreController,
									showRooIgnoredFiles,
									includeDiagnosticMessages,
									maxDiagnosticMessages,
									maxReadFileLine,
									supportsImages,
									maxImageFileSize,
									maxTotalImageSize,
								)

								// Handle backward compatibility - result can be string or object
								const textContent = typeof result === "string" ? result : result.text

								// For tool_result content blocks, we can only return text
								return {
									...contentBlock,
									text: textContent,
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
	).then((results) => {
		// Flatten any arrays that were returned (when images were added).
		// This is necessary because when we process image mentions, we return an array
		// containing both the text block and separate image blocks. The flat() method
		// ensures all blocks are at the same level in the final array.
		return results.flat()
	})
}
