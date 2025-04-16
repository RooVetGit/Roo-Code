import OpenAI, { AzureOpenAI } from "openai"
import axios from "axios"
import { azureOpenAiDefaultApiVersion, openAiModelInfoSaneDefaults } from "../../shared"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { convertToR1Format } from "../transform/r1-format"
import { convertToSimpleMessages } from "../transform/simple-format"
import { BaseProvider } from "./base-provider"
import { XmlMatcher } from "../../utils/xml-matcher"
import { DEEP_SEEK_DEFAULT_TEMPERATURE } from "./constants"
export const defaultHeaders = {
	"HTTP-Referer": "https://github.com/RooVetGit/Roo-Cline",
	"X-Title": "Roo Code",
}
const AZURE_AI_INFERENCE_PATH = "/models/chat/completions"
export class OpenAiHandler extends BaseProvider {
	options
	client
	constructor(options) {
		super()
		this.options = options
		const baseURL = this.options.openAiBaseUrl ?? "https://api.openai.com/v1"
		const apiKey = this.options.openAiApiKey ?? "not-provided"
		const isAzureAiInference = this._isAzureAiInference(this.options.openAiBaseUrl)
		const urlHost = this._getUrlHost(this.options.openAiBaseUrl)
		const isAzureOpenAi = urlHost === "azure.com" || urlHost.endsWith(".azure.com") || options.openAiUseAzure
		if (isAzureAiInference) {
			// Azure AI Inference Service (e.g., for DeepSeek) uses a different path structure
			this.client = new OpenAI({
				baseURL,
				apiKey,
				defaultHeaders,
				defaultQuery: { "api-version": this.options.azureApiVersion || "2024-05-01-preview" },
			})
		} else if (isAzureOpenAi) {
			// Azure API shape slightly differs from the core API shape:
			// https://github.com/openai/openai-node?tab=readme-ov-file#microsoft-azure-openai
			this.client = new AzureOpenAI({
				baseURL,
				apiKey,
				apiVersion: this.options.azureApiVersion || azureOpenAiDefaultApiVersion,
				defaultHeaders: {
					...defaultHeaders,
					...(this.options.openAiHostHeader ? { Host: this.options.openAiHostHeader } : {}),
				},
			})
		} else {
			this.client = new OpenAI({
				baseURL,
				apiKey,
				defaultHeaders: {
					...defaultHeaders,
					...(this.options.openAiHostHeader ? { Host: this.options.openAiHostHeader } : {}),
				},
			})
		}
	}
	async *createMessage(systemPrompt, messages) {
		const modelInfo = this.getModel().info
		const modelUrl = this.options.openAiBaseUrl ?? ""
		const modelId = this.options.openAiModelId ?? ""
		const enabledR1Format = this.options.openAiR1FormatEnabled ?? false
		const enabledLegacyFormat = this.options.openAiLegacyFormat ?? false
		const isAzureAiInference = this._isAzureAiInference(modelUrl)
		const urlHost = this._getUrlHost(modelUrl)
		const deepseekReasoner = modelId.includes("deepseek-reasoner") || enabledR1Format
		const ark = modelUrl.includes(".volces.com")
		if (modelId.startsWith("o3-mini")) {
			yield* this.handleO3FamilyMessage(modelId, systemPrompt, messages)
			return
		}
		if (this.options.openAiStreamingEnabled ?? true) {
			let systemMessage = {
				role: "system",
				content: systemPrompt,
			}
			let convertedMessages
			if (deepseekReasoner) {
				convertedMessages = convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])
			} else if (ark || enabledLegacyFormat) {
				convertedMessages = [systemMessage, ...convertToSimpleMessages(messages)]
			} else {
				if (modelInfo.supportsPromptCache) {
					systemMessage = {
						role: "system",
						content: [
							{
								type: "text",
								text: systemPrompt,
								// @ts-ignore-next-line
								cache_control: { type: "ephemeral" },
							},
						],
					}
				}
				convertedMessages = [systemMessage, ...convertToOpenAiMessages(messages)]
				if (modelInfo.supportsPromptCache) {
					// Note: the following logic is copied from openrouter:
					// Add cache_control to the last two user messages
					// (note: this works because we only ever add one user message at a time, but if we added multiple we'd need to mark the user message before the last assistant message)
					const lastTwoUserMessages = convertedMessages.filter((msg) => msg.role === "user").slice(-2)
					lastTwoUserMessages.forEach((msg) => {
						if (typeof msg.content === "string") {
							msg.content = [{ type: "text", text: msg.content }]
						}
						if (Array.isArray(msg.content)) {
							// NOTE: this is fine since env details will always be added at the end. but if it weren't there, and the user added a image_url type message, it would pop a text part before it and then move it after to the end.
							let lastTextPart = msg.content.filter((part) => part.type === "text").pop()
							if (!lastTextPart) {
								lastTextPart = { type: "text", text: "..." }
								msg.content.push(lastTextPart)
							}
							// @ts-ignore-next-line
							lastTextPart["cache_control"] = { type: "ephemeral" }
						}
					})
				}
			}
			const isGrokXAI = this._isGrokXAI(this.options.openAiBaseUrl)
			const requestOptions = {
				model: modelId,
				temperature: this.options.modelTemperature ?? (deepseekReasoner ? DEEP_SEEK_DEFAULT_TEMPERATURE : 0),
				messages: convertedMessages,
				stream: true,
				...(isGrokXAI ? {} : { stream_options: { include_usage: true } }),
				reasoning_effort: this.getModel().info.reasoningEffort,
			}
			if (this.options.includeMaxTokens) {
				requestOptions.max_tokens = modelInfo.maxTokens
			}
			const stream = await this.client.chat.completions.create(
				requestOptions,
				isAzureAiInference ? { path: AZURE_AI_INFERENCE_PATH } : {},
			)
			const matcher = new XmlMatcher("think", (chunk) => ({
				type: chunk.matched ? "reasoning" : "text",
				text: chunk.data,
			}))
			let lastUsage
			for await (const chunk of stream) {
				const delta = chunk.choices[0]?.delta ?? {}
				if (delta.content) {
					for (const chunk of matcher.update(delta.content)) {
						yield chunk
					}
				}
				if ("reasoning_content" in delta && delta.reasoning_content) {
					yield {
						type: "reasoning",
						text: delta.reasoning_content || "",
					}
				}
				if (chunk.usage) {
					lastUsage = chunk.usage
				}
			}
			for (const chunk of matcher.final()) {
				yield chunk
			}
			if (lastUsage) {
				yield this.processUsageMetrics(lastUsage, modelInfo)
			}
		} else {
			// o1 for instance doesnt support streaming, non-1 temp, or system prompt
			const systemMessage = {
				role: "user",
				content: systemPrompt,
			}
			const requestOptions = {
				model: modelId,
				messages: deepseekReasoner
					? convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])
					: enabledLegacyFormat
						? [systemMessage, ...convertToSimpleMessages(messages)]
						: [systemMessage, ...convertToOpenAiMessages(messages)],
			}
			const response = await this.client.chat.completions.create(
				requestOptions,
				this._isAzureAiInference(modelUrl) ? { path: AZURE_AI_INFERENCE_PATH } : {},
			)
			yield {
				type: "text",
				text: response.choices[0]?.message.content || "",
			}
			yield this.processUsageMetrics(response.usage, modelInfo)
		}
	}
	processUsageMetrics(usage, modelInfo) {
		return {
			type: "usage",
			inputTokens: usage?.prompt_tokens || 0,
			outputTokens: usage?.completion_tokens || 0,
			cacheWriteTokens: usage?.cache_creation_input_tokens || undefined,
			cacheReadTokens: usage?.cache_read_input_tokens || undefined,
		}
	}
	getModel() {
		return {
			id: this.options.openAiModelId ?? "",
			info: this.options.openAiCustomModelInfo ?? openAiModelInfoSaneDefaults,
		}
	}
	async completePrompt(prompt) {
		try {
			const isAzureAiInference = this._isAzureAiInference(this.options.openAiBaseUrl)
			const requestOptions = {
				model: this.getModel().id,
				messages: [{ role: "user", content: prompt }],
			}
			const response = await this.client.chat.completions.create(
				requestOptions,
				isAzureAiInference ? { path: AZURE_AI_INFERENCE_PATH } : {},
			)
			return response.choices[0]?.message.content || ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`OpenAI completion error: ${error.message}`)
			}
			throw error
		}
	}
	async *handleO3FamilyMessage(modelId, systemPrompt, messages) {
		if (this.options.openAiStreamingEnabled ?? true) {
			const methodIsAzureAiInference = this._isAzureAiInference(this.options.openAiBaseUrl)
			const isGrokXAI = this._isGrokXAI(this.options.openAiBaseUrl)
			const stream = await this.client.chat.completions.create(
				{
					model: modelId,
					messages: [
						{
							role: "developer",
							content: `Formatting re-enabled\n${systemPrompt}`,
						},
						...convertToOpenAiMessages(messages),
					],
					stream: true,
					...(isGrokXAI ? {} : { stream_options: { include_usage: true } }),
					reasoning_effort: this.getModel().info.reasoningEffort,
				},
				methodIsAzureAiInference ? { path: AZURE_AI_INFERENCE_PATH } : {},
			)
			yield* this.handleStreamResponse(stream)
		} else {
			const requestOptions = {
				model: modelId,
				messages: [
					{
						role: "developer",
						content: `Formatting re-enabled\n${systemPrompt}`,
					},
					...convertToOpenAiMessages(messages),
				],
			}
			const methodIsAzureAiInference = this._isAzureAiInference(this.options.openAiBaseUrl)
			const response = await this.client.chat.completions.create(
				requestOptions,
				methodIsAzureAiInference ? { path: AZURE_AI_INFERENCE_PATH } : {},
			)
			yield {
				type: "text",
				text: response.choices[0]?.message.content || "",
			}
			yield this.processUsageMetrics(response.usage)
		}
	}
	async *handleStreamResponse(stream) {
		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta
			if (delta?.content) {
				yield {
					type: "text",
					text: delta.content,
				}
			}
			if (chunk.usage) {
				yield {
					type: "usage",
					inputTokens: chunk.usage.prompt_tokens || 0,
					outputTokens: chunk.usage.completion_tokens || 0,
				}
			}
		}
	}
	_getUrlHost(baseUrl) {
		try {
			return new URL(baseUrl ?? "").host
		} catch (error) {
			return ""
		}
	}
	_isGrokXAI(baseUrl) {
		const urlHost = this._getUrlHost(baseUrl)
		return urlHost.includes("x.ai")
	}
	_isAzureAiInference(baseUrl) {
		const urlHost = this._getUrlHost(baseUrl)
		return urlHost.endsWith(".services.ai.azure.com")
	}
}
export async function getOpenAiModels(baseUrl, apiKey, hostHeader) {
	try {
		if (!baseUrl) {
			return []
		}
		if (!URL.canParse(baseUrl)) {
			return []
		}
		const config = {}
		const headers = {}
		if (apiKey) {
			headers["Authorization"] = `Bearer ${apiKey}`
		}
		if (hostHeader) {
			headers["Host"] = hostHeader
		}
		if (Object.keys(headers).length > 0) {
			config["headers"] = headers
		}
		const response = await axios.get(`${baseUrl}/models`, config)
		const modelsArray = response.data?.data?.map((model) => model.id) || []
		return [...new Set(modelsArray)]
	} catch (error) {
		return []
	}
}
//# sourceMappingURL=openai.js.map
