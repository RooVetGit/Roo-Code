import * as fs from "fs/promises"
import * as path from "path"
import { ConversationSaver } from "../index"
import { ClineMessage } from "../../../shared/ExtensionMessage"

// Mock fs/promises
jest.mock("fs/promises", () => ({
	mkdir: jest.fn().mockReturnValue(Promise.resolve()),
	writeFile: jest.fn().mockReturnValue(Promise.resolve()),
}))

describe("ConversationSaver", () => {
	let saver: ConversationSaver
	let dateSpy: jest.SpyInstance
	const testFolder = "/test/save/folder"
	const mockMessages: ClineMessage[] = [
		{
			ts: 1000,
			type: "say" as const,
			say: "task" as const,
			text: "Test task",
		},
		{
			ts: 2000,
			type: "say" as const,
			say: "text" as const,
			text: "Test response",
		},
	]

	beforeEach(() => {
		jest.clearAllMocks()
		// Initialize conversation saver with test folder
		saver = new ConversationSaver(testFolder)
		// Setup Date mock
		const mockDate = new Date("2025-01-20T12:00:00Z")
		dateSpy = jest.spyOn(global, "Date")
		dateSpy.mockImplementation((...args: any[]) => {
			if (args.length) {
				return new (Function.prototype.bind.apply(Date, [null, ...args]))()
			}
			return mockDate
		})
	})

	afterEach(() => {
		if (dateSpy) {
			dateSpy.mockRestore()
		}
	})

	describe("saveConversation", () => {
		it("creates save folder if it doesn't exist", async () => {
			await saver.saveConversation(mockMessages)
			expect(fs.mkdir).toHaveBeenCalledWith(testFolder, { recursive: true })
		})

		it("saves messages to a file with timestamp and task text", async () => {
			await saver.saveConversation(mockMessages)

			// Verify file was written with correct path and content
			expect(fs.writeFile).toHaveBeenCalledWith(
				expect.stringContaining(testFolder),
				expect.stringContaining("# Conversation saved at"),
				"utf-8",
			)

			// Get the actual file path from the mock call
			const writeFileCall = (fs.writeFile as jest.Mock).mock.calls[0]
			const filePath = writeFileCall[0]

			// Verify filename format
			expect(filePath).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/)
			expect(filePath).toContain("Test-task")
		})

		it("throws error if saving fails", async () => {
			;(fs.writeFile as jest.Mock).mockRejectedValue(new Error("Write failed"))

			await expect(saver.saveConversation(mockMessages)).rejects.toThrow("Failed to save conversation")
		})
	})

	describe("updateConversation", () => {
		it("creates new file if no current file exists", async () => {
			await saver.updateConversation(mockMessages)

			expect(fs.writeFile).toHaveBeenCalledWith(
				expect.any(String),
				expect.stringContaining("# Conversation saved at"),
				"utf-8",
			)
		})

		it("updates existing file with new messages", async () => {
			// First save to create file
			await saver.saveConversation(mockMessages)
			const firstSavePath = (fs.writeFile as jest.Mock).mock.calls[0][0]

			// Clear mock to track next call
			jest.clearAllMocks()

			// Update with new messages
			const updatedMessages: ClineMessage[] = [
				...mockMessages,
				{
					ts: 3000,
					type: "say" as const,
					say: "text" as const,
					text: "New message",
				},
			]

			await saver.updateConversation(updatedMessages)

			// Should write to same file
			expect(fs.writeFile).toHaveBeenCalledWith(firstSavePath, expect.stringContaining("New message"), "utf-8")
		})

		it("throws error if update fails", async () => {
			;(fs.writeFile as jest.Mock).mockRejectedValue(new Error("Update failed"))

			await expect(saver.updateConversation(mockMessages)).rejects.toThrow("Failed to update conversation")
		})
	})

	describe("updateSaveFolder", () => {
		it("updates save folder path", async () => {
			const newFolder = "/new/save/folder"

			// Update folder should not throw
			expect(() => saver.updateSaveFolder(newFolder)).not.toThrow()

			// Save to verify new folder is used
			await saver.saveConversation(mockMessages)

			expect(fs.mkdir).toHaveBeenCalledWith(newFolder, { recursive: true })
			expect(fs.writeFile).toHaveBeenCalledWith(expect.stringContaining(newFolder), expect.any(String), "utf-8")
		})

		it("resets current file path when folder changes", async () => {
			// First save to create file in original folder
			const savedPath = await saver.saveConversation(mockMessages)
			expect(savedPath).toContain(testFolder)

			// Update folder and save again
			const newFolder = "/new/folder"
			saver.updateSaveFolder(newFolder)

			// Verify next save uses new folder
			const newSavedPath = await saver.saveConversation(mockMessages)
			expect(newSavedPath).toContain(newFolder)
			expect(newSavedPath).not.toContain(testFolder)
		})
	})
})
