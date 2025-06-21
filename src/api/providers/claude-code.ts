import type { Anthropic } from "@anthropic-ai/sdk"
import { claudeCodeDefaultModelId, type ClaudeCodeModelId, claudeCodeModels } from "@roo-code/types"
import type { ApiHandlerOptions } from "../../shared/api"
import { type ApiHandler, type ApiHandlerCreateMessageMetadata } from ".."
import { ChildProcess } from "child_process"
import { ApiStreamUsageChunk, type ApiStream } from "../transform/stream"
import { runClaudeCode } from "../../integrations/claude-code/run"
import { ClaudeCodeMessage } from "../../integrations/claude-code/types"
import { BaseProvider } from "./base-provider"

export class ClaudeCodeHandler extends BaseProvider implements ApiHandler {
	private options: ApiHandlerOptions

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
	}

	async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		let claudeProcess: ChildProcess | null = null
		let retryWithoutSession = false

		try {
			claudeProcess = runClaudeCode({
				systemPrompt,
				messages,
				path: this.options.claudeCodePath,
				modelId: this.getModel().id,
				taskId: retryWithoutSession ? undefined : metadata?.taskId,
			})

			// Listen for abort signal if provided
			if (metadata?.signal) {
				metadata.signal.addEventListener("abort", () => {
					if (claudeProcess && !claudeProcess.killed) {
						claudeProcess.kill("SIGTERM")
					}
				})
			}

			const dataQueue: string[] = []
			let processError: Error | null = null
			let errorOutput = ""
			let exitCode: number | null = null

			claudeProcess.stdout?.on("data", (data: Buffer) => {
				const output = data.toString()
				const lines = output.split("\n").filter((line: string) => line.trim() !== "")

				for (const line of lines) {
					dataQueue.push(line)
				}
			})

			claudeProcess.stderr?.on("data", (data: Buffer) => {
				errorOutput += data.toString()
			})

			claudeProcess.on("close", (code: number | null) => {
				exitCode = code
			})

			claudeProcess.on("error", (error: Error) => {
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

			while (exitCode === null || dataQueue.length > 0) {
				// Check if request was aborted
				if (metadata?.signal?.aborted) {
					throw new Error("Request was aborted")
				}

				if (dataQueue.length === 0) {
					await new Promise((resolve) => setImmediate(resolve))
				}

				if (exitCode !== null && exitCode !== 0) {
					// Detect session-related errors and execute fallback processing
					if (
						errorOutput.includes("No conversation found with session ID") &&
						!retryWithoutSession &&
						metadata?.taskId
					) {
						// Retry without session
						retryWithoutSession = true
						claudeProcess = runClaudeCode({
							systemPrompt,
							messages,
							path: this.options.claudeCodePath,
							modelId: this.getModel().id,
							taskId: undefined,
						})

						// Reinitialize process
						dataQueue.length = 0
						errorOutput = ""
						exitCode = null
						processError = null

						// Set up event listeners for the new process
						claudeProcess.stdout?.on("data", (data: Buffer) => {
							const output = data.toString()
							const lines = output.split("\n").filter((line: string) => line.trim() !== "")
							for (const line of lines) {
								dataQueue.push(line)
							}
						})

						claudeProcess.stderr?.on("data", (data: Buffer) => {
							errorOutput += data.toString()
						})

						claudeProcess.on("close", (code: number | null) => {
							exitCode = code
						})

						claudeProcess.on("error", (error: Error) => {
							processError = error
						})

						// Reset abort signal
						if (metadata?.signal) {
							metadata.signal.addEventListener("abort", () => {
								if (claudeProcess && !claudeProcess.killed) {
									claudeProcess.kill("SIGTERM")
								}
							})
						}

						continue
					}

					throw new Error(
						`Claude Code process exited with code ${exitCode}.${errorOutput ? ` Error output: ${errorOutput.trim()}` : ""}`,
					)
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
						const errorMessage =
							message.content[0]?.text || `Claude Code stopped with reason: ${message.stop_reason}`

						if (errorMessage.includes("Invalid model name")) {
							throw new Error(
								errorMessage +
									`\n\nAPI keys and subscription plans allow different models. Make sure the selected model is included in your plan.`,
							)
						}

						throw new Error(errorMessage)
					}

					for (const content of message.content) {
						if (content.type === "text") {
							yield {
								type: "text",
								text: content.text,
							}
						} else {
							console.warn("Unsupported content type:", content.type)
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
					usage.totalCost = chunk.cost_usd || 0

					yield usage
				}

				if (processError) {
					throw processError
				}
			}
		} finally {
			// Ensure the Claude process is properly cleaned up
			if (claudeProcess && !claudeProcess.killed) {
				claudeProcess.kill("SIGTERM")
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

	/**
	 * Attempts to parse a JSON chunk from Claude Code CLI output
	 * @param data Raw string data from Claude Code CLI
	 * @returns Parsed ClaudeCodeMessage or null if parsing fails
	 */
	private attemptParseChunk(data: string): ClaudeCodeMessage | null {
		try {
			const parsed = JSON.parse(data)
			// Basic validation to ensure it's a valid Claude Code message
			if (typeof parsed === "object" && parsed !== null && "type" in parsed) {
				return parsed as ClaudeCodeMessage
			}
			return null
		} catch (error) {
			// Only log if it looks like it should be JSON (starts with { or [)
			if (data.trim().startsWith("{") || data.trim().startsWith("[")) {
				console.warn("Failed to parse potential JSON chunk from Claude Code:", error)
			}
			return null
		}
	}
}
