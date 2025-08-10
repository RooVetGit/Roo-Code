import { describe, it, expect, vi, beforeEach } from "vitest"
import { truncateConversationIfNeeded } from "../index"
import { ApiHandler } from "../../../api"
import { ApiMessage } from "../../task-persistence/apiMessages"

// Mock dependencies
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureSlidingWindowTruncation: vi.fn(),
		},
	},
}))

vi.mock("../../condense", () => ({
	MAX_CONDENSE_THRESHOLD: 100,
	MIN_CONDENSE_THRESHOLD: 50,
	summarizeConversation: vi.fn().mockResolvedValue({
		messages: [],
		summary: "Test summary",
		cost: 0.01,
		newContextTokens: 100,
	}),
}))

describe("Context Compression Fix for Issue #4430", () => {
	let mockApiHandler: ApiHandler
	let testMessages: ApiMessage[]
	let mockSummarizeConversation: any

	beforeEach(async () => {
		// Reset all mocks before each test
		vi.clearAllMocks()

		// Get the mocked function
		const { summarizeConversation } = await import("../../condense")
		mockSummarizeConversation = summarizeConversation

		mockApiHandler = {
			countTokens: vi.fn().mockResolvedValue(1000),
		} as any

		testMessages = [
			{
				role: "user",
				content: [{ type: "text", text: "Test message 1" }],
				ts: Date.now(),
			},
			{
				role: "assistant",
				content: [{ type: "text", text: "Test response 1" }],
				ts: Date.now(),
			},
		] as ApiMessage[]
	})

	it("should skip context compression when skipContextCompression flag is true", async () => {
		const result = await truncateConversationIfNeeded({
			messages: testMessages,
			totalTokens: 8000, // High token count to trigger compression
			contextWindow: 10000,
			maxTokens: 1000,
			apiHandler: mockApiHandler,
			autoCondenseContext: true,
			autoCondenseContextPercent: 50, // Low threshold to trigger compression
			systemPrompt: "Test system prompt",
			taskId: "test-task-id",
			profileThresholds: {},
			currentProfileId: "default",
			skipContextCompression: true, // This should prevent compression
		})

		// Should return original messages without compression
		expect(result.messages).toBe(testMessages)
		expect(result.summary).toBe("")
		expect(result.cost).toBe(0)
	})

	it("should perform normal compression when skipContextCompression flag is false", async () => {
		const result = await truncateConversationIfNeeded({
			messages: testMessages,
			totalTokens: 8000, // High token count to trigger compression
			contextWindow: 10000,
			maxTokens: 1000,
			apiHandler: mockApiHandler,
			autoCondenseContext: true,
			autoCondenseContextPercent: 50, // Low threshold to trigger compression
			systemPrompt: "Test system prompt",
			taskId: "test-task-id",
			profileThresholds: {},
			currentProfileId: "default",
			skipContextCompression: false, // Normal compression should occur
		})

		// Should call summarizeConversation for compression
		expect(mockSummarizeConversation).toHaveBeenCalled()
		expect(result.summary).toBe("Test summary")
		expect(result.cost).toBe(0.01)
	})

	it("should not trigger compression when context is below threshold", async () => {
		const result = await truncateConversationIfNeeded({
			messages: testMessages,
			totalTokens: 1000, // Low token count, below threshold
			contextWindow: 10000,
			maxTokens: 1000,
			apiHandler: mockApiHandler,
			autoCondenseContext: true,
			autoCondenseContextPercent: 80, // High threshold
			systemPrompt: "Test system prompt",
			taskId: "test-task-id",
			profileThresholds: {},
			currentProfileId: "default",
			skipContextCompression: false,
		})

		// Should not call summarizeConversation
		expect(mockSummarizeConversation).not.toHaveBeenCalled()
		expect(result.messages).toBe(testMessages)
		expect(result.summary).toBe("")
	})

	it("should handle multi-file read scenario correctly", async () => {
		// Simulate the scenario from issue #4430:
		// - Multi-file read is enabled (maxConcurrentFileReads > 1)
		// - Context usage is at 100% threshold
		// - Settings save operation triggers compression check

		const result = await truncateConversationIfNeeded({
			messages: testMessages,
			totalTokens: 10000, // Exactly at 100% of context window
			contextWindow: 10000,
			maxTokens: 1000,
			apiHandler: mockApiHandler,
			autoCondenseContext: true,
			autoCondenseContextPercent: 100, // 100% threshold as in the issue
			systemPrompt: "Test system prompt",
			taskId: "test-task-id",
			profileThresholds: {},
			currentProfileId: "default",
			skipContextCompression: true, // Skip flag set by settings save
		})

		// Should skip compression despite being at threshold
		expect(result.messages).toBe(testMessages)
		expect(result.summary).toBe("")
		expect(result.cost).toBe(0)
	})
})
