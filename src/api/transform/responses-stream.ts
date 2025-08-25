import type { ApiStreamChunk } from "./stream"

/**
 * Minimal, typed streaming handler for OpenAI/Azure Responses API streams.
 * Consumes an AsyncIterable of events and yields ApiStreamChunk items.
 *
 * Notes:
 * - We intentionally handle only the core, stable event shapes that we already
 *   use in openai-native, to keep the surface area small and predictable.
 * - If the event format changes, extend the type guards below conservatively.
 */
export async function* handleResponsesStream(
	stream: AsyncIterable<unknown>,
	options?: { onResponseId?: (id: string) => void },
): AsyncGenerator<ApiStreamChunk> {
	let lastUsage: ResponseUsage | undefined

	for await (const event of stream) {
		// Surface response.id to callers when available (for conversation continuity)
		if (isObject(event)) {
			const resp = (event as Record<string, unknown>).response as unknown
			if (isObject(resp)) {
				const rid = (resp as Record<string, unknown>).id
				if (typeof rid === "string") {
					options?.onResponseId?.(rid)
				}
			}
		}
		// 1) Streaming text deltas
		if (isTextDelta(event)) {
			const e = event as TextDeltaEvent
			if (e.delta != null) {
				yield { type: "text", text: String(e.delta) }
			}
			continue
		}

		// 2) Streaming reasoning deltas
		if (isReasoningDelta(event)) {
			const e = event as ReasoningDeltaEvent
			if (e.delta != null) {
				yield { type: "reasoning", text: String(e.delta) }
			}
			continue
		}

		// 2.1) Audio transcript deltas (map to text)
		if (isAudioTranscriptDelta(event)) {
			const e = event as AudioTranscriptDeltaEvent
			if (e.delta != null) {
				yield { type: "text", text: String(e.delta) }
			}
			continue
		}

		// 3) Refusal deltas (map to text with prefix, matching native handler behavior)
		if (isRefusalDelta(event)) {
			const e = event as RefusalDeltaEvent
			if (e.delta != null) {
				yield { type: "text", text: `[Refusal] ${String(e.delta)}` }
			}
			continue
		}

		// 4) Output-item added (alternative carrier for text/reasoning)
		if (isOutputItemAdded(event)) {
			const item = (event as OutputItemAddedEvent).item
			if (item) {
				if (item.type === "text" && typeof item.text === "string") {
					yield { type: "text", text: item.text }
				} else if (item.type === "reasoning" && typeof item.text === "string") {
					yield { type: "reasoning", text: item.text }
				} else if (item.type === "message" && Array.isArray(item.content)) {
					for (const content of item.content) {
						// Some servers use "text"; others use "output_text"
						if (
							(content?.type === "text" || content?.type === "output_text") &&
							typeof content?.text === "string"
						) {
							yield { type: "text", text: content.text }
						}
					}
				} else if (typeof item.text === "string") {
					// Fallback: emit item.text even if item.type is unknown (matches native handler tolerance)
					yield { type: "text", text: item.text }
				}
			}
			continue
		}

		// 4.1) Content part added (SDK alternative format)
		if (isContentPartAdded(event)) {
			const part = (event as ContentPartAddedEvent).part
			if (part && part.type === "text" && typeof part.text === "string") {
				yield { type: "text", text: part.text }
			}
			continue
		}

		// 5) Fallback: some implementations (or older shapes) supply choices[0].delta.content
		const content = getChoiceDeltaContent(event)
		if (content) {
			yield { type: "text", text: content }
		}

		// 6) Track usage whenever present
		const usage = extractUsage(event)
		if (usage) {
			lastUsage = usage
		}

		// 7) Completion/done events - emit usage if we have it
		if (isDoneEvent(event)) {
			const u = lastUsage
			if (u && hasAnyUsage(u)) {
				yield makeUsageChunk(u)
			}
		}
	}
}

/** Types, guards, and helpers */

type ResponseUsage = {
	input_tokens?: number
	output_tokens?: number
	prompt_tokens?: number
	completion_tokens?: number
	cache_creation_input_tokens?: number
	cache_read_input_tokens?: number
	prompt_tokens_details?: { cached_tokens?: number }
}

type TextDeltaEvent = {
	type: "response.text.delta" | "response.output_text.delta"
	delta?: unknown
}

type ReasoningDeltaEvent = {
	type:
		| "response.reasoning.delta"
		| "response.reasoning_text.delta"
		| "response.reasoning_summary.delta"
		| "response.reasoning_summary_text.delta"
	delta?: unknown
}

type RefusalDeltaEvent = {
	type: "response.refusal.delta"
	delta?: unknown
}

type OutputItemAddedEvent = {
	type: "response.output_item.added"
	item?: {
		type?: string
		text?: unknown
		content?: Array<{ type?: string; text?: unknown }>
	}
}

type DoneEvent = {
	type: "response.done" | "response.completed"
}

type AudioTranscriptDeltaEvent = {
	type: "response.audio_transcript.delta"
	delta?: unknown
}

type ContentPartAddedEvent = {
	type: "response.content_part.added"
	part?: {
		type?: string
		text?: unknown
	}
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null
}

function isTextDelta(event: unknown): event is TextDeltaEvent {
	return (
		isObject(event) &&
		typeof (event as Record<string, unknown>).type === "string" &&
		(((event as Record<string, unknown>).type as string) === "response.text.delta" ||
			((event as Record<string, unknown>).type as string) === "response.output_text.delta")
	)
}

function isReasoningDelta(event: unknown): event is ReasoningDeltaEvent {
	if (!isObject(event)) return false
	const t = (event as Record<string, unknown>).type
	return (
		t === "response.reasoning.delta" ||
		t === "response.reasoning_text.delta" ||
		t === "response.reasoning_summary.delta" ||
		t === "response.reasoning_summary_text.delta"
	)
}

function isRefusalDelta(event: unknown): event is RefusalDeltaEvent {
	return isObject(event) && (event as Record<string, unknown>).type === "response.refusal.delta"
}

function isOutputItemAdded(event: unknown): event is OutputItemAddedEvent {
	return isObject(event) && (event as Record<string, unknown>).type === "response.output_item.added"
}

function isAudioTranscriptDelta(event: unknown): event is AudioTranscriptDeltaEvent {
	return isObject(event) && (event as Record<string, unknown>).type === "response.audio_transcript.delta"
}

function isContentPartAdded(event: unknown): event is ContentPartAddedEvent {
	return isObject(event) && (event as Record<string, unknown>).type === "response.content_part.added"
}

function isDoneEvent(event: unknown): event is DoneEvent {
	if (!isObject(event)) return false
	const t = (event as Record<string, unknown>).type
	return t === "response.done" || t === "response.completed"
}

function getChoiceDeltaContent(event: unknown): string | undefined {
	if (!isObject(event)) return undefined
	const choices = (event as Record<string, unknown>).choices as unknown
	if (!Array.isArray(choices) || choices.length === 0) return undefined
	const first = choices[0] as unknown
	if (!isObject(first)) return undefined
	const delta = (first as Record<string, unknown>).delta as unknown
	if (!isObject(delta)) return undefined
	const content = (delta as Record<string, unknown>).content
	if (content == null) return undefined
	return String(content)
}

function extractUsage(event: unknown): ResponseUsage | undefined {
	if (!isObject(event)) return undefined
	const resp = (event as Record<string, unknown>).response as unknown
	if (isObject(resp) && isObject((resp as Record<string, unknown>).usage)) {
		return (resp as Record<string, unknown>).usage as ResponseUsage
	}
	const usage = (event as Record<string, unknown>).usage as unknown
	if (isObject(usage)) {
		return usage as ResponseUsage
	}
	return undefined
}

function hasAnyUsage(usage: ResponseUsage): boolean {
	return Boolean(usage.input_tokens || usage.output_tokens || usage.prompt_tokens || usage.completion_tokens)
}

function makeUsageChunk(usage: ResponseUsage): ApiStreamChunk {
	return {
		type: "usage",
		inputTokens: usage.input_tokens ?? usage.prompt_tokens ?? 0,
		outputTokens: usage.output_tokens ?? usage.completion_tokens ?? 0,
		cacheWriteTokens: usage.cache_creation_input_tokens ?? undefined,
		cacheReadTokens: usage.cache_read_input_tokens ?? usage.prompt_tokens_details?.cached_tokens ?? undefined,
	}
}
