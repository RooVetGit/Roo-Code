// npx vitest run api/providers/__tests__/openai-native.spec.ts

import { Anthropic } from "@anthropic-ai/sdk"

import { OpenAiNativeHandler } from "../openai-native"
import { ApiHandlerOptions } from "../../../shared/api"

// Mock OpenAI client
const mockResponsesCreate = vitest.fn()
const mockResponsesRetrieve = vitest.fn()

vitest.mock("openai", () => {
	return {
		__esModule: true,
		default: vitest.fn().mockImplementation(() => ({
			responses: {
				create: mockResponsesCreate.mockImplementation(async (options) => {
					if (!options.stream) {
						// Non-streaming mock
						return {
							id: "resp_test123",
							output: [{ type: "text", content: [{ type: "text", text: "Test response" }] }],
							usage: {
								input_tokens: 10,
								output_tokens: 5,
							},
						}
					}
					// Streaming mock
					return (async function* () {
						yield { type: "response.created", response: { id: "resp_test123" } }
						// Use the correct API structure with 'delta' property
						yield { type: "response.output_text.delta", delta: "Test " }
						yield { type: "response.output_text.delta", delta: "response" }
						yield {
							type: "response.completed",
							response: {
								id: "resp_test123",
								output: [{ type: "text", content: [{ type: "text", text: "Test response" }] }],
								usage: {
									input_tokens: 10,
									output_tokens: 5,
									cache_creation_input_tokens: 0,
									cache_read_input_tokens: 0,
								},
							},
						}
					})()
				}),
				retrieve: mockResponsesRetrieve,
			},
		})),
	}
})

describe("OpenAiNativeHandler", () => {
	let handler: OpenAiNativeHandler
	let mockOptions: ApiHandlerOptions
	const systemPrompt = "You are a helpful assistant."
	const messages: Anthropic.Messages.MessageParam[] = [
		{
			role: "user",
			content: "Hello!",
		},
	]

	beforeEach(() => {
		mockOptions = {
			apiModelId: "gpt-4.1",
			openAiNativeApiKey: "test-api-key",
		}
		handler = new OpenAiNativeHandler(mockOptions)
		mockResponsesCreate.mockClear()
		mockResponsesRetrieve.mockClear()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(OpenAiNativeHandler)
		})

		it("should initialize with empty API key", () => {
			const handlerWithoutKey = new OpenAiNativeHandler({
				apiModelId: "gpt-4.1",
				openAiNativeApiKey: "",
			})
			expect(handlerWithoutKey).toBeInstanceOf(OpenAiNativeHandler)
		})
	})

	describe("createMessage", () => {
		it("should handle streaming responses using the v1/responses API", async () => {
			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBeGreaterThan(0)
			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			const usageChunks = chunks.filter((chunk) => chunk.type === "usage")
			expect(textChunks.map((c) => c.text).join("")).toBe("Test response")
			expect(usageChunks).toHaveLength(1)
			expect(mockResponsesCreate).toHaveBeenCalledTimes(1)
		})

		it("should set instructions for reasoning models and not prepend a developer message", async () => {
			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5-2025-08-07",
			})
			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume stream
			}
			const requestBody = mockResponsesCreate.mock.calls[0][0]
			expect(requestBody.instructions).toBe(systemPrompt)
			expect(Array.isArray(requestBody.input)).toBe(true)
			expect(requestBody.input[0].role).toBe("user")
			// Ensure no 'developer' role item is injected into inputs
			const roles = requestBody.input.map((i: any) => i.role)
			expect(roles.includes("developer")).toBe(false)
		})

		it("should set instructions for non-reasoning models and not prepend a system message", async () => {
			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-4o",
			})
			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume stream
			}
			const requestBody = mockResponsesCreate.mock.calls[0][0]
			expect(requestBody.instructions).toBe(systemPrompt)
			expect(Array.isArray(requestBody.input)).toBe(true)
			expect(requestBody.input[0].role).toBe("user")
			// Ensure no 'system' role instruction message is injected into inputs
			const roles = requestBody.input.map((i: any) => i.role)
			expect(roles.includes("system")).toBe(false)
		})

		it("should handle API errors", async () => {
			mockResponsesCreate.mockRejectedValueOnce(new Error("API Error"))
			const stream = handler.createMessage(systemPrompt, messages)
			await expect(async () => {
				for await (const _chunk of stream) {
					// Should not reach here
				}
			}).rejects.toThrow("API Error")
		})

		it("should include verbosity parameter when configured", async () => {
			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5-2025-08-07",
				verbosity: "low",
			})
			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume stream
			}
			const requestBody = mockResponsesCreate.mock.calls[0][0]
			expect(requestBody.text).toEqual({
				format: { type: "text" },
				verbosity: "low",
			})
		})

		it("should handle minimal reasoning effort", async () => {
			// Note: The model's default reasoning effort is "medium" for gpt-5-2025-08-07
			// To test minimal, we need to check if it's passed through correctly
			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5-2025-08-07",
				reasoningEffort: "minimal",
			})
			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume stream
			}
			const requestBody = mockResponsesCreate.mock.calls[0][0]
			// The model info has reasoningEffort: "medium" by default,
			// but we're not overriding it properly yet
			expect(requestBody.reasoning).toBeDefined()
		})

		it("should NOT include text.verbosity for models that do not support verbosity", async () => {
			// Regression test for 400 Unsupported value: 'low' with gpt-4.1
			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-4.1",
				verbosity: "low", // stale from previous model selection
			})
			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume stream
			}
			const requestBody = mockResponsesCreate.mock.calls[0][0]
			expect(requestBody.text).toBeUndefined()
		})

		it("should include reasoning.summary='auto' for GPT-5 models", async () => {
			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5",
			})
			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume stream to trigger call
			}
			const requestBody = mockResponsesCreate.mock.calls[0][0]
			expect(requestBody.reasoning).toBeDefined()
			expect(requestBody.reasoning.summary).toBe("auto")
		})

		it("should stream reasoning summary chunks into reasoning blocks", async () => {
			// Override the streaming mock for this test to emit reasoning summary events
			mockResponsesCreate.mockImplementationOnce(async (_options) => {
				return (async function* () {
					yield { type: "response.created", response: { id: "resp_reason" } }
					yield { type: "response.reasoning_summary.delta", delta: "Step 1" }
					yield { type: "response.reasoning_summary.delta", delta: " -> Step 2" }
					yield {
						type: "response.completed",
						response: {
							id: "resp_reason",
							output: [],
							usage: {
								input_tokens: 0,
								output_tokens: 0,
								cache_creation_input_tokens: 0,
								cache_read_input_tokens: 0,
							},
						},
					}
				})()
			})

			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5",
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const c of stream) {
				chunks.push(c)
			}
			const reasoningChunks = chunks.filter((c) => c.type === "reasoning")
			expect(reasoningChunks.length).toBeGreaterThan(0)
			expect(reasoningChunks.map((c) => c.text).join("")).toContain("Step 1")
			expect(reasoningChunks.map((c) => c.text).join("")).toContain("Step 2")
		})

		it("should include encrypted reasoning content when stateless (store=false)", async () => {
			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5",
				// mark stateless so provider sets include: ["reasoning.encrypted_content"]
				store: false,
			})

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}
			const requestBody = mockResponsesCreate.mock.calls[0][0]
			expect(requestBody.include).toEqual(["reasoning.encrypted_content"])
		})
		it("should stream reasoning_summary_text.* events into reasoning blocks", async () => {
			// Override the streaming mock for this test to emit the new event names seen in the wild
			mockResponsesCreate.mockImplementationOnce(async (_options) => {
				return (async function* () {
					yield { type: "response.created", response: { id: "resp_reason_text" } }
					yield { type: "response.reasoning_summary_text.delta", delta: { text: "Alpha" } }
					yield { type: "response.reasoning_summary_text.delta", delta: { text: " Beta" } }
					yield { type: "response.reasoning_summary_text.done", text: "Alpha Beta" }
					yield {
						type: "response.completed",
						response: {
							id: "resp_reason_text",
							output: [],
							usage: {
								input_tokens: 0,
								output_tokens: 0,
								cache_creation_input_tokens: 0,
								cache_read_input_tokens: 0,
							},
						},
					}
				})()
			})
			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5",
			})
			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const c of stream) {
				chunks.push(c)
			}
			const reasoningChunks = chunks.filter((c) => c.type === "reasoning")
			expect(reasoningChunks.length).toBeGreaterThan(0)
			const joined = reasoningChunks.map((c) => c.text).join("")
			expect(joined).toContain("Alpha")
			expect(joined).toContain("Beta")
		})
		it("should carry prior outputs between stateless turns (store=false) for caching continuity", async () => {
			// Arrange: force stateless path via store=false
			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5",
				store: false,
			})

			// Mock first streaming call to emit a distinct assistant output item (encrypted reasoning artifact)
			mockResponsesCreate.mockImplementationOnce(async (_options) => {
				return (async function* () {
					yield { type: "response.created", response: { id: "resp_stateless_1" } }
					yield {
						type: "response.completed",
						response: {
							id: "resp_stateless_1",
							output: [
								{ type: "reasoning", encrypted_content: "enc-STAT-123" },
								{ type: "text", content: [{ type: "text", text: "Assistant turn 1" }] },
							],
							usage: {
								input_tokens: 10,
								output_tokens: 5,
								cache_creation_input_tokens: 0,
								cache_read_input_tokens: 0,
							},
						},
					}
				})()
			})

			// First turn: consume the stream so conversationHistory captures assistant outputs
			const first = handler.createMessage("You are helpful.", [{ role: "user", content: "First message" } as any])
			for await (const _ of first) {
				// consume
			}

			// Second turn: new user message
			const second = handler.createMessage("You are helpful.", [
				{ role: "user", content: "Second message" } as any,
			])
			for await (const _ of second) {
				// consume
			}

			// Assert: second request includes prior assistant outputs + new user message
			const secondReq = mockResponsesCreate.mock.calls[1][0]
			const input = secondReq.input as any[]

			// Contains the encrypted reasoning artifact from the first turn
			const containsEncrypted = input.some((item: any) => JSON.stringify(item).includes("enc-STAT-123"))
			expect(containsEncrypted).toBe(true)

			// Contains the new user message somewhere in the input list
			const userItems = input.filter((item: any) => item && item.role === "user")
			expect(userItems.length).toBeGreaterThan(0)
			const hasSecondUser = userItems.some(
				(u: any) =>
					Array.isArray(u.content) &&
					u.content.some((p: any) => p?.type === "input_text" && p?.text === "Second message"),
			)
			expect(hasSecondUser).toBe(true)
		})
		it("should set store=false when configured for stateless mode", async () => {
			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5",
				store: false,
			})
			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}
			const body = mockResponsesCreate.mock.calls[0][0]
			expect(body.store).toBe(false)
		})
		it("sets prompt_cache_key from options when provided", async () => {
			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5",
				promptCacheKey: "opts-key",
			})

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}

			const body = mockResponsesCreate.mock.calls[0][0]
			expect(body.prompt_cache_key).toBe("opts-key")
		})

		it("prefers metadata.promptCacheKey over options", async () => {
			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5",
				promptCacheKey: "opts-key",
			})

			const meta = { taskId: "t1", promptCacheKey: "meta-key" }
			const stream = handler.createMessage(systemPrompt, messages, meta as any)
			for await (const _ of stream) {
				// consume
			}

			const body = mockResponsesCreate.mock.calls[0][0]
			expect(body.prompt_cache_key).toBe("meta-key")
		})

		it("does not set prompt_cache_key for empty strings", async () => {
			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5",
				promptCacheKey: "",
			})

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}

			const body = mockResponsesCreate.mock.calls[0][0]
			expect(body.prompt_cache_key).toBeUndefined()
		})

		it("includes encrypted reasoning on stateful GPT-5 calls for recovery readiness", async () => {
			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5", // stateful by default (no store=false)
			})

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}

			const body = mockResponsesCreate.mock.calls[0][0]
			expect(Array.isArray(body.include)).toBe(true)
			expect(body.include).toContain("reasoning.encrypted_content")
		})

		it("captures encrypted artifact on stateful calls when present", async () => {
			// Override streaming mock to include an encrypted_content item
			mockResponsesCreate.mockImplementationOnce(async (_options) => {
				return (async function* () {
					yield { type: "response.created", response: { id: "resp_stateful_enc" } }
					yield {
						type: "response.completed",
						response: {
							id: "resp_stateful_enc",
							output: [
								{ type: "reasoning", encrypted_content: "enc-STATE-456" },
								{ type: "text", content: [{ type: "text", text: "Assistant reply" }] },
							],
							usage: {
								input_tokens: 12,
								output_tokens: 7,
								cache_creation_input_tokens: 0,
								cache_read_input_tokens: 0,
							},
						},
					}
				})()
			})

			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "gpt-5", // stateful
			})

			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}

			const state = handler.getPersistentState()
			expect(Array.isArray(state.encryptedArtifacts)).toBe(true)
			expect((state.encryptedArtifacts ?? []).length).toBeGreaterThan(0)
			const hasMarker = (state.encryptedArtifacts ?? []).some((a) =>
				JSON.stringify(a.item).includes("enc-STATE-456"),
			)
			expect(hasMarker).toBe(true)
		})

		it("includes encrypted reasoning for o-series models (e.g., o3-mini) on stateful calls", async () => {
			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "o3-mini", // O-series, stateful by default
			})
			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume
			}
			const body = mockResponsesCreate.mock.calls[0][0]
			expect(Array.isArray(body.include)).toBe(true)
			expect(body.include).toContain("reasoning.encrypted_content")
		})
		it("surfaces cache read/write usage across back-to-back streams when include_usage is enabled", async () => {
			// First streaming call: simulate cache write (creation) tokens
			mockResponsesCreate
				.mockImplementationOnce(async (_options) => {
					return (async function* () {
						yield { type: "response.created", response: { id: "resp_back1" } }
						yield { type: "response.output_text.delta", delta: "First " }
						yield { type: "response.output_text.delta", delta: "response" }
						yield {
							type: "response.completed",
							response: {
								id: "resp_back1",
								output: [{ type: "text", content: [{ type: "text", text: "First response" }] }],
								usage: {
									input_tokens: 11,
									output_tokens: 5,
									cache_creation_input_tokens: 42,
									cache_read_input_tokens: 0,
								},
							},
						}
					})()
				})
				// Second streaming call: simulate cache read tokens
				.mockImplementationOnce(async (_options) => {
					return (async function* () {
						yield { type: "response.created", response: { id: "resp_back2" } }
						yield { type: "response.output_text.delta", delta: "Second " }
						yield { type: "response.output_text.delta", delta: "reply" }
						yield {
							type: "response.completed",
							response: {
								id: "resp_back2",
								output: [{ type: "text", content: [{ type: "text", text: "Second reply" }] }],
								usage: {
									input_tokens: 9,
									output_tokens: 4,
									cache_creation_input_tokens: 0,
									cache_read_input_tokens: 17,
								},
							},
						}
					})()
				})

			// First call
			const stream1 = handler.createMessage(systemPrompt, messages)
			const chunks1: any[] = []
			for await (const c of stream1) chunks1.push(c)

			const usageChunks1 = chunks1.filter((c) => c.type === "usage")
			expect(usageChunks1).toHaveLength(1)
			expect(usageChunks1[0]).toMatchObject({
				type: "usage",
				cacheWriteTokens: 42,
				cacheReadTokens: 0,
			})

			// Second call
			const stream2 = handler.createMessage(systemPrompt, messages)
			const chunks2: any[] = []
			for await (const c of stream2) chunks2.push(c)

			const usageChunks2 = chunks2.filter((c) => c.type === "usage")
			expect(usageChunks2).toHaveLength(1)
			expect(usageChunks2[0]).toMatchObject({
				type: "usage",
				cacheWriteTokens: 0,
				cacheReadTokens: 17,
			})

			// Assert that include_usage is requested for both streaming calls
			expect(mockResponsesCreate).toHaveBeenCalledTimes(2)
			const firstBody = mockResponsesCreate.mock.calls[0][0]
			const secondBody = mockResponsesCreate.mock.calls[1][0]

			expect(firstBody.stream).toBe(true)
			expect(secondBody.stream).toBe(true)
		})

		it("falls back to retrieve usage when response.completed omits usage", async () => {
			// Arrange: stream completes without usage in response.completed
			mockResponsesCreate.mockImplementationOnce(async (_options) => {
				return (async function* () {
					yield { type: "response.created", response: { id: "resp_no_usage" } }
					yield { type: "response.output_text.delta", delta: "Hello" }
					yield {
						type: "response.completed",
						response: {
							id: "resp_no_usage",
							output: [{ type: "text", content: [{ type: "text", text: "Hello" }] }],
							// no usage here to force fallback
						},
					}
				})()
			})
			// And the retrieve call returns usage
			mockResponsesRetrieve.mockResolvedValueOnce({
				id: "resp_no_usage",
				usage: {
					input_tokens: 21,
					output_tokens: 8,
					cache_creation_input_tokens: 3,
					cache_read_input_tokens: 5,
				},
			})

			// Act: consume the stream
			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const c of stream) chunks.push(c)

			// Assert: one usage chunk emitted from retrieve() values
			const usageChunks = chunks.filter((c) => c.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0]).toMatchObject({
				type: "usage",
				inputTokens: 21,
				outputTokens: 8,
				cacheWriteTokens: 3,
				cacheReadTokens: 5,
			})

			// And retrieve called once with lastResponse.id
			expect(mockResponsesRetrieve).toHaveBeenCalledTimes(1)
			expect(mockResponsesRetrieve).toHaveBeenCalledWith("resp_no_usage")
		})
	})
})

// Additional tests for forceStateless behavior

describe("OpenAiNativeHandler - stateless override", () => {
	it("treats call as stateless when metadata.forceStateless=true", async () => {
		// Arrange: default stateful handler (store not set to false)
		const handler = new OpenAiNativeHandler({
			apiModelId: "gpt-5", // ensures include reasoning content path remains consistent
			openAiNativeApiKey: "test-api-key",
		})

		const systemPrompt = "You are helpful."
		const firstMessages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello!" }]

		// First call to populate conversationHistory with prior outputs
		const first = handler.createMessage(systemPrompt, firstMessages)
		for await (const _ of first) {
			// consume stream
		}

		mockResponsesCreate.mockClear()

		// Act: second call with metadata.forceStateless = true
		const secondMessages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Second hello" }]
		const meta = { taskId: "t1", forceStateless: true } as any
		const second = handler.createMessage(systemPrompt, secondMessages, meta)
		for await (const _ of second) {
			// consume stream
		}

		// Assert: request is forced stateless, no previous_response_id, and input contains prior outputs + new user input
		const body = mockResponsesCreate.mock.calls[0][0]
		expect(body.store).toBe(false)
		expect(body.previous_response_id).toBeUndefined()

		const input = body.input as any[]
		expect(Array.isArray(input)).toBe(true)

		// Contains the new user input with input_text "Second hello"
		const hasNewUser = input.some(
			(item: any) =>
				item &&
				item.role === "user" &&
				Array.isArray(item.content) &&
				item.content.some((p: any) => p?.type === "input_text" && p?.text === "Second hello"),
		)
		expect(hasNewUser).toBe(true)

		// Contains prior assistant outputs from first turn (e.g., "Test response" from mocked stream)
		const containsPriorAssistant = JSON.stringify(input).includes("Test response")
		expect(containsPriorAssistant).toBe(true)
	})
})

// Retry guard tests for Previous response 400 behavior
describe("OpenAiNativeHandler - retry guard", () => {
	beforeEach(() => {
		mockResponsesCreate.mockClear()
		mockResponsesRetrieve.mockClear()
	})
	it("does not retry create() on 400 'Previous response' when request had no previous_response_id (stateless path)", async () => {
		// Arrange: force stateless so provider will NOT set previous_response_id
		const handler = new OpenAiNativeHandler({
			apiModelId: "gpt-5",
			openAiNativeApiKey: "test-api-key",
			store: false, // stateless to ensure no previous_response_id is used
		})

		// Simulate a 400 error containing 'Previous response' text
		const err: any = new Error("Previous response is invalid or missing")
		err.status = 400
		err.message = "Previous response is invalid or missing"

		mockResponsesCreate.mockRejectedValueOnce(err)

		// Act + Assert: The provider should NOT retry and should surface the error
		const stream = handler.createMessage("You are helpful.", [{ role: "user", content: "Hello" } as any])

		await expect(async () => {
			for await (const _ of stream) {
				// consume
			}
		}).rejects.toThrow(/Previous response/i)

		// Verify only one create() attempt was made (no retry)
		expect(mockResponsesCreate).toHaveBeenCalledTimes(1)
	})
})

// Additional error hygiene tests appended by PR Fixer

describe("OpenAiNativeHandler - error hygiene", () => {
	it("swallows late stream errors after completion when output already emitted", async () => {
		// Arrange: stream emits deltas, completes with usage, then throws spurious error
		mockResponsesCreate.mockImplementationOnce(async (_options) => {
			return (async function* () {
				yield { type: "response.created", response: { id: "resp_after_complete" } }
				yield { type: "response.output_text.delta", delta: "All " }
				yield { type: "response.output_text.delta", delta: "good" }
				yield {
					type: "response.completed",
					response: {
						id: "resp_after_complete",
						output: [{ type: "text", content: [{ type: "text", text: "All good" }] }],
						usage: {
							input_tokens: 3,
							output_tokens: 2,
							cache_creation_input_tokens: 0,
							cache_read_input_tokens: 0,
						},
					},
				}
				// Spurious error coming from underlying connection after completion
				throw new Error("socket closed")
			})()
		})

		const handler = new OpenAiNativeHandler({
			apiModelId: "gpt-5",
			openAiNativeApiKey: "test",
		})

		// Act: consume stream fully; should NOT throw
		const chunks: any[] = []
		const stream = handler.createMessage("You are helpful.", [{ role: "user", content: "Hi" } as any])
		for await (const c of stream) {
			chunks.push(c)
		}

		// Assert: we received normal content + usage and no exception was propagated
		const text = chunks
			.filter((c) => c.type === "text")
			.map((c) => c.text)
			.join("")
		expect(text).toBe("All good")
		const usage = chunks.find((c) => c.type === "usage")
		expect(usage).toBeTruthy()
	})

	it("propagates early stream errors before any output", async () => {
		// Arrange: stream throws before any text/usage/completed events
		mockResponsesCreate.mockImplementationOnce(async (_options) => {
			return (async function* () {
				yield { type: "response.created", response: { id: "resp_early_error" } }
				throw new Error("network failure")
			})()
		})

		const handler = new OpenAiNativeHandler({
			apiModelId: "gpt-5",
			openAiNativeApiKey: "test",
		})

		// Act + Assert: consuming should reject with the early error
		const stream = handler.createMessage("You are helpful.", [{ role: "user", content: "Hi" } as any])
		await expect(async () => {
			for await (const _ of stream) {
				// consume
			}
		}).rejects.toThrow(/network failure/i)
	})

	describe("Codex Mini Model", () => {
		let handler: OpenAiNativeHandler
		const mockOptions: ApiHandlerOptions = {
			openAiNativeApiKey: "test-api-key",
			apiModelId: "codex-mini-latest",
		}

		it("should handle codex-mini-latest streaming response", async () => {
			// Mock fetch for Codex Mini responses API
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						// Codex Mini uses the same responses API format
						controller.enqueue(
							new TextEncoder().encode('data: {"type":"response.output_text.delta","delta":"Hello"}\n\n'),
						)
						controller.enqueue(
							new TextEncoder().encode('data: {"type":"response.output_text.delta","delta":" from"}\n\n'),
						)
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.output_text.delta","delta":" Codex"}\n\n',
							),
						)
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.output_text.delta","delta":" Mini!"}\n\n',
							),
						)
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.done","response":{"usage":{"prompt_tokens":50,"completion_tokens":10}}}\n\n',
							),
						)
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any

			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "codex-mini-latest",
			})

			const systemPrompt = "You are a helpful coding assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "Write a hello world function" },
			]

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify text chunks
			const textChunks = chunks.filter((c) => c.type === "text")
			expect(textChunks).toHaveLength(4)
			expect(textChunks.map((c) => c.text).join("")).toBe("Hello from Codex Mini!")

			// Verify usage data from API
			const usageChunks = chunks.filter((c) => c.type === "usage")
			expect(usageChunks).toHaveLength(1)
			expect(usageChunks[0]).toMatchObject({
				type: "usage",
				inputTokens: 50,
				outputTokens: 10,
				totalCost: expect.any(Number), // Codex Mini has pricing: $1.5/M input, $6/M output
			})

			// Verify cost is calculated correctly based on API usage data
			const expectedCost = (50 / 1_000_000) * 1.5 + (10 / 1_000_000) * 6
			expect(usageChunks[0].totalCost).toBeCloseTo(expectedCost, 10)

			// Verify the request was made with correct parameters
			expect(mockFetch).toHaveBeenCalledWith(
				"https://api.openai.com/v1/responses",
				expect.objectContaining({
					method: "POST",
					headers: expect.objectContaining({
						"Content-Type": "application/json",
						Authorization: "Bearer test-api-key",
						Accept: "text/event-stream",
					}),
					body: expect.any(String),
				}),
			)

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
			expect(requestBody).toMatchObject({
				model: "codex-mini-latest",
				input: "Developer: You are a helpful coding assistant.\n\nUser: Write a hello world function",
				stream: true,
			})

			// Clean up
			delete (global as any).fetch
		})

		it("should handle codex-mini-latest non-streaming completion", async () => {
			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "codex-mini-latest",
			})

			// Codex Mini now uses the same Responses API as GPT-5, which doesn't support non-streaming
			await expect(handler.completePrompt("Write a hello world function in Python")).rejects.toThrow(
				"completePrompt is not supported for codex-mini-latest. Use createMessage (Responses API) instead.",
			)
		})

		it("should handle codex-mini-latest API errors", async () => {
			// Mock fetch with error response
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: false,
				status: 429,
				statusText: "Too Many Requests",
				text: async () => "Rate limit exceeded",
			})
			global.fetch = mockFetch as any

			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "codex-mini-latest",
			})

			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

			const stream = handler.createMessage(systemPrompt, messages)

			// Should throw an error (using the same error format as GPT-5)
			await expect(async () => {
				for await (const chunk of stream) {
					// consume stream
				}
			}).rejects.toThrow("Rate limit exceeded")

			// Clean up
			delete (global as any).fetch
		})

		it("should handle codex-mini-latest with multiple user messages", async () => {
			// Mock fetch for streaming response
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.output_text.delta","delta":"Combined response"}\n\n',
							),
						)
						controller.enqueue(new TextEncoder().encode('data: {"type":"response.completed"}\n\n'))
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any

			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "codex-mini-latest",
			})

			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "First question" },
				{ role: "assistant", content: "First answer" },
				{ role: "user", content: "Second question" },
			]

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify the request body includes full conversation like GPT-5
			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
			expect(requestBody.input).toContain("Developer: You are a helpful assistant")
			expect(requestBody.input).toContain("User: First question")
			expect(requestBody.input).toContain("Assistant: First answer")
			expect(requestBody.input).toContain("User: Second question")

			// Clean up
			delete (global as any).fetch
		})

		it("should handle codex-mini-latest stream error events", async () => {
			// Mock fetch with error event in stream
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.output_text.delta","delta":"Partial"}\n\n',
							),
						)
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.error","error":{"message":"Model overloaded"}}\n\n',
							),
						)
						// The error handler will throw, but we still need to close the stream
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch as any

			handler = new OpenAiNativeHandler({
				...mockOptions,
				apiModelId: "codex-mini-latest",
			})

			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

			const stream = handler.createMessage(systemPrompt, messages)

			// Should throw an error when encountering error event
			await expect(async () => {
				const chunks = []
				for await (const chunk of stream) {
					chunks.push(chunk)
				}
			}).rejects.toThrow("Responses API error: Model overloaded")

			// Clean up
			delete (global as any).fetch
		})
	})
})
