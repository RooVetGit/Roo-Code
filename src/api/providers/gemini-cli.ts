import type { Anthropic } from "@anthropic-ai/sdk"
import type { GenerateContentResponseUsageMetadata, GroundingMetadata } from "@google/genai"

import { type ModelInfo, type GeminiCliModelId, geminiCliDefaultModelId, geminiCliModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { convertAnthropicContentToGemini, convertAnthropicMessageToGemini } from "../transform/gemini-format"
import { t } from "i18next"
import type { ApiStream } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { BaseProvider } from "./base-provider"

/**
 * GeminiCliHandler provides integration with Google's Gemini models through the
 * @google/gemini-cli-core library, which uses OAuth authentication via the Gemini CLI.
 *
 * This handler reuses much of the logic from the regular GeminiHandler but uses
 * the Gemini CLI core library for authentication instead of API keys or service accounts.
 */
export class GeminiCliHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: any // Will be typed when @google/gemini-cli-core is available

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		// Initialize the Gemini CLI client with OAuth configuration
		// The OAuth path and project ID come from the provider settings
		const oauthPath = this.options.geminiCliOAuthPath || "~/.config/gemini-cli/oauth.json"
		const projectId = this.options.geminiCliProjectId

		// Dynamically import the Gemini CLI library
		// This allows the code to compile even if the package isn't installed yet
		this.initializeClient(oauthPath, projectId)
	}

	private async initializeClient(oauthPath: string, projectId?: string) {
		try {
			// Dynamic import to handle missing package gracefully
			// @ts-ignore - Package will be available at runtime
			const { GeminiCLI } = await import("@google/gemini-cli-core")
			this.client = new GeminiCLI({
				oauthPath,
				projectId,
			})
		} catch (error) {
			throw new Error(
				"@google/gemini-cli-core is not installed. Please install it with: npm install @google/gemini-cli-core",
			)
		}
	}

	private async ensureClientInitialized() {
		if (!this.client) {
			// Wait a bit for initialization to complete
			await new Promise((resolve) => setTimeout(resolve, 100))
			if (!this.client) {
				throw new Error("Gemini CLI client not initialized. Please check your configuration.")
			}
		}
	}

	async *createMessage(
		systemInstruction: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		await this.ensureClientInitialized()
		const { id: model, info, reasoning: thinkingConfig, maxTokens } = this.getModel()

		const contents = messages.map(convertAnthropicMessageToGemini)

		const config = {
			systemInstruction,
			thinkingConfig,
			maxOutputTokens: this.options.modelMaxTokens ?? maxTokens ?? undefined,
			temperature: this.options.modelTemperature ?? 0,
		}

		const params = { model, contents, config }

		try {
			// Use the Gemini CLI client to generate content
			// The actual API will depend on @google/gemini-cli-core implementation
			const result = await this.client.models.generateContentStream(params)

			let lastUsageMetadata: GenerateContentResponseUsageMetadata | undefined
			let pendingGroundingMetadata: GroundingMetadata | undefined

			for await (const chunk of result) {
				// Process candidates and their parts to separate thoughts from content
				if (chunk.candidates && chunk.candidates.length > 0) {
					const candidate = chunk.candidates[0]

					if (candidate.groundingMetadata) {
						pendingGroundingMetadata = candidate.groundingMetadata
					}

					if (candidate.content && candidate.content.parts) {
						for (const part of candidate.content.parts) {
							if (part.thought) {
								// This is a thinking/reasoning part
								if (part.text) {
									yield { type: "reasoning", text: part.text }
								}
							} else {
								// This is regular content
								if (part.text) {
									yield { type: "text", text: part.text }
								}
							}
						}
					}
				}

				// Fallback to the original text property if no candidates structure
				else if (chunk.text) {
					yield { type: "text", text: chunk.text }
				}

				if (chunk.usageMetadata) {
					lastUsageMetadata = chunk.usageMetadata
				}
			}

			if (pendingGroundingMetadata) {
				const citations = this.extractCitationsOnly(pendingGroundingMetadata)
				if (citations) {
					yield { type: "text", text: `\n\n${t("common:errors.gemini.sources")} ${citations}` }
				}
			}

			if (lastUsageMetadata) {
				const inputTokens = lastUsageMetadata.promptTokenCount ?? 0
				const outputTokens = lastUsageMetadata.candidatesTokenCount ?? 0
				const cacheReadTokens = lastUsageMetadata.cachedContentTokenCount
				const reasoningTokens = lastUsageMetadata.thoughtsTokenCount

				yield {
					type: "usage",
					inputTokens,
					outputTokens,
					cacheReadTokens,
					reasoningTokens,
					totalCost: this.calculateCost({ info, inputTokens, outputTokens, cacheReadTokens }),
				}
			}
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(t("common:errors.gemini.generate_stream", { error: error.message }))
			}

			throw error
		}
	}

	override getModel() {
		const modelId = this.options.apiModelId
		let id = modelId && modelId in geminiCliModels ? (modelId as GeminiCliModelId) : geminiCliDefaultModelId
		let info: ModelInfo = geminiCliModels[id]
		const params = getModelParams({ format: "gemini", modelId: id, model: info, settings: this.options })

		// The `:thinking` suffix indicates that the model is a "Hybrid"
		// reasoning model and that reasoning is required to be enabled.
		// The actual model ID honored by Gemini's API does not have this suffix.
		return { id: id.endsWith(":thinking") ? id.replace(":thinking", "") : id, info, ...params }
	}

	private extractCitationsOnly(groundingMetadata?: GroundingMetadata): string | null {
		const chunks = groundingMetadata?.groundingChunks

		if (!chunks) {
			return null
		}

		const citationLinks = chunks
			.map((chunk, i) => {
				const uri = chunk.web?.uri
				if (uri) {
					return `[${i + 1}](${uri})`
				}
				return null
			})
			.filter((link): link is string => link !== null)

		if (citationLinks.length > 0) {
			return citationLinks.join(", ")
		}

		return null
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			await this.ensureClientInitialized()
			const { id: model } = this.getModel()

			const promptConfig = {
				temperature: this.options.modelTemperature ?? 0,
			}

			const result = await this.client.models.generateContent({
				model,
				contents: [{ role: "user", parts: [{ text: prompt }] }],
				config: promptConfig,
			})

			let text = result.text ?? ""

			const candidate = result.candidates?.[0]
			if (candidate?.groundingMetadata) {
				const citations = this.extractCitationsOnly(candidate.groundingMetadata)
				if (citations) {
					text += `\n\n${t("common:errors.gemini.sources")} ${citations}`
				}
			}

			return text
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(t("common:errors.gemini.generate_complete_prompt", { error: error.message }))
			}

			throw error
		}
	}

	override async countTokens(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number> {
		try {
			await this.ensureClientInitialized()
			const { id: model } = this.getModel()

			const response = await this.client.models.countTokens({
				model,
				contents: convertAnthropicContentToGemini(content),
			})

			if (response.totalTokens === undefined) {
				console.warn("Gemini CLI token counting returned undefined, using fallback")
				return super.countTokens(content)
			}

			return response.totalTokens
		} catch (error) {
			console.warn("Gemini CLI token counting failed, using fallback", error)
			return super.countTokens(content)
		}
	}

	public calculateCost({
		info,
		inputTokens,
		outputTokens,
		cacheReadTokens = 0,
	}: {
		info: ModelInfo
		inputTokens: number
		outputTokens: number
		cacheReadTokens?: number
	}) {
		if (!info.inputPrice || !info.outputPrice || !info.cacheReadsPrice) {
			return undefined
		}

		let inputPrice = info.inputPrice
		let outputPrice = info.outputPrice
		let cacheReadsPrice = info.cacheReadsPrice

		// If there's tiered pricing then adjust the input and output token prices
		// based on the input tokens used.
		if (info.tiers) {
			const tier = info.tiers.find((tier) => inputTokens <= tier.contextWindow)

			if (tier) {
				inputPrice = tier.inputPrice ?? inputPrice
				outputPrice = tier.outputPrice ?? outputPrice
				cacheReadsPrice = tier.cacheReadsPrice ?? cacheReadsPrice
			}
		}

		// Subtract the cached input tokens from the total input tokens.
		const uncachedInputTokens = inputTokens - cacheReadTokens

		let cacheReadCost = cacheReadTokens > 0 ? cacheReadsPrice * (cacheReadTokens / 1_000_000) : 0

		const inputTokensCost = inputPrice * (uncachedInputTokens / 1_000_000)
		const outputTokensCost = outputPrice * (outputTokens / 1_000_000)
		const totalCost = inputTokensCost + outputTokensCost + cacheReadCost

		return totalCost
	}
}
