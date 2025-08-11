import type { Anthropic } from "@anthropic-ai/sdk"
import { promises as fs } from "node:fs"
import * as os from "os"
import * as path from "path"
import OpenAI from "openai"

import type { ModelInfo, QwenCodeModelId } from "@roo-code/types"
import { qwenCodeDefaultModelId, qwenCodeModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import { t } from "../../i18n"
import { convertToOpenAiMessages } from "../transform/openai-format"
import type { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { BaseProvider } from "./base-provider"
import { DEFAULT_HEADERS } from "./constants"

// --- Constants from qwenOAuth2.js ---

const QWEN_OAUTH_BASE_URL = "https://chat.qwen.ai"
const QWEN_OAUTH_TOKEN_ENDPOINT = `${QWEN_OAUTH_BASE_URL}/api/v1/oauth2/token`
const QWEN_OAUTH_CLIENT_ID = "f0304373b74a44d2b584a3fb70ca9e56"
const QWEN_DIR = ".qwen"
const QWEN_CREDENTIAL_FILENAME = "oauth_creds.json"

interface QwenOAuthCredentials {
	access_token: string
	refresh_token: string
	token_type: string
	expiry_date: number
	resource_url?: string
}

function getQwenCachedCredentialPath(customPath?: string): string {
	if (customPath) {
		return path.resolve(customPath)
	}
	return path.join(os.homedir(), QWEN_DIR, QWEN_CREDENTIAL_FILENAME)
}

function objectToUrlEncoded(data: Record<string, string>): string {
	return Object.keys(data)
		.map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
		.join("&")
}

export class QwenCodeHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private credentials: QwenOAuthCredentials | null = null
	private client: OpenAI | null = null
	private pendingThinkingContent: string = ""

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
	}

	private processContentChunk(content: string): { text: string; reasoning: string } {
		// Accumulate content to handle incomplete thinking tags
		this.pendingThinkingContent += content

		let processedText = ""
		let reasoningText = ""

		// Handle complete thinking blocks
		const thinkingRegex = /<thinking>([\s\S]*?)<\/thinking>/g
		let match
		let lastIndex = 0

		while ((match = thinkingRegex.exec(this.pendingThinkingContent)) !== null) {
			// Add text before thinking block
			processedText += this.pendingThinkingContent.slice(lastIndex, match.index)
			// Extract thinking content
			reasoningText += match[1]
			lastIndex = match.index + match[0].length
		}

		// Handle remaining content after last complete thinking block
		const remainingContent = this.pendingThinkingContent.slice(lastIndex)

		// Check if we have an incomplete thinking tag
		const incompleteThinkingMatch = remainingContent.match(/<think>(?![\s\S]*<\/think>)([\s\S]*)$/)
		if (incompleteThinkingMatch) {
			// Keep incomplete thinking content for next chunk
			this.pendingThinkingContent = remainingContent
		} else {
			// No incomplete thinking, add to processed text and clear pending
			processedText += remainingContent
			this.pendingThinkingContent = ""
		}

		// Filter out malformed thinking tags like <th, <thi, etc.
		processedText = processedText.replace(/<th(?:i(?:n(?:k(?:i(?:n(?:g)?)?)?)?)?)?(?![a-zA-Z])/g, "")

		return { text: processedText, reasoning: reasoningText }
	}

	private async loadCachedQwenCredentials(): Promise<QwenOAuthCredentials> {
		try {
			const keyFile = getQwenCachedCredentialPath(this.options.qwenCodeOAuthPath)
			const credsStr = await fs.readFile(keyFile, "utf-8")
			return JSON.parse(credsStr)
		} catch (error) {
			console.error(
				`Error reading or parsing credentials file at ${getQwenCachedCredentialPath(this.options.qwenCodeOAuthPath)}`,
			)
			throw new Error(t("common:errors.qwenCode.oauthLoadFailed", { error }))
		}
	}

	private async refreshAccessToken(credentials: QwenOAuthCredentials): Promise<QwenOAuthCredentials> {
		if (!credentials.refresh_token) {
			throw new Error("No refresh token available in credentials.")
		}

		const bodyData = {
			grant_type: "refresh_token",
			refresh_token: credentials.refresh_token,
			client_id: QWEN_OAUTH_CLIENT_ID,
		}

		const response = await fetch(QWEN_OAUTH_TOKEN_ENDPOINT, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Accept: "application/json",
			},
			body: objectToUrlEncoded(bodyData),
		})

		if (!response.ok) {
			const errorText = await response.text()
			throw new Error(`Token refresh failed: ${response.status} ${response.statusText}. Response: ${errorText}`)
		}

		const tokenData = await response.json()

		if (tokenData.error) {
			throw new Error(`Token refresh failed: ${tokenData.error} - ${tokenData.error_description}`)
		}

		const newCredentials = {
			...credentials,
			access_token: tokenData.access_token,
			token_type: tokenData.token_type,
			refresh_token: tokenData.refresh_token || credentials.refresh_token,
			expiry_date: Date.now() + tokenData.expires_in * 1000,
		}

		const filePath = getQwenCachedCredentialPath()
		await fs.writeFile(filePath, JSON.stringify(newCredentials, null, 2))
		console.log("Successfully refreshed and cached new credentials.")

		return newCredentials
	}

	private isTokenValid(credentials: QwenOAuthCredentials): boolean {
		const TOKEN_REFRESH_BUFFER_MS = 30 * 1000 // 30s buffer
		if (!credentials.expiry_date) {
			return false
		}
		return Date.now() < credentials.expiry_date - TOKEN_REFRESH_BUFFER_MS
	}

	private async ensureAuthenticated(): Promise<void> {
		if (!this.credentials) {
			this.credentials = await this.loadCachedQwenCredentials()
		}

		if (!this.isTokenValid(this.credentials)) {
			this.credentials = await this.refreshAccessToken(this.credentials)
		}

		if (!this.client || this.client.apiKey !== this.credentials.access_token) {
			this.setupClient()
		}
	}

	private getBaseUrl(creds: QwenOAuthCredentials): string {
		let baseUrl = creds.resource_url || "https://dashscope.aliyuncs.com/compatible-mode/v1"
		if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
			baseUrl = `https://${baseUrl}`
		}
		return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`
	}

	private setupClient(): void {
		if (!this.credentials) {
			throw new Error("Credentials not loaded.")
		}
		const headers = { ...DEFAULT_HEADERS }

		this.client = new OpenAI({
			apiKey: this.credentials.access_token,
			baseURL: this.getBaseUrl(this.credentials),
			defaultHeaders: headers,
		})
	}

	private async callApiWithRetry<T>(apiCall: () => Promise<T>): Promise<T> {
		try {
			return await apiCall()
		} catch (error: any) {
			if (error.status === 401) {
				console.log("Authentication failed. Forcing token refresh and retrying...")
				this.credentials = await this.refreshAccessToken(this.credentials!)
				this.setupClient()
				return await apiCall()
			} else {
				throw error
			}
		}
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		await this.ensureAuthenticated()

		const { id: modelId, info: modelInfo } = this.getModel()

		const systemMessage: OpenAI.Chat.ChatCompletionSystemMessageParam = {
			role: "system",
			content: systemPrompt,
		}

		const convertedMessages = [systemMessage, ...convertToOpenAiMessages(messages)]

		const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model: modelId,
			temperature: this.options.modelTemperature ?? 0,
			messages: convertedMessages,
			stream: true,
			stream_options: { include_usage: true },
		}

		if (this.options.includeMaxTokens) {
			requestOptions.max_tokens = this.options.modelMaxTokens || modelInfo.maxTokens
		}

		const stream = await this.callApiWithRetry(() => this.client!.chat.completions.create(requestOptions))

		let lastUsage: any

		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta ?? {}

			// Handle reasoning content separately (if present)
			if (delta && "reasoning_content" in delta && delta.reasoning_content) {
				yield {
					type: "reasoning",
					text: delta.reasoning_content as string,
				}
			}

			// Handle regular content with thinking processing
			if (delta.content) {
				const { text, reasoning } = this.processContentChunk(delta.content)

				// Yield reasoning content if any
				if (reasoning.trim()) {
					yield {
						type: "reasoning",
						text: reasoning,
					}
				}

				// Yield regular text content if any
				if (text.trim()) {
					yield {
						type: "text",
						text: text,
					}
				}
			}

			if (chunk.usage) {
				lastUsage = chunk.usage
			}
		}

		// Handle any remaining pending thinking content at the end
		if (this.pendingThinkingContent.trim()) {
			// If there's incomplete thinking content, treat it as regular text
			const cleanedContent = this.pendingThinkingContent.replace(
				/<th(?:i(?:n(?:k(?:i(?:n(?:g)?)?)?)?)?)?(?![a-zA-Z])/g,
				"",
			)
			if (cleanedContent.trim()) {
				yield {
					type: "text",
					text: cleanedContent,
				}
			}
			this.pendingThinkingContent = ""
		}

		if (lastUsage) {
			yield this.processUsageMetrics(lastUsage, modelInfo)
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		await this.ensureAuthenticated()

		const { id: modelId, info: modelInfo } = this.getModel()

		const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
			model: modelId,
			messages: [{ role: "user", content: prompt }],
		}

		if (this.options.includeMaxTokens) {
			requestOptions.max_tokens = this.options.modelMaxTokens || modelInfo.maxTokens
		}

		const response = await this.callApiWithRetry(() => this.client!.chat.completions.create(requestOptions))

		let content = response.choices[0]?.message.content || ""

		// Clean up any thinking content from non-streaming response
		content = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, "")
		content = content.replace(/<th(?:i(?:n(?:k(?:i(?:n(?:g)?)?)?)?)?)?(?![a-zA-Z])/g, "")

		return content.trim()
	}

	override getModel() {
		const modelId = this.options.apiModelId
		const id = modelId && modelId in qwenCodeModels ? (modelId as QwenCodeModelId) : qwenCodeDefaultModelId
		const info: ModelInfo = qwenCodeModels[id]
		const params = getModelParams({ format: "openai", modelId: id, model: info, settings: this.options })

		return { id, info, ...params }
	}

	protected processUsageMetrics(usage: any, _modelInfo?: ModelInfo): ApiStreamUsageChunk {
		return {
			type: "usage",
			inputTokens: usage?.prompt_tokens || 0,
			outputTokens: usage?.completion_tokens || 0,
		}
	}
}
