import { jest } from "@jest/globals"
import { ApiHandler } from "../../../api"
import { ApiMessage } from "../../task-persistence/apiMessages"
import { maybeRemoveImageBlocks } from "../../../api/transform/image-cleaning"
import { summarizeConversationIfNeeded, getMessagesSinceLastSummary } from "../index"
import { ApiStream, ApiStreamChunk } from "../../../api/transform/stream"
import { CONTEXT_FRAC_FOR_SUMMARY, N_MESSAGES_TO_KEEP } from "../index"

const CONTEXT_WINDOW_SIZE = 1000
const OVER_THRESHOLD_TOTAL_TOKENS = Math.ceil(CONTEXT_WINDOW_SIZE * CONTEXT_FRAC_FOR_SUMMARY) + 1

// Mock dependencies
jest.mock("../../../api/transform/image-cleaning", () => ({
	maybeRemoveImageBlocks: jest.fn((messages) => messages),
}))

// Mock Anthropic SDK
jest.mock("@anthropic-ai/sdk", () => {
	return {
		default: jest.fn().mockImplementation(() => ({
			messages: {
				create: jest.fn(),
			},
		})),
	}
})

describe("Conversation Condensing", () => {
	// Mock API handler
	const mockApiHandler: jest.Mocked<ApiHandler> = {
		createMessage: jest.fn(),
	} as unknown as jest.Mocked<ApiHandler>

	// Reset mocks before each test
	beforeEach(() => {
		jest.clearAllMocks()

		// Setup default mock for createMessage
		mockApiHandler.createMessage.mockImplementation((): ApiStream => {
			return (async function* (): AsyncGenerator<ApiStreamChunk> {
				yield { type: "text", text: "This is a summary of the conversation." }
			})()
		})
	})

	describe("getMessagesSinceLastSummary", () => {
		it("should return all messages if there is no summary", () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Hello", ts: 1 },
				{ role: "assistant", content: "Hi there", ts: 2 },
			]

			const result = getMessagesSinceLastSummary(messages)
			expect(result).toEqual(messages)
		})

		it("should return messages since the last summary", () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "First message", ts: 1 },
				{ role: "assistant", content: "Summary of conversation", ts: 2, isSummary: true },
				{ role: "user", content: "New message", ts: 3 },
				{ role: "assistant", content: "Response", ts: 4 },
			]

			const result = getMessagesSinceLastSummary(messages)
			expect(result).toEqual([
				{ role: "assistant", content: "Summary of conversation", ts: 2, isSummary: true },
				{ role: "user", content: "New message", ts: 3 },
				{ role: "assistant", content: "Response", ts: 4 },
			])
		})

		it("should handle multiple summary messages and return since the last one", () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "First message", ts: 1 },
				{ role: "assistant", content: "First summary", ts: 2, isSummary: true },
				{ role: "user", content: "Second message", ts: 3 },
				{ role: "assistant", content: "Second summary", ts: 4, isSummary: true },
				{ role: "user", content: "New message", ts: 5 },
			]

			const result = getMessagesSinceLastSummary(messages)
			expect(result).toEqual([
				{ role: "assistant", content: "Second summary", ts: 4, isSummary: true },
				{ role: "user", content: "New message", ts: 5 },
			])
		})

		it("should handle empty message array", () => {
			const messages: ApiMessage[] = []
			const result = getMessagesSinceLastSummary(messages)
			expect(result).toEqual([])
		})
	})

	describe("summarizeConversationIfNeeded", () => {
		it("should not summarize when below token threshold", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Hello", ts: 1 },
				{ role: "assistant", content: "Hi there", ts: 2 },
			]

			const totalTokens = 100
			const result = await summarizeConversationIfNeeded(
				messages,
				totalTokens,
				CONTEXT_WINDOW_SIZE,
				mockApiHandler,
			)

			expect(result).toBe(messages)
			expect(mockApiHandler.createMessage).not.toHaveBeenCalled()
		})

		it("should summarize when above token threshold", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Message 1", ts: 1 },
				{ role: "assistant", content: "Response 1", ts: 2 },
				{ role: "user", content: "Message 2", ts: 3 },
				{ role: "assistant", content: "Response 2", ts: 4 },
				{ role: "user", content: "Message 3", ts: 5 },
				{ role: "assistant", content: "Response 3", ts: 6 },
				{ role: "user", content: "Message 4", ts: 7 },
			]

			const result = await summarizeConversationIfNeeded(
				messages,
				OVER_THRESHOLD_TOTAL_TOKENS,
				CONTEXT_WINDOW_SIZE,
				mockApiHandler,
			)

			// Should have called createMessage
			expect(mockApiHandler.createMessage).toHaveBeenCalled()

			// Should have a summary message inserted
			expect(result.some((msg) => msg.isSummary)).toBe(true)

			// Should preserve the last N_MESSAGES_TO_KEEP messages
			for (let i = 1; i <= N_MESSAGES_TO_KEEP; i++) {
				expect(result).toContainEqual(messages[messages.length - i])
			}
		})

		it("should not summarize if there are not enough messages", async () => {
			const messages: ApiMessage[] = [{ role: "user", content: "Hello", ts: 1 }]

			const result = await summarizeConversationIfNeeded(
				messages,
				OVER_THRESHOLD_TOTAL_TOKENS,
				CONTEXT_WINDOW_SIZE,
				mockApiHandler,
			)

			expect(result).toBe(messages)
			expect(mockApiHandler.createMessage).not.toHaveBeenCalled()
		})

		it("should not summarize if we recently summarized", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Message 1", ts: 1 },
				{ role: "assistant", content: "Response 1", ts: 2 },
				{ role: "user", content: "Message 2", ts: 3 },
				{ role: "assistant", content: "Summary", ts: 4, isSummary: true },
				{ role: "user", content: "Message 3", ts: 5 },
			]

			const result = await summarizeConversationIfNeeded(
				messages,
				OVER_THRESHOLD_TOTAL_TOKENS,
				CONTEXT_WINDOW_SIZE,
				mockApiHandler,
			)

			// Should not have called createMessage because one of the last 3 messages is already a summary
			expect(mockApiHandler.createMessage).not.toHaveBeenCalled()
			expect(result).toBe(messages)
		})

		it("should handle empty API response", async () => {
			// Setup mock to return empty summary
			mockApiHandler.createMessage.mockImplementation((): ApiStream => {
				return (async function* (): AsyncGenerator<ApiStreamChunk> {
					yield { type: "text", text: "" }
				})()
			})

			const messages: ApiMessage[] = [
				{ role: "user", content: "Message 1", ts: 1 },
				{ role: "assistant", content: "Response 1", ts: 2 },
				{ role: "user", content: "Message 2", ts: 3 },
				{ role: "assistant", content: "Response 2", ts: 4 },
				{ role: "user", content: "Message 3", ts: 5 },
				{ role: "assistant", content: "Response 3", ts: 6 },
				{ role: "user", content: "Message 4", ts: 7 },
			]

			const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {})

			const result = await summarizeConversationIfNeeded(
				messages,
				OVER_THRESHOLD_TOTAL_TOKENS,
				CONTEXT_WINDOW_SIZE,
				mockApiHandler,
			)

			// Should have called createMessage
			expect(mockApiHandler.createMessage).toHaveBeenCalled()

			// Should have logged a warning
			expect(consoleSpy).toHaveBeenCalledWith("Received empty summary from API")

			// Should return original messages
			expect(result).toBe(messages)

			consoleSpy.mockRestore()
		})

		it("should correctly handle non-text chunks in API response", async () => {
			// Setup mock to return mixed chunks
			mockApiHandler.createMessage.mockImplementation((): ApiStream => {
				return (async function* (): AsyncGenerator<ApiStreamChunk> {
					yield { type: "text", text: "This is " } as ApiStreamChunk
					yield { type: "text", text: "a summary." } as ApiStreamChunk
				})()
			})

			const messages: ApiMessage[] = [
				{ role: "user", content: "Message 1", ts: 1 },
				{ role: "assistant", content: "Response 1", ts: 2 },
				{ role: "user", content: "Message 2", ts: 3 },
				{ role: "assistant", content: "Response 2", ts: 4 },
				{ role: "user", content: "Message 3", ts: 5 },
				{ role: "assistant", content: "Response 3", ts: 6 },
				{ role: "user", content: "Message 4", ts: 7 },
			]

			const result = await summarizeConversationIfNeeded(
				messages,
				OVER_THRESHOLD_TOTAL_TOKENS,
				CONTEXT_WINDOW_SIZE,
				mockApiHandler,
			)

			// Should have called createMessage
			expect(mockApiHandler.createMessage).toHaveBeenCalled()

			// Should have a summary message with the correct content
			const summaryMessage = result.find((msg) => msg.isSummary)
			expect(summaryMessage).toBeDefined()
			expect(summaryMessage?.content).toBe("This is a summary.")
		})

		it("should use maybeRemoveImageBlocks when preparing messages for summarization", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Message 1", ts: 1 },
				{ role: "assistant", content: "Response 1", ts: 2 },
				{ role: "user", content: "Message 2", ts: 3 },
				{ role: "assistant", content: "Response 2", ts: 4 },
				{ role: "user", content: "Message 3", ts: 5 },
				{ role: "assistant", content: "Response 3", ts: 6 },
				{ role: "user", content: "Message 4", ts: 7 },
			]

			await summarizeConversationIfNeeded(
				messages,
				OVER_THRESHOLD_TOTAL_TOKENS,
				CONTEXT_WINDOW_SIZE,
				mockApiHandler,
			)

			// Should have called maybeRemoveImageBlocks
			expect(maybeRemoveImageBlocks).toHaveBeenCalled()
		})
	})
})
