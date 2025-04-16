import { AnthropicVertex } from "@anthropic-ai/vertex-sdk"
import { VertexAI } from "@google-cloud/vertexai"
import { vertexDefaultModelId, vertexModels } from "../../shared"
import { convertAnthropicMessageToVertexGemini } from "../transform/vertex-gemini-format"
import { BaseProvider } from "./base-provider"
import { ANTHROPIC_DEFAULT_MAX_TOKENS } from "./constants"
import { getModelParams } from "../"
import { GoogleAuth } from "google-auth-library"
// https://docs.anthropic.com/en/api/claude-on-vertex-ai
export class VertexHandler extends BaseProvider {
	MODEL_CLAUDE = "claude"
	MODEL_GEMINI = "gemini"
	options
	anthropicClient
	geminiClient
	modelType
	constructor(options) {
		super()
		this.options = options
		if (this.options.apiModelId?.startsWith(this.MODEL_CLAUDE)) {
			this.modelType = this.MODEL_CLAUDE
		} else if (this.options.apiModelId?.startsWith(this.MODEL_GEMINI)) {
			this.modelType = this.MODEL_GEMINI
		} else {
			throw new Error(`Unknown model ID: ${this.options.apiModelId}`)
		}
		if (this.options.vertexJsonCredentials) {
			this.anthropicClient = new AnthropicVertex({
				projectId: this.options.vertexProjectId ?? "not-provided",
				// https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/use-claude#regions
				region: this.options.vertexRegion ?? "us-east5",
				googleAuth: new GoogleAuth({
					scopes: ["https://www.googleapis.com/auth/cloud-platform"],
					credentials: JSON.parse(this.options.vertexJsonCredentials),
				}),
			})
		} else if (this.options.vertexKeyFile) {
			this.anthropicClient = new AnthropicVertex({
				projectId: this.options.vertexProjectId ?? "not-provided",
				// https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/use-claude#regions
				region: this.options.vertexRegion ?? "us-east5",
				googleAuth: new GoogleAuth({
					scopes: ["https://www.googleapis.com/auth/cloud-platform"],
					keyFile: this.options.vertexKeyFile,
				}),
			})
		} else {
			this.anthropicClient = new AnthropicVertex({
				projectId: this.options.vertexProjectId ?? "not-provided",
				// https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/use-claude#regions
				region: this.options.vertexRegion ?? "us-east5",
			})
		}
		if (this.options.vertexJsonCredentials) {
			this.geminiClient = new VertexAI({
				project: this.options.vertexProjectId ?? "not-provided",
				location: this.options.vertexRegion ?? "us-east5",
				googleAuthOptions: {
					credentials: JSON.parse(this.options.vertexJsonCredentials),
				},
			})
		} else if (this.options.vertexKeyFile) {
			this.geminiClient = new VertexAI({
				project: this.options.vertexProjectId ?? "not-provided",
				location: this.options.vertexRegion ?? "us-east5",
				googleAuthOptions: {
					keyFile: this.options.vertexKeyFile,
				},
			})
		} else {
			this.geminiClient = new VertexAI({
				project: this.options.vertexProjectId ?? "not-provided",
				location: this.options.vertexRegion ?? "us-east5",
			})
		}
	}
	formatMessageForCache(message, shouldCache) {
		// Assistant messages are kept as-is since they can't be cached
		if (message.role === "assistant") {
			return message
		}
		// For string content, we convert to array format with optional cache control
		if (typeof message.content === "string") {
			return {
				...message,
				content: [
					{
						type: "text",
						text: message.content,
						// For string content, we only have one block so it's always the last
						...(shouldCache && { cache_control: { type: "ephemeral" } }),
					},
				],
			}
		}
		// For array content, find the last text block index once before mapping
		const lastTextBlockIndex = message.content.reduce(
			(lastIndex, content, index) => (content.type === "text" ? index : lastIndex),
			-1,
		)
		// Then use this pre-calculated index in the map function
		return {
			...message,
			content: message.content.map((content, contentIndex) => {
				// Images and other non-text content are passed through unchanged
				if (content.type === "image") {
					return content
				}
				// Check if this is the last text block using our pre-calculated index
				const isLastTextBlock = contentIndex === lastTextBlockIndex
				return {
					type: "text",
					text: content.text,
					...(shouldCache && isLastTextBlock && { cache_control: { type: "ephemeral" } }),
				}
			}),
		}
	}
	async *createGeminiMessage(systemPrompt, messages) {
		const model = this.geminiClient.getGenerativeModel({
			model: this.getModel().id,
			systemInstruction: systemPrompt,
		})
		const result = await model.generateContentStream({
			contents: messages.map(convertAnthropicMessageToVertexGemini),
			generationConfig: {
				maxOutputTokens: this.getModel().info.maxTokens ?? undefined,
				temperature: this.options.modelTemperature ?? 0,
			},
		})
		for await (const chunk of result.stream) {
			if (chunk.candidates?.[0]?.content?.parts) {
				for (const part of chunk.candidates[0].content.parts) {
					if (part.text) {
						yield {
							type: "text",
							text: part.text,
						}
					}
				}
			}
		}
		const response = await result.response
		yield {
			type: "usage",
			inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
			outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
		}
	}
	async *createClaudeMessage(systemPrompt, messages) {
		const model = this.getModel()
		let { id, info, temperature, maxTokens, thinking } = model
		const useCache = model.info.supportsPromptCache
		// Find indices of user messages that we want to cache
		// We only cache the last two user messages to stay within the 4-block limit
		// (1 block for system + 1 block each for last two user messages = 3 total)
		const userMsgIndices = useCache
			? messages.reduce((acc, msg, i) => (msg.role === "user" ? [...acc, i] : acc), [])
			: []
		const lastUserMsgIndex = userMsgIndices[userMsgIndices.length - 1] ?? -1
		const secondLastMsgUserIndex = userMsgIndices[userMsgIndices.length - 2] ?? -1
		// Create the stream with appropriate caching configuration
		const params = {
			model: id,
			max_tokens: maxTokens,
			temperature,
			thinking,
			// Cache the system prompt if caching is enabled
			system: useCache
				? [
						{
							text: systemPrompt,
							type: "text",
							cache_control: { type: "ephemeral" },
						},
					]
				: systemPrompt,
			messages: messages.map((message, index) => {
				// Only cache the last two user messages
				const shouldCache = useCache && (index === lastUserMsgIndex || index === secondLastMsgUserIndex)
				return this.formatMessageForCache(message, shouldCache)
			}),
			stream: true,
		}
		const stream = await this.anthropicClient.messages.create(params)
		// Process the stream chunks
		for await (const chunk of stream) {
			switch (chunk.type) {
				case "message_start": {
					const usage = chunk.message.usage
					yield {
						type: "usage",
						inputTokens: usage.input_tokens || 0,
						outputTokens: usage.output_tokens || 0,
						cacheWriteTokens: usage.cache_creation_input_tokens,
						cacheReadTokens: usage.cache_read_input_tokens,
					}
					break
				}
				case "message_delta": {
					yield {
						type: "usage",
						inputTokens: 0,
						outputTokens: chunk.usage.output_tokens || 0,
					}
					break
				}
				case "content_block_start": {
					switch (chunk.content_block.type) {
						case "text": {
							if (chunk.index > 0) {
								yield {
									type: "text",
									text: "\n",
								}
							}
							yield {
								type: "text",
								text: chunk.content_block.text,
							}
							break
						}
						case "thinking": {
							if (chunk.index > 0) {
								yield {
									type: "reasoning",
									text: "\n",
								}
							}
							yield {
								type: "reasoning",
								text: chunk.content_block.thinking,
							}
							break
						}
					}
					break
				}
				case "content_block_delta": {
					switch (chunk.delta.type) {
						case "text_delta": {
							yield {
								type: "text",
								text: chunk.delta.text,
							}
							break
						}
						case "thinking_delta": {
							yield {
								type: "reasoning",
								text: chunk.delta.thinking,
							}
							break
						}
					}
					break
				}
			}
		}
	}
	async *createMessage(systemPrompt, messages) {
		switch (this.modelType) {
			case this.MODEL_CLAUDE: {
				yield* this.createClaudeMessage(systemPrompt, messages)
				break
			}
			case this.MODEL_GEMINI: {
				yield* this.createGeminiMessage(systemPrompt, messages)
				break
			}
			default: {
				throw new Error(`Invalid model type: ${this.modelType}`)
			}
		}
	}
	getModel() {
		const modelId = this.options.apiModelId
		let id = modelId && modelId in vertexModels ? modelId : vertexDefaultModelId
		const info = vertexModels[id]
		// The `:thinking` variant is a virtual identifier for thinking-enabled
		// models (similar to how it's handled in the Anthropic provider.)
		if (id.endsWith(":thinking")) {
			id = id.replace(":thinking", "")
		}
		return {
			id,
			info,
			...getModelParams({ options: this.options, model: info, defaultMaxTokens: ANTHROPIC_DEFAULT_MAX_TOKENS }),
		}
	}
	async completePromptGemini(prompt) {
		try {
			const model = this.geminiClient.getGenerativeModel({
				model: this.getModel().id,
			})
			const result = await model.generateContent({
				contents: [{ role: "user", parts: [{ text: prompt }] }],
				generationConfig: {
					temperature: this.options.modelTemperature ?? 0,
				},
			})
			let text = ""
			result.response.candidates?.forEach((candidate) => {
				candidate.content.parts.forEach((part) => {
					text += part.text
				})
			})
			return text
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Vertex completion error: ${error.message}`)
			}
			throw error
		}
	}
	async completePromptClaude(prompt) {
		try {
			let { id, info, temperature, maxTokens, thinking } = this.getModel()
			const useCache = info.supportsPromptCache
			const params = {
				model: id,
				max_tokens: maxTokens ?? ANTHROPIC_DEFAULT_MAX_TOKENS,
				temperature,
				thinking,
				system: "", // No system prompt needed for single completions
				messages: [
					{
						role: "user",
						content: useCache
							? [
									{
										type: "text",
										text: prompt,
										cache_control: { type: "ephemeral" },
									},
								]
							: prompt,
					},
				],
				stream: false,
			}
			const response = await this.anthropicClient.messages.create(params)
			const content = response.content[0]
			if (content.type === "text") {
				return content.text
			}
			return ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Vertex completion error: ${error.message}`)
			}
			throw error
		}
	}
	async completePrompt(prompt) {
		switch (this.modelType) {
			case this.MODEL_CLAUDE: {
				return this.completePromptClaude(prompt)
			}
			case this.MODEL_GEMINI: {
				return this.completePromptGemini(prompt)
			}
			default: {
				throw new Error(`Invalid model type: ${this.modelType}`)
			}
		}
	}
}
//# sourceMappingURL=vertex.js.map
