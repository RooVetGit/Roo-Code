import { Anthropic } from "@anthropic-ai/sdk"

import type { ModelInfo } from "@roo-code/types"

import { getAllowedTokens, isSafetyNetTriggered } from "../utils/context-safety"
import type { ApiHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { ApiStream } from "../transform/stream"
import { countTokens as localCountTokens } from "../../utils/countTokens"

/**
 * A utility class to compare local token estimates with precise API counts
 * and calculate a factor to improve estimation accuracy.
 */
class TokenCountComparator {
	private static readonly MAX_SAMPLES = 20
	private static readonly DEFAULT_SAFETY_FACTOR = 1.1
	private static readonly ADDITIONAL_SAFETY_FACTOR = 1.05

	private samples: Array<{ local: number; api: number }> = []
	private safetyFactor = TokenCountComparator.DEFAULT_SAFETY_FACTOR

	public addSample(local: number, api: number): void {
		if (local > 0 && api > 0) {
			this.samples.push({ local, api })
			if (this.samples.length > TokenCountComparator.MAX_SAMPLES) {
				this.samples.shift()
			}
			this.recalculateSafetyFactor()
		}
	}

	public getSafetyFactor(): number {
		return this.safetyFactor
	}

	private recalculateSafetyFactor(): void {
		if (this.samples.length === 0) {
			this.safetyFactor = TokenCountComparator.DEFAULT_SAFETY_FACTOR
			return
		}

		const totalRatio = this.samples.reduce((sum, sample) => sum + sample.api / sample.local, 0)
		const averageRatio = totalRatio / this.samples.length
		this.safetyFactor = averageRatio * TokenCountComparator.ADDITIONAL_SAFETY_FACTOR
	}

	public getSampleCount(): number {
		return this.samples.length
	}

	public getAverageRatio(): number {
		if (this.samples.length === 0) return 1
		const totalRatio = this.samples.reduce((sum, sample) => sum + sample.api / sample.local, 0)
		return totalRatio / this.samples.length
	}
}

/**
 * Base class for API providers that implements common functionality
 */
export abstract class BaseProvider implements ApiHandler {
	protected requestCount = 0
	protected tokenComparator = new TokenCountComparator()

	abstract createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream

	abstract getModel(): { id: string; info: ModelInfo }

	// Override this function for each API provider
	protected async apiBasedTokenCount(content: Anthropic.Messages.ContentBlockParam[]) {
		return await localCountTokens(content, { useWorker: true })
	}

	async countTokens(
		content: Anthropic.Messages.ContentBlockParam[],
		options: {
			maxTokens?: number | null
			effectiveThreshold?: number
			totalTokens: number
		},
	): Promise<number> {
		if (content.length === 0) {
			return 0
		}

		if (this.requestCount < 3) {
			this.requestCount++
			try {
				const apiCount = await this.apiBasedTokenCount(content)
				const localEstimate = await localCountTokens(content, { useWorker: true })
				this.tokenComparator.addSample(localEstimate, apiCount)

				return apiCount
			} catch (error) {
				const localEstimate = await localCountTokens(content, { useWorker: true })
				return localEstimate
			}
		}

		const localEstimate = await localCountTokens(content, { useWorker: true })

		const { info } = this.getModel()
		const contextWindow = info.contextWindow
		const allowedTokens = getAllowedTokens(contextWindow, options.maxTokens)
		const projectedTokens = options.totalTokens + localEstimate * this.tokenComparator.getSafetyFactor()

		// Checking if we're at 90% of effective threshold for earlier API-based counting
		const effectiveThreshold = options.effectiveThreshold ?? 100
		const contextPercent = (100 * projectedTokens) / contextWindow
		const shouldUseApiCountingEarly = contextPercent >= effectiveThreshold * 0.9

		if (
			shouldUseApiCountingEarly ||
			isSafetyNetTriggered({
				projectedTokens,
				contextWindow,
				effectiveThreshold: options.effectiveThreshold,
				allowedTokens,
			})
		) {
			try {
				const apiCount = await this.apiBasedTokenCount(content)
				this.tokenComparator.addSample(localEstimate, apiCount)
				return apiCount
			} catch (error) {
				return Math.ceil(localEstimate * this.tokenComparator.getSafetyFactor())
			}
		}

		return localEstimate
	}
}
