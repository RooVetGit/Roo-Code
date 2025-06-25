import type { Anthropic } from "@anthropic-ai/sdk"
import { claudeCodeDefaultModelId, type ClaudeCodeModelId, claudeCodeModels } from "@roo-code/types"
import { type ApiHandler } from ".."
import { ApiStreamUsageChunk, type ApiStream } from "../transform/stream"
import { runClaudeCode } from "../../integrations/claude-code/run"
import { filterMessagesForClaudeCode } from "../../integrations/claude-code/message-filter"
import { BaseProvider } from "./base-provider"
import { t } from "../../i18n"
import { ApiHandlerOptions } from "../../shared/api"
import { Tiktoken } from "tiktoken/lite"
import o200kBase from "tiktoken/encoders/o200k_base"

export class ClaudeCodeHandler extends BaseProvider implements ApiHandler {
	private options: ApiHandlerOptions
	private encoder: Tiktoken | null = null

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
	}

	override async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		// Filter out image blocks since Claude Code doesn't support them
		const filteredMessages = filterMessagesForClaudeCode(messages)

		const claudeProcess = runClaudeCode({
			systemPrompt,
			messages: filteredMessages,
			path: this.options.claudeCodePath,
			modelId: this.getModel().id,
		})

		// Usage is included with assistant messages,
		// but cost is included in the result chunk
		let usage: ApiStreamUsageChunk = {
			type: "usage",
			inputTokens: 0,
			outputTokens: 0,
			cacheReadTokens: 0,
			cacheWriteTokens: 0,
		}

		let isPaidUsage = true

		for await (const chunk of claudeProcess) {
			if (typeof chunk === "string") {
				yield {
					type: "text",
					text: chunk,
				}

				continue
			}

			if (chunk.type === "system" && chunk.subtype === "init") {
				// Based on my tests, subscription usage sets the `apiKeySource` to "none"
				isPaidUsage = chunk.apiKeySource !== "none"
				continue
			}

			if (chunk.type === "assistant" && "message" in chunk) {
				const message = chunk.message

				if (message.stop_reason !== null) {
					const content = "text" in message.content[0] ? message.content[0] : undefined

					const isError = content && content.text.startsWith(`API Error`)
					if (isError) {
						// Error messages are formatted as: `API Error: <<status code>> <<json>>`
						const errorMessageStart = content.text.indexOf("{")
						const errorMessage = content.text.slice(errorMessageStart)

						const error = this.attemptParse(errorMessage)
						if (!error) {
							throw new Error(content.text)
						}

						if (error.error.message.includes("Invalid model name")) {
							throw new Error(
								content.text + `\n\n${t("common:errors.claudeCode.apiKeyModelPlanMismatch")}`,
							)
						}

						throw new Error(errorMessage)
					}
				}

				for (const content of message.content) {
					switch (content.type) {
						case "text":
							yield {
								type: "text",
								text: content.text,
							}
							break
						case "thinking":
							yield {
								type: "reasoning",
								text: content.thinking || "",
							}
							break
						case "redacted_thinking":
							yield {
								type: "reasoning",
								text: "[Redacted thinking block]",
							}
							break
						case "tool_use":
							console.error(`tool_use is not supported yet. Received: ${JSON.stringify(content)}`)
							break
					}
				}

				usage.inputTokens += message.usage.input_tokens
				usage.outputTokens += message.usage.output_tokens
				usage.cacheReadTokens = (usage.cacheReadTokens || 0) + (message.usage.cache_read_input_tokens || 0)
				usage.cacheWriteTokens =
					(usage.cacheWriteTokens || 0) + (message.usage.cache_creation_input_tokens || 0)

				continue
			}

			if (chunk.type === "result" && "result" in chunk) {
				usage.totalCost = isPaidUsage ? chunk.total_cost_usd : 0

				yield usage
			}
		}
	}

	getModel() {
		const modelId = this.options.apiModelId
		if (modelId && modelId in claudeCodeModels) {
			const id = modelId as ClaudeCodeModelId
			return { id, info: claudeCodeModels[id] }
		}

		return {
			id: claudeCodeDefaultModelId,
			info: claudeCodeModels[claudeCodeDefaultModelId],
		}
	}

	private attemptParse(str: string) {
		try {
			return JSON.parse(str)
		} catch (err) {
			return null
		}
	}

	/**
	 * Override the base provider's token counting to provide accurate counting for Claude Code.
	 * Claude Code uses the same tokenizer as Anthropic, so we don't need any fudge factor.
	 * The actual token counts are reported accurately in the API response.
	 */
	override async countTokens(content: Anthropic.Messages.ContentBlockParam[]): Promise<number> {
		if (content.length === 0) {
			return 0
		}

		let totalTokens = 0

		// Lazily create and cache the encoder if it doesn't exist
		if (!this.encoder) {
			this.encoder = new Tiktoken(o200kBase.bpe_ranks, o200kBase.special_tokens, o200kBase.pat_str)
		}

		// Process each content block
		for (const block of content) {
			if (block.type === "text") {
				const text = block.text || ""
				if (text.length > 0) {
					const tokens = this.encoder.encode(text)
					totalTokens += tokens.length
				}
			} else if (block.type === "image") {
				// Claude Code doesn't support images, but we handle them just in case
				// Use a conservative estimate
				totalTokens += 300
			}
		}

		// No fudge factor needed - Claude Code uses the same tokenizer as Anthropic
		// and reports accurate token counts in the API response
		return totalTokens
	}
}
