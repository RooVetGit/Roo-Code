import { GoogleGenerativeAI } from "@google/generative-ai"
import { geminiDefaultModelId, geminiModels } from "../../shared"
import { convertAnthropicMessageToGemini } from "../transform/gemini-format"
import { BaseProvider } from "./base-provider"
const GEMINI_DEFAULT_TEMPERATURE = 0
export class GeminiHandler extends BaseProvider {
	options
	client
	constructor(options) {
		super()
		this.options = options
		this.client = new GoogleGenerativeAI(options.geminiApiKey ?? "not-provided")
	}
	async *createMessage(systemPrompt, messages) {
		const model = this.client.getGenerativeModel(
			{
				model: this.getModel().id,
				systemInstruction: systemPrompt,
			},
			{
				baseUrl: this.options.googleGeminiBaseUrl || undefined,
			},
		)
		const result = await model.generateContentStream({
			contents: messages.map(convertAnthropicMessageToGemini),
			generationConfig: {
				// maxOutputTokens: this.getModel().info.maxTokens,
				temperature: this.options.modelTemperature ?? GEMINI_DEFAULT_TEMPERATURE,
			},
		})
		for await (const chunk of result.stream) {
			yield {
				type: "text",
				text: chunk.text(),
			}
		}
		const response = await result.response
		yield {
			type: "usage",
			inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
			outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
		}
	}
	getModel() {
		const modelId = this.options.apiModelId
		if (modelId && modelId in geminiModels) {
			const id = modelId
			return { id, info: geminiModels[id] }
		}
		return { id: geminiDefaultModelId, info: geminiModels[geminiDefaultModelId] }
	}
	async completePrompt(prompt) {
		try {
			const model = this.client.getGenerativeModel(
				{
					model: this.getModel().id,
				},
				{
					baseUrl: this.options.googleGeminiBaseUrl || undefined,
				},
			)
			const result = await model.generateContent({
				contents: [{ role: "user", parts: [{ text: prompt }] }],
				generationConfig: {
					temperature: this.options.modelTemperature ?? GEMINI_DEFAULT_TEMPERATURE,
				},
			})
			return result.response.text()
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Gemini completion error: ${error.message}`)
			}
			throw error
		}
	}
}
//# sourceMappingURL=gemini.js.map
