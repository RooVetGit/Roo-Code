import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { type ModelInfo, openAiNativeDefaultModelId, OpenAiNativeModelId, openAiNativeModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import { calculateApiCostOpenAI } from "../../shared/cost"
import { getModelParams } from "../transform/model-params"
import { ApiStream } from "../transform/stream"
import { BaseProvider } from "./base-provider"
import type { ApiHandlerCreateMessageMetadata, SingleCompletionHandler } from "../index"

export type OpenAiNativeModel = ReturnType<OpenAiNativeHandler["getModel"]>

export class OpenAiNativeHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI
	private lastResponseId: string | undefined
	private conversationHistory: OpenAI.Responses.ResponseInputItem[] = []
	private encryptedArtifacts: Array<{ responseId: string; item: any }> = []

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		const apiKey = this.options.openAiNativeApiKey ?? "not-provided"
		this.client = new OpenAI({ baseURL: this.options.openAiNativeBaseUrl, apiKey })
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const model = this.getModel()
		// Per-call override: allow metadata to force stateless operation and suppression of continuity.
		const forceStateless = metadata?.forceStateless === true || metadata?.suppressPreviousResponseId === true
		const isStateless = forceStateless || (model as any).config.store === false

		// Format the provided messages once
		const formattedMessages = this.formatMessagesForResponsesAPI(messages)

		// Build request with dynamic, capability-aware params
		const requestBody: OpenAI.Responses.ResponseCreateParams = {
			model: model.id,
			stream: true,
			input: [], // will be set below
		}

		// Temperature support is model capability-driven; only include when allowed
		const allowTemperature = (model.info as any)?.supportsTemperature !== false
		if (allowTemperature && typeof (model as any).temperature === "number") {
			;(requestBody as any).temperature = (model as any).temperature
		}

		// Map reasoning effort from resolved params (settings > model default), and enable reasoning summary.
		// o-series and o1 models currently only support "medium" effort — clamp to avoid 400s from the API.
		let resolvedEffort = (model as any).reasoningEffort as any | undefined
		const isOSeries = typeof model.id === "string" && model.id.startsWith("o")
		const supportsSummary = (model.info as any)?.supportsReasoningSummary === true
		const reasoningCfg: any = {}

		if (isOSeries) {
			resolvedEffort = "medium"
		}

		if (resolvedEffort) reasoningCfg.effort = resolvedEffort
		// Always request a reasoning summary for models that support it (e.g., GPT-5 family, o-series)
		if (supportsSummary) reasoningCfg.summary = "auto"

		if (Object.keys(reasoningCfg).length > 0) {
			;(requestBody as any).reasoning = reasoningCfg
		}

		// Add text parameter with verbosity only if the current model supports it.
		// Prevents leaking a previously-selected verbosity (e.g. "low") into models that only allow "medium".
		if ((model.info as any)?.supportsVerbosity === true && model.verbosity) {
			;(requestBody as any).text = {
				format: { type: "text" },
				verbosity: model.verbosity,
			}
		}
		// If the model does not support verbosity, omit the `text.verbosity` entirely
		// to let the server default (typically "medium") apply.

		// Prefetch encrypted reasoning artifacts for reasoning-capable models so we can fall back to stateless if needed.
		// This does NOT change statefulness: we only send conversationHistory as input when stateless (store === false).
		const id = String(model.id || "")
		const supportsEncrypted = id.startsWith("gpt-5") || id.startsWith("o")
		if (supportsEncrypted) {
			const prevInclude = (requestBody as any).include
			const nextInclude = Array.isArray(prevInclude) ? prevInclude.slice() : []
			if (!nextInclude.includes("reasoning.encrypted_content")) nextInclude.push("reasoning.encrypted_content")
			;(requestBody as any).include = nextInclude
		}

		// Stateful vs stateless strategy (with metadata support)
		// Treat forceStateless as an instruction to also suppress previous_response_id.
		const suppressPrev = metadata?.suppressPreviousResponseId === true || forceStateless
		const prevIdFromMeta = !suppressPrev && !isStateless ? metadata?.previousResponseId : undefined
		const prevIdToUse =
			prevIdFromMeta ?? (this.lastResponseId && !suppressPrev && !isStateless ? this.lastResponseId : undefined)

		// Heuristic reset: if we appear to be at the start of a brand-new conversation (no prev id)
		// and only new user inputs are provided, avoid leaking prior outputs by clearing history.
		// Note: Do NOT clear in stateless mode; prior assistant outputs must be preserved for continuity.
		if (!prevIdToUse && !isStateless && this.conversationHistory.length > 0) {
			const onlyUserInputs =
				Array.isArray(formattedMessages) &&
				formattedMessages.length > 0 &&
				formattedMessages.every((m: any) => m?.role === "user")
			if (onlyUserInputs) {
				this.conversationHistory = []
				this.lastResponseId = undefined
			}
		}

		if (prevIdToUse) {
			// Incremental turn: use previous_response_id and send only the newest message(s)
			;(requestBody as any).previous_response_id = prevIdToUse
			// Ensure current instructions are applied on continuation turns
			;(requestBody as any).instructions = systemPrompt

			// Prefer the last user message as the incremental payload; if none, fall back to the last item.
			const lastUserIndex = (() => {
				for (let i = formattedMessages.length - 1; i >= 0; i--) {
					if ((formattedMessages[i] as any)?.role === "user") return i
				}
				return undefined
			})()
			const newMessages =
				lastUserIndex !== undefined ? [formattedMessages[lastUserIndex]!] : formattedMessages.slice(-1)

			// Defensive guard: if prev-id is present, we should never send more than one input item.
			if (Array.isArray(newMessages) && newMessages.length !== 1) {
			}

			requestBody.input =
				Array.isArray(newMessages) && newMessages.length > 1 ? newMessages.slice(-1) : newMessages
			this.conversationHistory.push(...(Array.isArray(requestBody.input) ? (requestBody.input as any[]) : []))
		} else {
			// First turn or stateless
			;(requestBody as any).instructions = systemPrompt

			if (isStateless) {
				// Stateless mode: include prior outputs (e.g., encrypted reasoning items) to preserve context across turns.
				// Only append NEW USER inputs for this turn; do not append assistant text (e.g., reasoning summaries)
				// because we rely on encrypted artifacts to preserve assistant-side continuity.
				// Ensure Responses API treats this as stateless per docs.
				;(requestBody as any).store = false
				const userOnly = Array.isArray(formattedMessages)
					? (formattedMessages as any[]).filter((i) => i?.role === "user")
					: formattedMessages
				this.conversationHistory.push(...(Array.isArray(userOnly) ? userOnly : [userOnly]))
				requestBody.input = this.conversationHistory
			} else {
				// Stateful mode (default): do NOT leak any prior outputs into the first request of a new conversation.
				// Send only the formatted user input; the server will manage state using previous_response_id on later turns.
				this.conversationHistory = []
				requestBody.input = formattedMessages
			}
		}

		let stream: AsyncIterable<OpenAI.Responses.ResponseStreamEvent>
		// Defensive retry guard: only retry "Previous response" 400s if we actually sent a previous_response_id
		const hadPrevId = (requestBody as any).previous_response_id !== undefined
		let didRetryPrevIdOnce = false
		try {
			const key = metadata?.promptCacheKey ?? (this.options as any).promptCacheKey
			if (typeof key === "string" && key.trim().length > 0) {
				;(requestBody as any).prompt_cache_key = key
			}

			stream = (await this.client.responses.create(
				requestBody,
			)) as AsyncIterable<OpenAI.Responses.ResponseStreamEvent>
		} catch (error: any) {
			// Handle invalid previous_response_id by retrying with full history
			// Only retry when we actually sent a previous_response_id AND we're in stateful mode (not stateless/forceStateless).
			if (
				error?.status === 400 &&
				error?.message?.includes("Previous response") &&
				hadPrevId &&
				!isStateless &&
				!suppressPrev &&
				!didRetryPrevIdOnce
			) {
				didRetryPrevIdOnce = true
				this.lastResponseId = undefined
				delete (requestBody as any).previous_response_id
				requestBody.input = this.conversationHistory

				stream = (await this.client.responses.create(
					requestBody,
				)) as AsyncIterable<OpenAI.Responses.ResponseStreamEvent>
			} else {
				throw error
			}
		}

		yield* this.processResponsesStream(stream, model)
	}

	private formatMessagesForResponsesAPI(
		messages: Anthropic.Messages.MessageParam[],
	): OpenAI.Responses.ResponseInputItem[] {
		const result: OpenAI.Responses.ResponseInputItem[] = []

		for (const message of messages) {
			if (message.role !== "user" && message.role !== "assistant") continue

			const role = message.role
			const parts: any[] = []

			const pushText = (txt: string) => {
				parts.push({
					type: role === "assistant" ? "output_text" : "input_text",
					text: txt,
				})
			}

			const pushImage = (url: string) => {
				// Only users provide input images to the model
				if (role === "user" && typeof url === "string" && url.length > 0) {
					parts.push({
						type: "input_image",
						image_url: url,
					})
				}
			}

			const content: any = (message as any).content
			if (typeof content === "string") {
				pushText(content)
			} else if (Array.isArray(content)) {
				for (const c of content) {
					if (typeof c === "string") {
						pushText(c)
					} else if (c && typeof c === "object") {
						// Text blocks
						if (c.type === "text" && typeof c.text === "string") {
							pushText(c.text)
							continue
						}
						// Image blocks: support base64 and URL sources
						if (c.type === "image" && c.source) {
							if (c.source.type === "base64" && c.source.media_type && c.source.data) {
								const dataUrl = `data:${c.source.media_type};base64,${c.source.data}`
								pushImage(dataUrl)
								continue
							}
							if (c.source.type === "url" && typeof c.source.url === "string") {
								pushImage(c.source.url)
								continue
							}
						}
						// Other modalities (files/audio) can be added later
					}
				}
			}

			result.push({ role, content: parts })
		}

		return result
	}

	private async *processResponsesStream(
		stream: AsyncIterable<OpenAI.Responses.ResponseStreamEvent>,
		model: OpenAiNativeModel,
	): ApiStream {
		let lastResponse: OpenAI.Responses.Response | undefined
		let emittedUsage = false

		let hadAnyOutput = false
		try {
			for await (const event of stream) {
				// filtered: removed noisy stream.event logs

				if (event.type === "response.output_text.delta") {
					// The OpenAI Responses API sends text directly in the 'delta' property
					const eventData = event as any
					const text = eventData.delta
					if (text) {
						// Support both string delta and { text } shape
						const out =
							typeof text === "string"
								? text
								: typeof text?.text === "string"
									? text.text
									: Array.isArray(text) && typeof text[0]?.text === "string"
										? text[0].text
										: ""
						// filtered: removed noisy text.delta log
						yield { type: "text", text: out }
						hadAnyOutput = true
					}
				} else if (
					event.type === "response.reasoning_summary.delta" ||
					(event as any).type === "response.reasoning_summary_text.delta"
				) {
					// Reasoning summary delta (streaming) — support both legacy and new event names
					const eventData = event as any
					const delta = eventData.delta
					if (delta !== undefined && delta !== null) {
						// Handle string, { text }, or array forms; also fallback to eventData.text
						const out =
							typeof delta === "string"
								? delta
								: typeof delta?.text === "string"
									? delta.text
									: Array.isArray(delta) && typeof delta[0]?.text === "string"
										? delta[0].text
										: typeof eventData?.text === "string"
											? eventData.text
											: Array.isArray(eventData?.text) &&
												  typeof eventData.text[0]?.text === "string"
												? eventData.text[0].text
												: ""
						// filtered: removed noisy reasoning.delta log
						yield { type: "reasoning", text: out }
						hadAnyOutput = true
					}
				} else if (
					event.type === "response.reasoning_summary.done" ||
					(event as any).type === "response.reasoning_summary_text.done"
				) {
					// Reasoning summary done — emit finalized summary if present (supports both legacy and new event names)
					const e: any = event
					const text =
						e.text ??
						e.delta ??
						e.summary?.text ??
						(e.summary && Array.isArray(e.summary) && e.summary[0]?.text) ??
						undefined
					if (text) {
						yield { type: "reasoning", text }
						hadAnyOutput = true
					}
				} else if (event.type === "response.completed") {
					lastResponse = event.response
					hadAnyOutput = true
					if (event.response.usage) {
						// Support multiple wire formats for cache + reasoning metrics:
						// - Responses API may return:
						//     usage.cache_read_input_tokens
						//     usage.cache_creation_input_tokens
						//     usage.input_tokens_details.cached_tokens
						//     usage.output_tokens_details.reasoning_tokens
						const usage: any = event.response.usage

						const cacheReadTokens =
							usage.cache_read_input_tokens ??
							usage.input_tokens_details?.cached_tokens ??
							usage.prompt_tokens_details?.cached_tokens // fallback for older/alt shapes

						const cacheWriteTokens =
							usage.cache_creation_input_tokens ?? usage.prompt_tokens_details?.caching_tokens // some proxies expose this

						const reasoningTokens = usage.output_tokens_details?.reasoning_tokens

						const totalCost = calculateApiCostOpenAI(
							model.info,
							usage.input_tokens,
							usage.output_tokens,
							cacheWriteTokens || 0,
							cacheReadTokens || 0,
						)

						yield {
							type: "usage",
							inputTokens: usage.input_tokens,
							outputTokens: usage.output_tokens,
							cacheWriteTokens,
							cacheReadTokens,
							// Surface reasoning token count when available (UI already supports this key in other providers)
							...(typeof reasoningTokens === "number" ? { reasoningTokens } : {}),
							totalCost,
						}
						emittedUsage = true
						hadAnyOutput = true
					}
				} else if (event.type === "response.created") {
					// Persist the response id as early as possible so lineage is available immediately
					const createdId = (event as any)?.response?.id
					if (typeof createdId === "string") {
						this.lastResponseId = createdId
					}
				} else if (event.type === "response.incomplete") {
					// no-op
				} else if ((event as any).type === "response.cancelled") {
					// no-op
				} else if ((event as any).type === "response.error") {
					// Leave handling to try/catch
				} else {
					// Catch any other events so we can spot unexpected variants
					try {
						const keys = Object.keys(event as any)
						// no-op; reserved for debugging
					} catch {}
				}
			}
		} catch (err: any) {
			// Swallow late/spurious errors if we've already produced output or completed,
			// only propagate when nothing was emitted (first-chunk failure) and it's not an abort.
			const isAbort =
				(err && (err.name === "AbortError" || /abort|cancell?ed/i.test(String(err.message || err)))) || false
			if (!hadAnyOutput && !emittedUsage && !lastResponse && !isAbort) {
				throw err
			}
			// Otherwise swallow to avoid spurious "API Streaming Failed" after success.
		}

		// Usage fallback: If streaming did not include usage, retrieve by ID once
		if (lastResponse && emittedUsage === false) {
			try {
				const retrieved = await this.client.responses.retrieve(lastResponse.id)
				const usage: any = (retrieved as any)?.usage
				if (usage) {
					const cacheReadTokens =
						usage.cache_read_input_tokens ??
						usage.input_tokens_details?.cached_tokens ??
						usage.prompt_tokens_details?.cached_tokens

					const cacheWriteTokens =
						usage.cache_creation_input_tokens ?? usage.prompt_tokens_details?.caching_tokens

					const reasoningTokens = usage.output_tokens_details?.reasoning_tokens

					const totalCost = calculateApiCostOpenAI(
						model.info,
						usage.input_tokens,
						usage.output_tokens,
						cacheWriteTokens || 0,
						cacheReadTokens || 0,
					)

					yield {
						type: "usage",
						inputTokens: usage.input_tokens,
						outputTokens: usage.output_tokens,
						cacheWriteTokens,
						cacheReadTokens,
						...(typeof reasoningTokens === "number" ? { reasoningTokens } : {}),
						totalCost,
					}
				}
			} catch {}
		}

		if (lastResponse) {
			this.lastResponseId = lastResponse.id
			this.conversationHistory.push(...(lastResponse.output as any))

			// Capture the paired encrypted reasoning artifact for this assistant turn (if present)
			try {
				const outputs: any[] = Array.isArray((lastResponse as any).output)
					? ((lastResponse as any).output as any[])
					: []
				const hasEncrypted = (obj: any): boolean => {
					try {
						if (!obj || typeof obj !== "object") return false
						if (Object.prototype.hasOwnProperty.call(obj, "encrypted_content")) return true
						for (const v of Object.values(obj)) {
							if (typeof v === "object" && v !== null && hasEncrypted(v)) return true
						}
						return false
					} catch {
						return false
					}
				}
				let found: any | undefined
				for (const item of outputs) {
					if (hasEncrypted(item)) {
						found = item
						break
					}
				}
				if (found) {
					this.encryptedArtifacts.push({ responseId: this.lastResponseId!, item: found })
				}
			} catch {}
		}
	}

	override getModel() {
		const modelId = this.options.apiModelId
		const id =
			modelId && modelId in openAiNativeModels ? (modelId as OpenAiNativeModelId) : openAiNativeDefaultModelId
		const info: ModelInfo = openAiNativeModels[id]

		const params = getModelParams({
			format: "openai",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: info.defaultTemperature,
		})

		return {
			id,
			info,
			...params,
			config: this.options,
		}
	}

	public getLastResponseId(): string | undefined {
		return this.lastResponseId
	}

	// Snapshot provider state needed to resume stateless flows (encrypted reasoning content + lineage)
	public getPersistentState(): {
		lastResponseId?: string
		conversationHistory: OpenAI.Responses.ResponseInputItem[]
		encryptedArtifacts?: Array<{ responseId: string; item: any }>
	} {
		return {
			lastResponseId: this.lastResponseId,
			conversationHistory: this.conversationHistory,
			encryptedArtifacts: this.encryptedArtifacts,
		}
	}

	// Restore provider state for stateless continuation
	public restorePersistentState(state?: {
		lastResponseId?: string
		conversationHistory?: OpenAI.Responses.ResponseInputItem[]
		encryptedArtifacts?: Array<{ responseId: string; item: any }>
	}): void {
		if (!state) return
		this.lastResponseId = state.lastResponseId
		if (Array.isArray(state.conversationHistory)) {
			this.conversationHistory = state.conversationHistory
		}
		if (Array.isArray(state.encryptedArtifacts)) {
			this.encryptedArtifacts = state.encryptedArtifacts as any
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		throw new Error("completePrompt is not supported for OpenAI Native models. Use createMessage instead.")
	}
}
