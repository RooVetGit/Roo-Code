import { createOpenAI } from "@ai-sdk/openai"

// Providers

const openai = createOpenAI({
	apiKey: process.env.OPENAI_KEY!,
	baseURL: process.env.OPENAI_ENDPOINT || "https://api.openai.com/v1",
})

const customModel = process.env.OPENAI_MODEL || "o3-mini"

// Models

export const o3MiniModel = openai(customModel, {
	reasoningEffort: customModel.startsWith("o") ? "medium" : undefined,
	structuredOutputs: true,
})
