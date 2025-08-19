// src/api/providers/fetchers/__tests__/copilot.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest"
import axios from "axios"
import * as fs from "fs"
import { CopilotAuthenticator, getCopilotModels } from "../copilot"

vi.mock("axios")
vi.mock("fs", () => ({
	promises: {
		readFile: vi.fn(),
		writeFile: vi.fn(),
		mkdir: vi.fn(),
		unlink: vi.fn(),
	},
}))
vi.mock("path", () => ({
	join: (...args: string[]) => args.join("/"),
}))
vi.mock("os", () => ({
	homedir: () => "/home/test",
}))

const mockApiKey = "mock-api-key"
const mockAccessToken = "mock-access-token"
const mockCopilotToken = {
	token: mockApiKey,
	expires_at: Math.floor(Date.now() / 1000) + 3600,
	endpoints: { api: "https://copilot.api" },
}
const mockStoredTokens = {
	access_token: mockAccessToken,
	api_key: mockApiKey,
	api_key_expires_at: Math.floor(Date.now() / 1000) + 3600,
	api_base: "https://copilot.api",
}

describe("CopilotAuthenticator", () => {
	let authenticator: CopilotAuthenticator

	beforeEach(() => {
		authenticator = CopilotAuthenticator.getInstance()
		vi.clearAllMocks()
	})

	it("should return valid apiKey from stored tokens", async () => {
		;(fs.promises.readFile as any).mockResolvedValue(JSON.stringify(mockStoredTokens))
		expect(await authenticator.getApiKey()).toEqual({
			apiKey: mockApiKey,
			apiBase: "https://copilot.api",
		})
	})

	it("should refresh apiKey if expired", async () => {
		;(fs.promises.readFile as any).mockResolvedValue(
			JSON.stringify({ ...mockStoredTokens, api_key_expires_at: Math.floor(Date.now() / 1000) - 10 }),
		)
		;(axios.get as any).mockResolvedValue({ data: mockCopilotToken })
		;(fs.promises.writeFile as any).mockResolvedValue(undefined)
		expect(await authenticator.getApiKey()).toEqual({
			apiKey: mockApiKey,
			apiBase: "https://copilot.api",
		})
	})

	it("should start device code flow if no token", async () => {
		;(fs.promises.readFile as any).mockRejectedValue(new Error("not found"))
		;(axios.post as any).mockResolvedValueOnce({
			data: {
				device_code: "dev-code",
				user_code: "user-code",
				verification_uri: "https://verify",
				expires_in: 600,
				interval: 1,
			},
		})
		;(axios.post as any).mockResolvedValueOnce({
			data: { access_token: mockAccessToken },
		})
		;(axios.get as any).mockResolvedValue({ data: mockCopilotToken })
		;(fs.promises.writeFile as any).mockResolvedValue(undefined)
		expect(await authenticator.getApiKey()).toEqual({
			apiKey: mockApiKey,
			apiBase: "https://copilot.api",
		})
	})

	it("should handle pollForAccessToken timeout", async () => {
		;(fs.promises.readFile as any).mockRejectedValue(new Error("not found"))
		;(axios.post as any).mockResolvedValueOnce({
			data: {
				device_code: "dev-code",
				user_code: "user-code",
				verification_uri: "https://verify",
				expires_in: 600,
				interval: 0, // 立即执行
			},
		})
		;(axios.post as any).mockResolvedValue({ data: { error: "authorization_pending" } })

		// mock setTimeout 立即执行
		vi.stubGlobal("setTimeout", (fn: () => void, _ms: number) => {
			fn()
		})

		authenticator.setAuthTimeoutCallback(vi.fn())
		await expect(authenticator.getApiKey()).rejects.toThrow("Authentication timed out")

		vi.unstubAllGlobals()
	})

	it("should clear authentication data", async () => {
		;(fs.promises.unlink as any).mockResolvedValue(undefined)
		await expect(authenticator.clearAuth()).resolves.toBeUndefined()
	})

	it("should return isAuthenticated true if access_token exists", async () => {
		;(fs.promises.readFile as any).mockResolvedValue(JSON.stringify(mockStoredTokens))
		expect(await authenticator.isAuthenticated()).toBe(true)
	})

	it("should return isAuthenticated false if no access_token", async () => {
		;(fs.promises.readFile as any).mockResolvedValue(JSON.stringify({}))
		expect(await authenticator.isAuthenticated()).toBe(false)
	})
})

describe("getCopilotModels", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should fetch models and return ModelRecord", async () => {
		const authenticator = CopilotAuthenticator.getInstance()
		vi.spyOn(authenticator, "getApiKey").mockResolvedValue({
			apiKey: mockApiKey,
			apiBase: "https://copilot.api",
		})
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				data: [
					{
						id: "model-1",
						name: "Model One",
						model_picker_enabled: true,
						capabilities: {
							limits: { max_output_tokens: 2048, max_context_window_tokens: 4096 },
							supports: { max_thinking_budget: 100 },
						},
					},
				],
			}),
		})
		const result = await getCopilotModels()
		expect(result["model-1"]).toMatchObject({
			maxTokens: 2048,
			maxThinkingTokens: 100,
			contextWindow: 4096,
			description: "Model One",
			supportsImages: false,
			supportsComputerUse: false,
			supportsPromptCache: true,
			supportsVerbosity: false,
			supportsReasoningBudget: false,
			requiredReasoningBudget: false,
			supportsReasoningEffort: false,
			supportedParameters: ["reasoning"],
		})
	})

	it("should throw error if fetch fails", async () => {
		const authenticator = CopilotAuthenticator.getInstance()
		vi.spyOn(authenticator, "getApiKey").mockResolvedValue({
			apiKey: mockApiKey,
			apiBase: "https://copilot.api",
		})
		global.fetch = vi.fn().mockResolvedValue({ ok: false, statusText: "Bad Request" })
		await expect(getCopilotModels()).rejects.toThrow("Failed to fetch Copilot models: Bad Request")
	})

	it("should throw error if fetch throws", async () => {
		const authenticator = CopilotAuthenticator.getInstance()
		vi.spyOn(authenticator, "getApiKey").mockResolvedValue({
			apiKey: mockApiKey,
			apiBase: "https://copilot.api",
		})
		global.fetch = vi.fn().mockRejectedValue(new Error("Network error"))
		await expect(getCopilotModels()).rejects.toThrow("Failed to fetch Copilot models: Network error")
	})
})
