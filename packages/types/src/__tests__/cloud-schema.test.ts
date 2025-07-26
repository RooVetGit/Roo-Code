import { describe, it, expect } from "vitest"
import { organizationSettingsSchema } from "../cloud.js"

describe("organizationSettingsSchema", () => {
	it("should accept valid organization settings with defaultProviderSettings", () => {
		const validSettings = {
			version: 1,
			defaultSettings: {},
			allowList: {
				allowAll: false,
				providers: {
					anthropic: {
						allowAll: true,
						models: [],
					},
				},
			},
			defaultProviderSettings: {
				anthropic: {
					apiProvider: "anthropic" as const,
					apiKey: "test-key",
					apiModelId: "claude-3-5-sonnet-20241022",
				},
				openai: {
					apiProvider: "openai" as const,
					openAiApiKey: "test-key",
					openAiModelId: "gpt-4",
				},
			},
		}

		const result = organizationSettingsSchema.safeParse(validSettings)
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.defaultProviderSettings).toEqual(validSettings.defaultProviderSettings)
		}
	})

	it("should accept organization settings without defaultProviderSettings", () => {
		const validSettings = {
			version: 1,
			defaultSettings: {},
			allowList: {
				allowAll: true,
				providers: {},
			},
		}

		const result = organizationSettingsSchema.safeParse(validSettings)
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.defaultProviderSettings).toBeUndefined()
		}
	})

	it("should reject invalid provider names in defaultProviderSettings", () => {
		const invalidSettings = {
			version: 1,
			defaultSettings: {},
			allowList: {
				allowAll: true,
				providers: {},
			},
			defaultProviderSettings: {
				"invalid-provider": {
					apiProvider: "invalid-provider",
					apiKey: "test-key",
				},
			},
		}

		const result = organizationSettingsSchema.safeParse(invalidSettings)
		expect(result.success).toBe(false)
	})
})
