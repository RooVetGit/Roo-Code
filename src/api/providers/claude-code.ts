import type { Anthropic } from "@anthropic-ai/sdk"
import { claudeCodeDefaultModelId, type ClaudeCodeModelId, claudeCodeModels } from "@roo-code/types"
import { type ApiHandler } from ".."
import { ApiStreamUsageChunk, type ApiStream } from "../transform/stream"
import { runClaudeCode } from "../../integrations/claude-code/run"
import { ClaudeCodeMessage } from "../../integrations/claude-code/types"
import { BaseProvider } from "./base-provider"
import { t } from "../../i18n"
import { ApiHandlerOptions } from "../../shared/api"

export class ClaudeCodeHandler extends BaseProvider implements ApiHandler {
	private options: ApiHandlerOptions

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
	}

	override async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		const claudeProcess = runClaudeCode({
			systemPrompt,
			messages,
			path: this.options.claudeCodePath,
			modelId: this.getModel().id,
		})

		const dataQueue: string[] = []
		let processError = null
		let errorOutput = ""
		let exitCode: number | null = null
		let buffer = ""

		claudeProcess.stdout.on("data", (data) => {
			buffer += data.toString()
			const lines = buffer.split("\n")

			// Keep the last line in buffer as it might be incomplete
			buffer = lines.pop() || ""

			// Process complete lines
			for (const line of lines) {
				const trimmedLine = line.trim()
				if (trimmedLine !== "") {
					dataQueue.push(trimmedLine)
				}
			}
		})

		claudeProcess.stderr.on("data", (data) => {
			errorOutput += data.toString()
		})

		claudeProcess.on("close", (code) => {
			exitCode = code
			// Process any remaining data in buffer
			const trimmedBuffer = buffer.trim()
			if (trimmedBuffer) {
				dataQueue.push(trimmedBuffer)
				buffer = ""
			}
		})

		claudeProcess.on("error", (error) => {
			processError = error
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

		while (exitCode !== 0 || dataQueue.length > 0) {
			if (dataQueue.length === 0) {
				await new Promise((resolve) => setImmediate(resolve))
			}

			if (exitCode !== null && exitCode !== 0) {
				if (errorOutput) {
					throw new Error(
						t("common:errors.claudeCode.processExitedWithError", {
							exitCode,
							output: errorOutput.trim(),
						}),
					)
				}
				throw new Error(t("common:errors.claudeCode.processExited", { exitCode }))
			}

			const data = dataQueue.shift()
			if (!data) {
				continue
			}

			const chunk = this.attemptParseChunk(data)

			if (!chunk) {
				yield {
					type: "text",
					text: data || "",
				}

				continue
			}

			if (chunk.type === "system" && chunk.subtype === "init") {
				continue
			}

			if (chunk.type === "assistant" && "message" in chunk) {
				const message = chunk.message

				if (message.stop_reason !== null && message.stop_reason !== "tool_use") {
					const firstContent = message.content[0]
					const errorMessage =
						this.getContentText(firstContent) ||
						t("common:errors.claudeCode.stoppedWithReason", { reason: message.stop_reason })

					if (errorMessage.includes("Invalid model name")) {
						throw new Error(errorMessage + `\n\n${t("common:errors.claudeCode.apiKeyModelPlanMismatch")}`)
					}

					throw new Error(errorMessage)
				}

				for (const content of message.content) {
					if (content.type === "text") {
						yield {
							type: "text",
							text: content.text,
						}
					} else if (content.type === "thinking") {
						yield {
							type: "reasoning",
							text: content.thinking,
						}
					} else {
						console.warn("Unsupported content type:", content)
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
				// Only use the cost from the CLI if provided
				// Don't calculate cost as it may be $0 for subscription users
				usage.totalCost = chunk.cost_usd ?? 0

				yield usage
			}

			if (processError) {
				throw processError
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

	private getContentText(content: any): string | undefined {
		if (!content) return undefined
		switch (content.type) {
			case "text":
				return content.text
			case "thinking":
				return content.thinking
			default:
				return undefined
		}
	}

	// TODO: Validate instead of parsing
	private attemptParseChunk(data: string): ClaudeCodeMessage | null {
		try {
			return JSON.parse(data)
		} catch (error) {
			console.error(
				"Error parsing chunk:",
				error,
				"Data:",
				data.substring(0, 100) + (data.length > 100 ? "..." : ""),
			)
			return null
		}
	}
}
