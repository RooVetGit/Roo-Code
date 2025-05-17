// npx jest webview-ui/src/utils/__tests__/validate.test.ts

import { validateModelId } from "../validate"
import { ProviderSettings, RouterModels } from "@roo/shared/api"

// Mock i18next.t for error messages
jest.mock("i18next", () => ({
	t: (key: string, opts?: any) => {
		if (key === "settings:validation.modelAvailability") {
			return `Model ${opts.modelId} not available`
		}
		if (key === "settings:validation.modelId") {
			return "Model ID required"
		}
		return key
	},
}))

describe("validateModelId", () => {
	const baseConfig: ProviderSettings = {
		apiProvider: "litellm",
		litellmModelId: "foo-model",
		litellmApiKey: "key",
		litellmBaseUrl: "http://localhost:4000",
	} as any

	it("returns undefined if model is in the list", () => {
		const routerModels: RouterModels = {
			litellm: { "foo-model": { contextWindow: 1, supportsPromptCache: false } },
			openrouter: {},
			glama: {},
			unbound: {},
			requesty: {},
		}
		expect(validateModelId(baseConfig, routerModels)).toBeUndefined()
	})

	it("returns error if model is not in the list", () => {
		const routerModels: RouterModels = {
			litellm: { "another-model": { contextWindow: 1, supportsPromptCache: false } },
			openrouter: {},
			glama: {},
			unbound: {},
			requesty: {},
		}
		expect(validateModelId(baseConfig, routerModels)).toBe("Model foo-model not available")
	})

	it("returns undefined if routerModels is undefined", () => {
		expect(validateModelId(baseConfig, undefined)).toBeUndefined()
	})

	it("returns error if modelId is missing", () => {
		const config = { ...baseConfig, litellmModelId: undefined }
		expect(validateModelId(config, undefined)).toBe("Model ID required")
	})

	it("returns error if model list is empty", () => {
		const routerModels: RouterModels = {
			litellm: {},
			openrouter: {},
			glama: {},
			unbound: {},
			requesty: {},
		}
		expect(validateModelId(baseConfig, routerModels)).toBe("Model foo-model not available")
	})

	it("returns undefined for non-router providers", () => {
		const config: ProviderSettings = { ...baseConfig, apiProvider: "openai" }
		expect(validateModelId(config, undefined)).toBeUndefined()
	})
})
