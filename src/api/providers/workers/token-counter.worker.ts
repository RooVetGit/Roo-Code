import { parentPort } from "worker_threads"

import { type ContentBlock, countTokens } from "../../../utils/countTokens"

parentPort?.on("message", async (content: Array<ContentBlock>) => {
	try {
		if (!content || content.length === 0) {
			parentPort?.postMessage(0)
		} else {
			const now = performance.now()
			const result = await countTokens(content)
			const duration = performance.now() - now
			console.log(`[token-counter] token count -> ${result} (${duration}ms)`)
			parentPort?.postMessage(result)
		}
	} catch (error) {
		parentPort?.postMessage({ error: error instanceof Error ? error.message : "Unknown error" })
	}
})
