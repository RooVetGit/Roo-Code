import { OpenAiHandler } from "../openai"
import { ApiHandlerOptions } from "../../../shared/api"

// Mock OpenAI client
const mockCreate = jest.fn()
jest.mock("openai", () => {
	return {
		__esModule: true,
		default: jest.fn().mockImplementation(() => ({
			chat: {
				completions: {
					create: mockCreate.mockImplementation(async (options) => {
						if (!options.stream) {
							return {
								id: "test-completion",
								choices: [
									{
										message: { role: "assistant", content: "Test response", refusal: null },
										finish_reason: "stop",
										index: 0,
									},
								],
								usage: {
									prompt_tokens: 10,
									completion_tokens: 5,
									total_tokens: 15,
								},
							}
						}

						return {
							[Symbol.asyncIterator]: async function* () {
								yield {
									choices: [
										{
											delta: { content: "Test response" },
											index: 0,
										},
									],
									usage: null,
								}
								yield {
									choices: [
										{
											delta: {},
											index: 0,
										},
									],
									usage: {
										prompt_tokens: 10,
										completion_tokens: 5,
										total_tokens: 15,
									},
								}
							},
						}
					}),
				},
			},
		})),
	}
})

describe("OpenAiHandler Parameters", () => {
	let handler: OpenAiHandler
	let baseOptions: ApiHandlerOptions

	beforeEach(() => {
		baseOptions = {
			openAiApiKey: "test-api-key",
			openAiModelId: "gpt-4",
			openAiBaseUrl: "https://api.openai.com/v1",
		}
		mockCreate.mockClear()
	})

	describe("modelMinP parameter", () => {
		it("should include min_p when set", async () => {
			handler = new OpenAiHandler({
				...baseOptions,
				modelMinP: 0.1,
			})

			await handler.completePrompt("Test prompt")

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					min_p: 0.1,
				}),
			)
		})

		it("should not include min_p when not set", async () => {
			handler = new OpenAiHandler(baseOptions)

			await handler.completePrompt("Test prompt")

			expect(mockCreate).toHaveBeenCalledWith(
				expect.not.objectContaining({
					min_p: expect.anything(),
				}),
			)
		})

		it("should not include min_p when null", async () => {
			handler = new OpenAiHandler({
				...baseOptions,
				modelMinP: null,
			})

			await handler.completePrompt("Test prompt")

			expect(mockCreate).toHaveBeenCalledWith(
				expect.not.objectContaining({
					min_p: expect.anything(),
				}),
			)
		})
	})

	describe("modelMaxP parameter", () => {
		it("should include top_p when set", async () => {
			handler = new OpenAiHandler({
				...baseOptions,
				modelMaxP: 0.9,
			})

			await handler.completePrompt("Test prompt")

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					top_p: 0.9,
				}),
			)
		})

		it("should not include top_p when not set", async () => {
			handler = new OpenAiHandler(baseOptions)

			await handler.completePrompt("Test prompt")

			expect(mockCreate).toHaveBeenCalledWith(
				expect.not.objectContaining({
					top_p: expect.anything(),
				}),
			)
		})

		it("should not include top_p when null", async () => {
			handler = new OpenAiHandler({
				...baseOptions,
				modelMaxP: null,
			})

			await handler.completePrompt("Test prompt")

			expect(mockCreate).toHaveBeenCalledWith(
				expect.not.objectContaining({
					top_p: expect.anything(),
				}),
			)
		})
	})

	describe("modelTopK parameter", () => {
		it("should include top_k when set", async () => {
			handler = new OpenAiHandler({
				...baseOptions,
				modelTopK: 40,
			})

			await handler.completePrompt("Test prompt")

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					top_k: 40,
				}),
			)
		})

		it("should not include top_k when not set", async () => {
			handler = new OpenAiHandler(baseOptions)

			await handler.completePrompt("Test prompt")

			expect(mockCreate).toHaveBeenCalledWith(
				expect.not.objectContaining({
					top_k: expect.anything(),
				}),
			)
		})

		it("should not include top_k when null", async () => {
			handler = new OpenAiHandler({
				...baseOptions,
				modelTopK: null,
			})

			await handler.completePrompt("Test prompt")

			expect(mockCreate).toHaveBeenCalledWith(
				expect.not.objectContaining({
					top_k: expect.anything(),
				}),
			)
		})
	})

	describe("modelRepetitionPenalty parameter", () => {
		it("should convert repetition_penalty to frequency_penalty by subtracting 1.0", async () => {
			handler = new OpenAiHandler({
				...baseOptions,
				modelRepetitionPenalty: 1.5,
			})

			await handler.completePrompt("Test prompt")

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					frequency_penalty: 0.5, // 1.5 - 1.0 = 0.5
				}),
			)
		})

		it("should not include frequency_penalty when not set", async () => {
			handler = new OpenAiHandler(baseOptions)

			await handler.completePrompt("Test prompt")

			expect(mockCreate).toHaveBeenCalledWith(
				expect.not.objectContaining({
					frequency_penalty: expect.anything(),
				}),
			)
		})

		it("should not include frequency_penalty when null", async () => {
			handler = new OpenAiHandler({
				...baseOptions,
				modelRepetitionPenalty: null,
			})

			await handler.completePrompt("Test prompt")

			expect(mockCreate).toHaveBeenCalledWith(
				expect.not.objectContaining({
					frequency_penalty: expect.anything(),
				}),
			)
		})
	})

	describe("createMessage with streaming", () => {
		it("should include all parameters when set", async () => {
			handler = new OpenAiHandler({
				...baseOptions,
				modelMinP: 0.1,
				modelMaxP: 0.9,
				modelTopK: 40,
				modelRepetitionPenalty: 1.5,
				openAiStreamingEnabled: true,
			})

			const stream = handler.createMessage("System prompt", [{ role: "user", content: "Hello" }])
			await stream.next() // Start the stream to trigger the API call

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					min_p: 0.1,
					top_p: 0.9,
					top_k: 40,
					frequency_penalty: 0.5,
					stream: true,
				}),
			)
		})
	})

	describe("createMessage without streaming", () => {
		it("should include all parameters when set", async () => {
			handler = new OpenAiHandler({
				...baseOptions,
				modelMinP: 0.1,
				modelMaxP: 0.9,
				modelTopK: 40,
				modelRepetitionPenalty: 1.5,
				openAiStreamingEnabled: false,
			})

			const stream = handler.createMessage("System prompt", [{ role: "user", content: "Hello" }])
			await stream.next() // Start the stream to trigger the API call

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					min_p: 0.1,
					top_p: 0.9,
					top_k: 40,
					frequency_penalty: 0.5,
				}),
			)
		})
	})

	describe("handleO3FamilyMessage", () => {
		it("should include all parameters when set with streaming", async () => {
			handler = new OpenAiHandler({
				...baseOptions,
				openAiModelId: "o3-mini",
				modelMinP: 0.1,
				modelMaxP: 0.9,
				modelTopK: 40,
				modelRepetitionPenalty: 1.5,
				openAiStreamingEnabled: true,
			})

			const stream = handler.createMessage("System prompt", [{ role: "user", content: "Hello" }])
			await stream.next() // Start the stream to trigger the API call

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					min_p: 0.1,
					top_p: 0.9,
					top_k: 40,
					frequency_penalty: 0.5,
					stream: true,
				}),
			)
		})

		it("should include all parameters when set without streaming", async () => {
			handler = new OpenAiHandler({
				...baseOptions,
				openAiModelId: "o3-mini",
				modelMinP: 0.1,
				modelMaxP: 0.9,
				modelTopK: 40,
				modelRepetitionPenalty: 1.5,
				openAiStreamingEnabled: false,
			})

			const stream = handler.createMessage("System prompt", [{ role: "user", content: "Hello" }])
			await stream.next() // Start the stream to trigger the API call

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					min_p: 0.1,
					top_p: 0.9,
					top_k: 40,
					frequency_penalty: 0.5,
				}),
			)
		})
	})
})
