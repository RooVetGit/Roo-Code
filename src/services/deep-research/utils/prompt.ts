import { getEncoding } from "js-tiktoken"

import { RecursiveCharacterTextSplitter } from "../TextSplitter"

const MIN_CHUNK_SIZE = 140

const encoder = getEncoding("o200k_base")

// Trim prompt to maximum context size.
export function truncatePrompt(prompt: string, contextSize = Number(process.env.CONTEXT_SIZE) || 128_000) {
	if (!prompt) {
		return ""
	}

	const length = encoder.encode(prompt).length

	if (length <= contextSize) {
		return prompt
	}

	const overflowTokens = length - contextSize

	// On average it's 3 characters per token, so multiply by 3 to get a rough
	// estimate of the number of characters.
	const chunkSize = prompt.length - overflowTokens * 3

	if (chunkSize < MIN_CHUNK_SIZE) {
		return prompt.slice(0, MIN_CHUNK_SIZE)
	}

	const splitter = new RecursiveCharacterTextSplitter({
		chunkSize,
		chunkOverlap: 0,
	})

	const truncated = splitter.splitText(prompt)[0] ?? ""

	// Last catch, there's a chance that the trimmed prompt is same length as
	// the original prompt, due to how tokens are split & innerworkings of the
	// splitter, handle this case by just doing a hard cut.
	if (truncated.length === prompt.length) {
		return truncatePrompt(prompt.slice(0, chunkSize), contextSize)
	}

	// Recursively trim until the prompt is within the context size.
	return truncatePrompt(truncated, contextSize)
}

export function trimPrompt(prompt: string): string {
	return prompt
		.split("\n")
		.map((line) => line.trim())
		.join("\n")
}
