import workerpool from "workerpool"

import { Anthropic } from "@anthropic-ai/sdk"

import { tiktoken } from "../utils/tiktoken"
import { enhancedTiktoken } from "../utils/enhancedTiktoken"

import { type CountTokensResult } from "./types"

async function countTokens(
	content: Anthropic.Messages.ContentBlockParam[],
	provider: string = "default",
	useEnhanced: boolean = true,
): Promise<CountTokensResult> {
	try {
		const count = useEnhanced ? await enhancedTiktoken(content, provider) : await tiktoken(content, provider)
		return { success: true, count }
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		}
	}
}

workerpool.worker({ countTokens })
