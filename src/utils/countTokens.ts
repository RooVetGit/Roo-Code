import { Anthropic } from "@anthropic-ai/sdk"
import workerpool from "workerpool"

import { countTokensResultSchema } from "../workers/types"
import { tiktoken } from "./tiktoken"
import { enhancedTiktoken } from "./enhancedTiktoken"

let pool: workerpool.Pool | null | undefined = undefined

export type CountTokensOptions = {
	useWorker?: boolean
	provider?: string
	useEnhanced?: boolean
}

export async function countTokens(
	content: Anthropic.Messages.ContentBlockParam[],
	{ useWorker = true, provider = "default", useEnhanced = true }: CountTokensOptions = {},
): Promise<number> {
	// Lazily create the worker pool if it doesn't exist.
	if (useWorker && typeof pool === "undefined") {
		pool = workerpool.pool(__dirname + "/workers/countTokens.js", {
			maxWorkers: 1,
			maxQueueSize: 10,
		})
	}

	// If the worker pool doesn't exist or the caller doesn't want to use it
	// then, use the non-worker implementation.
	if (!useWorker || !pool) {
		return useEnhanced ? enhancedTiktoken(content, provider) : tiktoken(content, provider)
	}

	try {
		// Pass content, provider, and useEnhanced flag to the worker
		const data = await pool.exec("countTokens", [content, provider, useEnhanced])
		const result = countTokensResultSchema.parse(data)

		if (!result.success) {
			throw new Error(result.error)
		}

		return result.count
	} catch (error) {
		pool = null
		console.error(error)
		return useEnhanced ? enhancedTiktoken(content, provider) : tiktoken(content, provider)
	}
}
