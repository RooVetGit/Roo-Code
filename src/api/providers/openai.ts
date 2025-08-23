import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI, { AzureOpenAI } from "openai"
import axios from "axios"

import {
	type ModelInfo,
	azureOpenAiDefaultApiVersion,
	openAiModelInfoSaneDefaults,
	DEEP_SEEK_DEFAULT_TEMPERATURE,
	OPENAI_AZURE_AI_INFERENCE_PATH,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { XmlMatcher } from "../../utils/xml-matcher"

import { convertToOpenAiMessages } from "../transform/openai-format"
import { convertToR1Format } from "../transform/r1-format"
import { convertToSimpleMessages } from "../transform/simple-format"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { getApiRequestTimeout } from "./utils/timeout-config"

// TODO: Rename this to OpenAICompatibleHandler. Also, I think the
// `OpenAINativeHandler` can subclass from this, since it's obviously
// compatible with the OpenAI API. We can also rename it to `OpenAIHandler`.
export class OpenAiHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		// Normalize Azure Responses "web" URL shape if provided by users.
		// Example input (Azure portal sometimes shows):
		//   https://{resource}.openai.azure.com/openai/responses?api-version=2025-04-01-preview
		// We normalize to Azure SDK-friendly base and version:
		//   baseURL: https://{resource}.openai.azure.com/openai/v1
		//   apiVersion: preview
		const rawBaseURL = this.options.openAiBaseUrl ?? "https://api.openai.com/v1"
		const azureNormalization = this._normalizeAzureResponsesBaseUrlAndVersion(rawBaseURL)
		const baseURL = azureNormalization.baseURL
		const apiKey = this.options.openAiApiKey ?? "not-provided"
		const isAzureAiInference = this._isAzureAiInference(baseURL)
		const urlHost = this._getUrlHost(baseURL)
		const isAzureOpenAi = urlHost === "azure.com" || urlHost.endsWith(".azure.com") || options.openAiUseAzure

		const headers = {
			...DEFAULT_HEADERS,
			...(this.options.openAiHeaders || {}),
		}

		const timeout = getApiRequestTimeout()

		if (isAzureAiInference) {
			// Azure AI Inference Service (e.g., for DeepSeek) uses a different path structure
			this.client = new OpenAI({
				baseURL,
				apiKey,
				defaultHeaders: headers,
				defaultQuery: { "api-version": this.options.azureApiVersion || "2024-05-01-preview" },
				timeout,
			})
		} else if (isAzureOpenAi) {
			// Azure API shape slightly differs from the core API shape:
			// https://github.com/openai/openai-node?tab=readme-ov-file#microsoft-azure-openai

			// Determine if we're using the Responses API flavor for Azure (auto-detect by URL only)
			const flavor = this._resolveApiFlavor(this.options.openAiBaseUrl ?? "")
			const isResponsesFlavor =
				flavor === "responses" ||
				this._isAzureOpenAiResponses(this.options.openAiBaseUrl) ||
				this._isAzureOpenAiResponses(baseURL)

			// Always use 'preview' for Azure Responses API calls (per user requirement)
			const azureVersion = isResponsesFlavor
				? "preview"
				: this.options.azureApiVersion || azureOpenAiDefaultApiVersion

			this.client = new AzureOpenAI({
				baseURL,
				apiKey,
				apiVersion: azureVersion,
				defaultHeaders: headers,
				timeout,
			})
		} else {
			this.client = new OpenAI({
				baseURL,
				apiKey,
				defaultHeaders: headers,
				timeout,
			})
		}
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		// Gather model params (centralized: temperature, max tokens, reasoning, verbosity)
		const modelParams = this.getModel()
		const {
			info: modelInfo,
			reasoning,
			reasoningEffort,
			verbosity,
		} = modelParams as unknown as {
			id: string
			info: ModelInfo
			reasoning?: { reasoning_effort?: "low" | "medium" | "high" }
			reasoningEffort?: "minimal" | "low" | "medium" | "high"
			verbosity?: "low" | "medium" | "high"
		}

		const modelUrl = this.options.openAiBaseUrl ?? ""
		const modelId = this.options.openAiModelId ?? ""
		const enabledR1Format = this.options.openAiR1FormatEnabled ?? false
		const enabledLegacyFormat = this.options.openAiLegacyFormat ?? false
		const isAzureAiInference = this._isAzureAiInference(modelUrl)
		const deepseekReasoner = modelId.includes("deepseek-reasoner") || enabledR1Format
		const ark = modelUrl.includes(".volces.com")

		// Decide API flavor (auto-detect by URL)
		const flavor = this._resolveApiFlavor(modelUrl)

		// If Responses API is selected, use the Responses payload and endpoint
		if (flavor === "responses") {
			const nonStreaming = !(this.options.openAiStreamingEnabled ?? true)

			// Build Responses payload (align with OpenAI Native Responses API formatting)
			const formattedInput = this._formatResponsesInput(systemPrompt, messages)
			const payload: Record<string, unknown> = {
				model: modelId,
				input: formattedInput,
			}

			// Reasoning effort (Responses expects: reasoning: { effort })
			if (this.options.enableReasoningEffort && (this.options.reasoningEffort || reasoningEffort)) {
				const effort = (this.options.reasoningEffort || reasoningEffort) as
					| "minimal"
					| "low"
					| "medium"
					| "high"
					| undefined
				// If effort is set and not "minimal" (minimal is treated as "no explicit effort")
				if (effort && effort !== "minimal") {
					payload.reasoning = { effort }
				}
			}

			// Temperature (only include when explicitly set by the user)
			if (this.options.modelTemperature !== undefined) {
				payload.temperature = this.options.modelTemperature
			} else if (deepseekReasoner) {
				payload.temperature = DEEP_SEEK_DEFAULT_TEMPERATURE
			}

			// Verbosity: include via text.verbosity (Responses API expectation per openai-native handler)
			if (this.options.verbosity || verbosity) {
				;(payload as any).text = { verbosity: this.options.verbosity || verbosity }
			}

			// Add max_output_tokens if requested (Azure Responses naming)
			if (this.options.includeMaxTokens === true) {
				payload.max_output_tokens = this.options.modelMaxTokens || modelInfo.maxTokens
			}

			// NOTE: Streaming for Responses API isn't covered by current tests.
			// We call non-streaming for now to preserve stable behavior.
			try {
				const response: any = await (this.client as any).responses.create(payload)
				yield* this._yieldResponsesResult(response, modelInfo)
			} catch (err: unknown) {
				// Graceful downgrade if verbosity is rejected by server (400 unknown/unsupported parameter)
				if ((payload as any).text && this._isVerbosityUnsupportedError(err)) {
					// Remove text.verbosity and retry once
					const { text: _omit, ...withoutVerbosity } = payload as any
					const response: any = await (this.client as any).responses.create(withoutVerbosity)
					yield* this._yieldResponsesResult(response, modelInfo)
				} else {
					throw err
				}
			}
			return
		}

		if (modelId.includes("o1") || modelId.includes("o3") || modelId.includes("o4")) {
			yield* this.handleO3FamilyMessage(modelId, systemPrompt, messages)
			return
		}

		if (this.options.openAiStreamingEnabled ?? true) {
			let systemMessage: OpenAI.Chat.ChatCompletionSystemMessageParam = {
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

			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
				model: modelId,
				messages: convertedMessages,
				stream: true as const,
				...(isGrokXAI ? {} : { stream_options: { include_usage: true } }),
				...(reasoning && reasoning),
			}

			// Only include temperature if explicitly set
			if (this.options.modelTemperature !== undefined) {
				requestOptions.temperature = this.options.modelTemperature
			} else if (deepseekReasoner) {
				// DeepSeek Reasoner has a specific default temperature
				requestOptions.temperature = DEEP_SEEK_DEFAULT_TEMPERATURE
			}

			// Add max_tokens if needed
			this.addMaxTokensIfNeeded(requestOptions, modelInfo)

			const stream = await this.client.chat.completions.create(
				requestOptions,
				isAzureAiInference ? { path: OPENAI_AZURE_AI_INFERENCE_PATH } : {},
			)

			const matcher = new XmlMatcher(
				"think",
				(chunk) =>
					({
						type: chunk.matched ? "reasoning" : "text",
						text: chunk.data,
					}) as const,
			)

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
						text: (delta.reasoning_content as string | undefined) || "",
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
			const systemMessage: OpenAI.Chat.ChatCompletionUserMessageParam = {
				role: "user",
				content: systemPrompt,
			}

			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
				model: modelId,
				messages: deepseekReasoner
					? convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])
					: enabledLegacyFormat
						? [systemMessage, ...convertToSimpleMessages(messages)]
						: [systemMessage, ...convertToOpenAiMessages(messages)],
			}
			// Include reasoning_effort for Chat Completions when available
			if (reasoning) {
				Object.assign(requestOptions, reasoning)
			}

			// Add max_tokens if needed
			this.addMaxTokensIfNeeded(requestOptions, modelInfo)

			const response = await this.client.chat.completions.create(
				requestOptions,
				this._isAzureAiInference(modelUrl) ? { path: OPENAI_AZURE_AI_INFERENCE_PATH } : {},
			)

			yield {
				type: "text",
				text: response.choices[0]?.message.content || "",
			}

			yield this.processUsageMetrics(response.usage, modelInfo)
		}
	}

	protected processUsageMetrics(usage: any, _modelInfo?: ModelInfo): ApiStreamUsageChunk {
		return {
			type: "usage",
			inputTokens: usage?.prompt_tokens || 0,
			outputTokens: usage?.completion_tokens || 0,
			cacheWriteTokens: usage?.cache_creation_input_tokens || undefined,
			cacheReadTokens: usage?.cache_read_input_tokens || undefined,
		}
	}

	override getModel() {
		const id = this.options.openAiModelId ?? ""
		const info = this.options.openAiCustomModelInfo ?? openAiModelInfoSaneDefaults
		const params = getModelParams({ format: "openai", modelId: id, model: info, settings: this.options })
		return { id, info, ...params }
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const isAzureAiInference = this._isAzureAiInference(this.options.openAiBaseUrl)
			const flavor = this._resolveApiFlavor(this.options.openAiBaseUrl ?? "")
			const model = this.getModel()
			const modelInfo = model.info

			// Use Responses API when selected (non-streaming convenience method)
			if (flavor === "responses") {
				// Build a single-turn formatted string input (Developer/User style) for Responses API
				const formattedInput = this._formatResponsesSingleMessage(
					{
						role: "user",
						content: [{ type: "text", text: prompt }] as any,
					} as Anthropic.Messages.MessageParam,
					/*includeRole*/ true,
				)
				const payload: Record<string, unknown> = {
					model: model.id,
					input: formattedInput,
				}

				// Reasoning effort (Responses)
				const effort = (this.options.reasoningEffort || (model as any).reasoningEffort) as
					| "minimal"
					| "low"
					| "medium"
					| "high"
					| undefined
				if (this.options.enableReasoningEffort && effort && effort !== "minimal") {
					payload.reasoning = { effort }
				}

				// Temperature if set
				if (this.options.modelTemperature !== undefined) {
					payload.temperature = this.options.modelTemperature
				}

				// Verbosity via text.verbosity
				if (this.options.verbosity) {
					;(payload as any).text = { verbosity: this.options.verbosity }
				}

				// max_output_tokens
				if (this.options.includeMaxTokens === true) {
					payload.max_output_tokens = this.options.modelMaxTokens || modelInfo.maxTokens
				}

				try {
					const response: any = await (this.client as any).responses.create(payload)
					return this._extractResponsesText(response) ?? ""
				} catch (err: unknown) {
					if ((payload as any).text && this._isVerbosityUnsupportedError(err)) {
						const { text: _omit, ...withoutVerbosity } = payload as any
						const response: any = await (this.client as any).responses.create(withoutVerbosity)
						return this._extractResponsesText(response) ?? ""
					}
					throw err
				}
			}

			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
				model: model.id,
				messages: [{ role: "user", content: prompt }],
			}

			// Add max_tokens if needed
			this.addMaxTokensIfNeeded(requestOptions, modelInfo)

			const response = await this.client.chat.completions.create(
				requestOptions,
				isAzureAiInference ? { path: OPENAI_AZURE_AI_INFERENCE_PATH } : {},
			)

			return response.choices[0]?.message.content || ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`OpenAI completion error: ${error.message}`)
			}

			throw error
		}
	}

	private async *handleO3FamilyMessage(
		modelId: string,
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
	): ApiStream {
		const modelInfo = this.getModel().info
		const methodIsAzureAiInference = this._isAzureAiInference(this.options.openAiBaseUrl)

		if (this.options.openAiStreamingEnabled ?? true) {
			const isGrokXAI = this._isGrokXAI(this.options.openAiBaseUrl)

			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
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
				reasoning_effort: modelInfo.reasoningEffort as "low" | "medium" | "high" | undefined,
				temperature: undefined,
			}

			// O3 family models do not support the deprecated max_tokens parameter
			// but they do support max_completion_tokens (the modern OpenAI parameter)
			// This allows O3 models to limit response length when includeMaxTokens is enabled
			this.addMaxTokensIfNeeded(requestOptions, modelInfo)

			const stream = await this.client.chat.completions.create(
				requestOptions,
				methodIsAzureAiInference ? { path: OPENAI_AZURE_AI_INFERENCE_PATH } : {},
			)

			yield* this.handleStreamResponse(stream)
		} else {
			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
				model: modelId,
				messages: [
					{
						role: "developer",
						content: `Formatting re-enabled\n${systemPrompt}`,
					},
					...convertToOpenAiMessages(messages),
				],
				reasoning_effort: modelInfo.reasoningEffort as "low" | "medium" | "high" | undefined,
				temperature: undefined,
			}

			// O3 family models do not support the deprecated max_tokens parameter
			// but they do support max_completion_tokens (the modern OpenAI parameter)
			// This allows O3 models to limit response length when includeMaxTokens is enabled
			this.addMaxTokensIfNeeded(requestOptions, modelInfo)

			const response = await this.client.chat.completions.create(
				requestOptions,
				methodIsAzureAiInference ? { path: OPENAI_AZURE_AI_INFERENCE_PATH } : {},
			)

			yield {
				type: "text",
				text: response.choices[0]?.message.content || "",
			}
			yield this.processUsageMetrics(response.usage)
		}
	}

	private async *handleStreamResponse(stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>): ApiStream {
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

	private _getUrlHost(baseUrl?: string): string {
		try {
			return new URL(baseUrl ?? "").host
		} catch (error) {
			return ""
		}
	}

	private _isGrokXAI(baseUrl?: string): boolean {
		const urlHost = this._getUrlHost(baseUrl)
		return urlHost.includes("x.ai")
	}

	private _isAzureAiInference(baseUrl?: string): boolean {
		const urlHost = this._getUrlHost(baseUrl)
		return urlHost.endsWith(".services.ai.azure.com")
	}

	private _isAzureOpenAiResponses(baseUrl?: string): boolean {
		try {
			if (!baseUrl) return false
			const u = new URL(baseUrl)
			const host = u.host
			const path = u.pathname.replace(/\/+$/, "")
			if (!(host.endsWith(".openai.azure.com") || host === "openai.azure.com")) return false
			return (
				path.endsWith("/openai/v1/responses") ||
				path.endsWith("/openai/responses") ||
				path.endsWith("/responses")
			)
		} catch {
			return false
		}
	}

	/**
	 * Normalize Azure "responses" portal URLs to SDK-friendly base and version.
	 * - Input (portal sometimes shows): https://{res}.openai.azure.com/openai/responses?api-version=2025-04-01-preview
	 * - Output: baseURL=https://{res}.openai.azure.com/openai/v1, apiVersionOverride="preview"
	 * No-op for already-correct or non-Azure URLs.
	 */
	private _normalizeAzureResponsesBaseUrlAndVersion(inputBaseUrl: string): {
		baseURL: string
		apiVersionOverride?: string
	} {
		try {
			const url = new URL(inputBaseUrl)
			const isAzureHost = url.hostname.endsWith(".openai.azure.com") || url.hostname === "openai.azure.com"
			const pathname = (url.pathname || "").replace(/\/+$/, "")

			// 1) Azure portal "non-v1" shape:
			//    https://{res}.openai.azure.com/openai/responses?api-version=2025-04-01-preview
			const isPortalNonV1 =
				isAzureHost &&
				pathname === "/openai/responses" &&
				url.searchParams.get("api-version") === "2025-04-01-preview"

			if (isPortalNonV1) {
				const normalized = `${url.protocol}//${url.host}/openai/v1`
				const ver = "preview"
				return { baseURL: normalized, apiVersionOverride: ver }
			}

			// 2) v1 responses path passed as base URL:
			//    https://{res}.openai.azure.com/openai/v1/responses?api-version=preview
			// Normalize base to '/openai/v1' and force apiVersion 'preview' for Azure Responses v1 preview.
			const isV1ResponsesPath = isAzureHost && pathname === "/openai/v1/responses"
			if (isV1ResponsesPath) {
				const normalized = `${url.protocol}//${url.host}/openai/v1`
				const ver = "preview"
				return { baseURL: normalized, apiVersionOverride: ver }
			}

			// If it's already '/openai/v1' or any other valid path, keep as-is
			return { baseURL: inputBaseUrl }
		} catch {
			return { baseURL: inputBaseUrl }
		}
	}

	/**
	 * Adds max_completion_tokens to the request body if needed based on provider configuration
	 * Note: max_tokens is deprecated in favor of max_completion_tokens as per OpenAI documentation
	 * O3 family models handle max_tokens separately in handleO3FamilyMessage
	 */
	private addMaxTokensIfNeeded(
		requestOptions:
			| OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming
			| OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
		modelInfo: ModelInfo,
	): void {
		// Only add max_completion_tokens if includeMaxTokens is true
		if (this.options.includeMaxTokens === true) {
			// Use user-configured modelMaxTokens if available, otherwise fall back to model's default maxTokens
			// Using max_completion_tokens as max_tokens is deprecated
			requestOptions.max_completion_tokens = this.options.modelMaxTokens || modelInfo.maxTokens
		}
	}

	// --- Responses helpers ---

	private _resolveApiFlavor(baseUrl: string): "responses" | "chat" {
		// Auto-detect by URL path
		const url = this._safeParseUrl(baseUrl)
		const path = url?.pathname || ""
		if (path.includes("/v1/responses") || path.endsWith("/responses")) {
			return "responses"
		}
		if (path.includes("/chat/completions")) {
			return "chat"
		}
		// Default to Chat Completions for backward compatibility
		return "chat"
	}

	private _safeParseUrl(input?: string): URL | undefined {
		try {
			if (!input) return undefined
			return new URL(input)
		} catch {
			return undefined
		}
	}

	private _toResponsesInput(anthropicMessages: Anthropic.Messages.MessageParam[]): Array<{
		role: "user" | "assistant"
		content: Array<{ type: "input_text"; text: string } | { type: "input_image"; image_url: string }>
	}> {
		const input: Array<{
			role: "user" | "assistant"
			content: Array<{ type: "input_text"; text: string } | { type: "input_image"; image_url: string }>
		}> = []

		for (const msg of anthropicMessages) {
			const role = msg.role === "assistant" ? "assistant" : "user"
			const parts: Array<{ type: "input_text"; text: string } | { type: "input_image"; image_url: string }> = []

			if (typeof msg.content === "string") {
				if (msg.content.length > 0) {
					parts.push({ type: "input_text", text: msg.content })
				}
			} else {
				for (const block of msg.content) {
					if (block.type === "text") {
						parts.push({ type: "input_text", text: block.text })
					} else if (block.type === "image") {
						parts.push({
							type: "input_image",
							image_url: `data:${block.source.media_type};base64,${block.source.data}`,
						})
					}
					// tool_use/tool_result are omitted in this minimal mapping (can be added as needed)
				}
			}

			if (parts.length > 0) {
				input.push({ role, content: parts })
			}
		}
		return input
	}

	private _extractResponsesText(response: any): string | undefined {
		// Prefer the simple output_text if present, otherwise attempt to parse output array
		if (response?.output_text) return response.output_text
		if (Array.isArray(response?.output)) {
			// Find assistant message with output_text
			for (const item of response.output) {
				if (item?.type === "message" && Array.isArray(item.content)) {
					const textPart = item.content.find(
						(c: any) => c.type === "output_text" && typeof c.text === "string",
					)
					if (textPart?.text) return textPart.text
				}
			}
		}
		return undefined
	}

	private async *_yieldResponsesResult(response: any, modelInfo: ModelInfo): ApiStream {
		const text = this._extractResponsesText(response) ?? ""
		if (text) {
			yield { type: "text", text }
		}
		// Translate usage fields if present
		const usage = response?.usage
		if (usage) {
			yield {
				type: "usage",
				inputTokens: usage.input_tokens || usage.prompt_tokens || 0,
				outputTokens: usage.output_tokens || usage.completion_tokens || 0,
				cacheWriteTokens: usage.cache_creation_input_tokens || undefined,
				cacheReadTokens: usage.cache_read_input_tokens || undefined,
			}
		}
	}

	private _isVerbosityUnsupportedError(err: unknown): boolean {
		const anyErr = err as any
		const msg = (anyErr?.message || "").toString().toLowerCase()
		const status = anyErr?.status
		return (
			status === 400 &&
			(msg.includes("verbosity") || msg.includes("unknown parameter") || msg.includes("unsupported"))
		)
	}

	// ---- Responses input formatting (align with openai-native.ts) ----

	private _formatResponsesInput(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): string {
		// Developer role for system prompt
		let formattedInput = `Developer: ${systemPrompt}\n\n`
		for (const message of messages) {
			const role = message.role === "user" ? "User" : "Assistant"
			if (typeof message.content === "string") {
				formattedInput += `${role}: ${message.content}\n\n`
			} else if (Array.isArray(message.content)) {
				const textContent = message.content
					.filter((block) => (block as any).type === "text")
					.map((block) => (block as any).text as string)
					.join("\n")
				if (textContent) {
					formattedInput += `${role}: ${textContent}\n\n`
				}
			}
		}
		return formattedInput.trim()
	}

	private _formatResponsesSingleMessage(
		message: Anthropic.Messages.MessageParam,
		includeRole: boolean = true,
	): string {
		const role = includeRole ? (message.role === "user" ? "User" : "Assistant") + ": " : ""
		if (typeof message.content === "string") {
			return `${role}${message.content}`
		}
		if (Array.isArray(message.content)) {
			const textContent = message.content
				.filter((block) => (block as any).type === "text")
				.map((block) => (block as any).text as string)
				.join("\n")
			return `${role}${textContent}`
		}
		return role
	}
}

export async function getOpenAiModels(baseUrl?: string, apiKey?: string, openAiHeaders?: Record<string, string>) {
	try {
		if (!baseUrl) {
			return []
		}

		// Trim whitespace from baseUrl to handle cases where users accidentally include spaces
		const trimmedBaseUrl = baseUrl.trim()

		if (!URL.canParse(trimmedBaseUrl)) {
			return []
		}

		const config: Record<string, any> = {}
		const headers: Record<string, string> = {
			...DEFAULT_HEADERS,
			...(openAiHeaders || {}),
		}

		if (apiKey) {
			headers["Authorization"] = `Bearer ${apiKey}`
		}

		if (Object.keys(headers).length > 0) {
			config["headers"] = headers
		}

		const response = await axios.get(`${trimmedBaseUrl}/models`, config)
		const modelsArray = response.data?.data?.map((model: any) => model.id) || []
		return [...new Set<string>(modelsArray)]
	} catch (error) {
		return []
	}
}
