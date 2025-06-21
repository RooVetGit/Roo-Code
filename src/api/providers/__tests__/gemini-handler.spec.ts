import { describe, it, expect, vi } from "vitest"
import { GeminiHandler } from "../gemini"
import type { ApiHandlerOptions } from "../../../shared/api"
import type { Anthropic } from "@anthropic-ai/sdk"

describe("GeminiHandler backend support", () => {
	it("slices messages when contextLimit is set", async () => {
		const options = { apiProvider: "gemini", contextLimit: 1 } as ApiHandlerOptions
		const handler = new GeminiHandler(options)
		const stub = vi.fn().mockReturnValue((async function* () {})())
		// @ts-ignore access private client
		handler["client"].models.generateContentStream = stub
		const messages = [
			{ role: "user", content: [{ type: "text", text: "first" }] },
			{ role: "assistant", content: [{ type: "text", text: "second" }] },
		] as Anthropic.Messages.MessageParam[]
		for await (const _ of handler.createMessage("instr", messages)) {
		}
		expect(stub).toHaveBeenCalledOnce()
		const params = stub.mock.calls[0][0]
		expect(params.contents).toHaveLength(1)
	})

	it("passes maxOutputTokens, topP, topK, and tools for URL context and grounding in config", async () => {
		const options = {
			apiProvider: "gemini",
			maxOutputTokens: 5,
			topP: 0.5,
			topK: 10,
			enableUrlContext: true,
			enableGrounding: true,
		} as ApiHandlerOptions
		const handler = new GeminiHandler(options)
		const stub = vi.fn().mockReturnValue((async function* () {})())
		// @ts-ignore access private client
		handler["client"].models.generateContentStream = stub
		await handler.createMessage("instr", [] as any).next()
		const config = stub.mock.calls[0][0].config
		expect(config.maxOutputTokens).toBe(5)
		expect(config.topP).toBe(0.5)
		expect(config.topK).toBe(10)
		expect(config.tools).toEqual([{ urlContext: {} }, { googleSearch: {} }])
	})

	it("completePrompt passes config overrides without tools when URL context and grounding disabled", async () => {
		const options = {
			apiProvider: "gemini",
			maxOutputTokens: 7,
			topP: 0.7,
			topK: 3,
			enableUrlContext: false,
			enableGrounding: false,
		} as ApiHandlerOptions
		const handler = new GeminiHandler(options)
		const stub = vi.fn().mockResolvedValue({ text: "ok" })
		// @ts-ignore access private client
		handler["client"].models.generateContent = stub
		const res = await handler.completePrompt("hi")
		expect(res).toBe("ok")
		expect(stub).toHaveBeenCalledWith(
			expect.objectContaining({
				config: expect.objectContaining({
					maxOutputTokens: 7,
					topP: 0.7,
					topK: 3,
				}),
			}),
		)
		const promptConfig = stub.mock.calls[0][0].config
		expect(promptConfig.tools).toBeUndefined()
	})
})
