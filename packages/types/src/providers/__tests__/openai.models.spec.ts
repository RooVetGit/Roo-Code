import { describe, it, expect } from "vitest"
import { openAiNativeModels } from "../openai.js"
import type { ModelInfo } from "../../model.js"

describe("openAiNativeModels temperature invariants", () => {
	it("models with supportsTemperature === false must not specify defaultTemperature", () => {
		for (const [_id, info] of Object.entries(openAiNativeModels)) {
			const modelInfo = info as ModelInfo & { supportsTemperature?: boolean; defaultTemperature?: number }
			if (modelInfo.supportsTemperature === false) {
				expect(modelInfo.defaultTemperature).toBeUndefined()
			}
		}
	})

	it("gpt-5 family models must have supportsTemperature: false and no defaultTemperature", () => {
		const gpt5Ids = ["gpt-5-2025-08-07", "gpt-5-mini-2025-08-07", "gpt-5-nano-2025-08-07"]
		for (const id of gpt5Ids) {
			const info = openAiNativeModels[id as keyof typeof openAiNativeModels] as ModelInfo & { supportsTemperature?: boolean; defaultTemperature?: number }
			expect(info).toBeDefined()
			expect(info.supportsTemperature).toBe(false)
			expect(info.defaultTemperature).toBeUndefined()
		}
	})
})
