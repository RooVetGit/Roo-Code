import { describe, it, expect, vi, beforeEach } from "vitest"
import { webviewMessageHandler } from "../webviewMessageHandler"
import type { ClineProvider } from "../ClineProvider"
import type { ClineMessage } from "@roo-code/types"

describe("webviewMessageHandler - findMessageIndices", () => {
	let mockClineProvider: any
	let mockTask: any

	beforeEach(() => {
		// Create mock messages with specific timestamps
		const mockMessages: ClineMessage[] = [
			{ ts: 1000, type: "say", say: "user_feedback", text: "Message 1" },
			{ ts: 1500, type: "say", say: "user_feedback", text: "Message 2" },
			{ ts: 2000, type: "say", say: "user_feedback", text: "Message 3" },
			{ ts: 2999, type: "say", say: "user_feedback", text: "Message 4" }, // Within 1 second of message 3
			{ ts: 3000, type: "say", say: "user_feedback", text: "Message 5" },
		]

		const mockApiHistory = [
			{ ts: 1000, role: "user", content: "API Message 1" },
			{ ts: 1500, role: "assistant", content: "API Message 2" },
			{ ts: 2000, role: "user", content: "API Message 3" },
			{ ts: 2999, role: "assistant", content: "API Message 4" },
			{ ts: 3000, role: "user", content: "API Message 5" },
		]

		mockTask = {
			taskId: "test-task-id",
			clineMessages: mockMessages,
			apiConversationHistory: mockApiHistory,
			overwriteClineMessages: vi.fn(),
			overwriteApiConversationHistory: vi.fn(),
			handleWebviewAskResponse: vi.fn(),
		}

		mockClineProvider = {
			getCurrentTask: vi.fn(() => mockTask),
			getTaskWithId: vi.fn().mockResolvedValue({
				historyItem: { ts: Date.now(), task: "Test", tokensIn: 0, tokensOut: 0 },
			}),
			createTaskWithHistoryItem: vi.fn(),
			postMessageToWebview: vi.fn(),
		} as unknown as ClineProvider
	})

	describe("deleteMessage with exact timestamp matching", () => {
		it("should delete only the message with exact timestamp match", async () => {
			// First, show the delete dialog
			await webviewMessageHandler(mockClineProvider, {
				type: "deleteMessage",
				value: 2000, // Delete message at timestamp 2000
			})

			// Verify dialog was shown
			expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "showDeleteMessageDialog",
				messageTs: 2000,
			})

			// Now confirm the deletion
			await webviewMessageHandler(mockClineProvider, {
				type: "deleteMessageConfirm",
				messageTs: 2000,
			})

			// Should delete from index 2 onwards (messages 3, 4, 5)
			expect(mockTask.overwriteClineMessages).toHaveBeenCalledWith([
				mockTask.clineMessages[0],
				mockTask.clineMessages[1],
			])

			expect(mockTask.overwriteApiConversationHistory).toHaveBeenCalledWith([
				mockTask.apiConversationHistory[0],
				mockTask.apiConversationHistory[1],
			])
		})

		it("should not delete messages within 1 second buffer when using exact matching", async () => {
			// Delete message at timestamp 3000
			await webviewMessageHandler(mockClineProvider, {
				type: "deleteMessage",
				value: 3000,
			})

			await webviewMessageHandler(mockClineProvider, {
				type: "deleteMessageConfirm",
				messageTs: 3000,
			})

			// Should delete only from index 4 (message 5), NOT from index 3 (message 4 at 2999)
			expect(mockTask.overwriteClineMessages).toHaveBeenCalledWith([
				mockTask.clineMessages[0],
				mockTask.clineMessages[1],
				mockTask.clineMessages[2],
				mockTask.clineMessages[3], // Message at 2999 should be preserved
			])

			expect(mockTask.overwriteApiConversationHistory).toHaveBeenCalledWith([
				mockTask.apiConversationHistory[0],
				mockTask.apiConversationHistory[1],
				mockTask.apiConversationHistory[2],
				mockTask.apiConversationHistory[3], // API message at 2999 should be preserved
			])
		})

		it("should handle case when message timestamp is not found", async () => {
			// Try to delete a message with non-existent timestamp
			await webviewMessageHandler(mockClineProvider, {
				type: "deleteMessage",
				value: 9999,
			})

			await webviewMessageHandler(mockClineProvider, {
				type: "deleteMessageConfirm",
				messageTs: 9999,
			})

			// Should not call overwrite methods since message wasn't found
			expect(mockTask.overwriteClineMessages).not.toHaveBeenCalled()
			expect(mockTask.overwriteApiConversationHistory).not.toHaveBeenCalled()
			expect(mockClineProvider.createTaskWithHistoryItem).not.toHaveBeenCalled()
		})
	})

	describe("editMessage with exact timestamp matching", () => {
		it("should edit only the message with exact timestamp match", async () => {
			// First, show the edit dialog
			await webviewMessageHandler(mockClineProvider, {
				type: "submitEditedMessage",
				value: 2000,
				editedMessageContent: "Edited message content",
			})

			// Verify dialog was shown
			expect(mockClineProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "showEditMessageDialog",
				messageTs: 2000,
				text: "Edited message content",
				images: undefined,
			})

			// Now confirm the edit
			await webviewMessageHandler(mockClineProvider, {
				type: "editMessageConfirm",
				messageTs: 2000,
				text: "Edited message content",
			})

			// Should delete from index 2 onwards before adding the edited message
			expect(mockTask.overwriteClineMessages).toHaveBeenCalledWith([
				mockTask.clineMessages[0],
				mockTask.clineMessages[1],
			])

			expect(mockTask.overwriteApiConversationHistory).toHaveBeenCalledWith([
				mockTask.apiConversationHistory[0],
				mockTask.apiConversationHistory[1],
			])
		})

		it("should not affect messages within 1 second buffer when editing", async () => {
			// Edit message at timestamp 3000
			await webviewMessageHandler(mockClineProvider, {
				type: "submitEditedMessage",
				value: 3000,
				editedMessageContent: "Edited message at 3000",
			})

			await webviewMessageHandler(mockClineProvider, {
				type: "editMessageConfirm",
				messageTs: 3000,
				text: "Edited message at 3000",
			})

			// Should delete only from index 4, preserving message at 2999
			expect(mockTask.overwriteClineMessages).toHaveBeenCalledWith([
				mockTask.clineMessages[0],
				mockTask.clineMessages[1],
				mockTask.clineMessages[2],
				mockTask.clineMessages[3], // Message at 2999 should be preserved
			])
		})
	})

	describe("edge cases", () => {
		it("should handle empty message arrays gracefully", async () => {
			mockTask.clineMessages = []
			mockTask.apiConversationHistory = []

			await webviewMessageHandler(mockClineProvider, {
				type: "deleteMessage",
				value: 1000,
			})

			await webviewMessageHandler(mockClineProvider, {
				type: "deleteMessageConfirm",
				messageTs: 1000,
			})

			// Should not throw errors and should not call overwrite methods
			expect(mockTask.overwriteClineMessages).not.toHaveBeenCalled()
			expect(mockTask.overwriteApiConversationHistory).not.toHaveBeenCalled()
		})

		it("should handle messages with duplicate timestamps correctly", async () => {
			// Create messages with duplicate timestamps
			mockTask.clineMessages = [
				{ ts: 1000, type: "say", say: "user_feedback", text: "Message 1" },
				{ ts: 2000, type: "say", say: "user_feedback", text: "Message 2a" },
				{ ts: 2000, type: "say", say: "user_feedback", text: "Message 2b" }, // Duplicate timestamp
				{ ts: 3000, type: "say", say: "user_feedback", text: "Message 3" },
			]

			await webviewMessageHandler(mockClineProvider, {
				type: "deleteMessage",
				value: 2000,
			})

			await webviewMessageHandler(mockClineProvider, {
				type: "deleteMessageConfirm",
				messageTs: 2000,
			})

			// Should delete from the first occurrence of timestamp 2000
			expect(mockTask.overwriteClineMessages).toHaveBeenCalledWith([mockTask.clineMessages[0]])
		})
	})
})
