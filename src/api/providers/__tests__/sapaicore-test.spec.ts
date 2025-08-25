// Test file for SAP AI Core handler

import { SapAiCoreHandler } from "../sapaicore"
import { ApiHandlerOptions } from "../../../shared/api"
import { sapAiCoreDefaultModelId } from "@roo-code/types"
import axios from "axios"

vitest.mock("axios", () => ({
	default: {
		post: vitest.fn(),
		get: vitest.fn(),
	},
}))

const mockAxios = axios as any

describe("SapAiCoreHandler", () => {
	let handler: SapAiCoreHandler
	let mockOptions: ApiHandlerOptions & {
		sapAiCoreClientId?: string
		sapAiCoreClientSecret?: string
		sapAiCoreTokenUrl?: string
		sapAiResourceGroup?: string
		sapAiCoreBaseUrl?: string
	}

	beforeEach(() => {
		mockOptions = {
			apiKey: "test-api-key",
			apiModelId: "anthropic--claude-3.5-sonnet",
			sapAiCoreClientId: "test-client-id",
			sapAiCoreClientSecret: "test-client-secret",
			sapAiCoreTokenUrl: "https://test.auth.com/oauth/token",
			sapAiResourceGroup: "test-resource-group",
			sapAiCoreBaseUrl: "https://test.ai-core.com",
		}
		handler = new SapAiCoreHandler(mockOptions)

		mockAxios.post.mockClear()
		mockAxios.get.mockClear()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(SapAiCoreHandler)
		})

		it("should use default model if no model specified", () => {
			const handlerWithoutModel = new SapAiCoreHandler({
				apiKey: "test-key",
			})
			expect(handlerWithoutModel.getModel().id).toBe(sapAiCoreDefaultModelId)
		})
	})
})
