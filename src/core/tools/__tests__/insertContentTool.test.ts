// npx jest src/core/tools/__tests__/insertContentTool.test.ts

import { insertContentTool } from "../insertContentTool"
import { Cline } from "../../Cline"
import { ToolUse } from "../../assistant-message"
import { AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../types"
import * as fsUtils from "../../../utils/fs"
import * as xmlUtils from "../../../utils/xml"
import * as insertGroupsUtil from "../../diff/insert-groups"
import * as formatResponseUtil from "../../prompts/responses"
import * as pathUtils from "../../../utils/path"
import fs from "fs/promises"
import path from "path"
import delay from "delay"

// Mock dependencies
jest.mock("fs/promises")
jest.mock("path")
jest.mock("../../../utils/fs")
jest.mock("../../../utils/xml")
jest.mock("../../diff/insert-groups")
jest.mock("delay")
jest.mock("../../../utils/path")

// Mock specific Cline methods/properties needed
const mockDiffViewProvider = {
	editType: null,
	originalContent: null,
	isEditing: false,
	open: jest.fn().mockResolvedValue(undefined),
	update: jest.fn().mockResolvedValue(undefined),
	scrollToFirstDiff: jest.fn(),
	revertChanges: jest.fn().mockResolvedValue(undefined),
	saveChanges: jest.fn(), // Will configure per test
	reset: jest.fn().mockResolvedValue(undefined),
}

const mockFileContextTracker = {
	trackFileContext: jest.fn().mockResolvedValue(undefined),
}

// Use a more type-safe approach for mocking Cline
const mockClineInstance = {
	cwd: "/workspace",
	consecutiveMistakeCount: 0,
	sayAndCreateMissingParamError: jest.fn().mockResolvedValue("Missing param error message"),
	say: jest.fn().mockResolvedValue(undefined),
	ask: jest.fn(), // Will configure per test
	diffViewProvider: mockDiffViewProvider,
	getFileContextTracker: jest.fn().mockReturnValue(mockFileContextTracker),
	didEditFile: false,
} as unknown as Cline

describe("insertContentTool", () => {
	let mockBlock: ToolUse
	let mockAskApproval: jest.MockedFunction<AskApproval>
	let mockHandleError: jest.MockedFunction<HandleError>
	let mockPushToolResult: jest.MockedFunction<PushToolResult>
	let mockRemoveClosingTag: jest.MockedFunction<RemoveClosingTag>
	let mockFileExistsAtPath: jest.MockedFunction<typeof fsUtils.fileExistsAtPath>
	let mockParseXml: jest.MockedFunction<typeof xmlUtils.parseXml>
	let mockInsertGroups: jest.MockedFunction<typeof insertGroupsUtil.insertGroups>
	let mockFormatResponse: any // Using any for simplicity in mocking formatResponse
	let mockFsReadFile: jest.MockedFunction<typeof fs.readFile>
	let mockPathResolve: jest.MockedFunction<typeof path.resolve>
	let mockDelay: jest.MockedFunction<typeof delay>
	let mockGetReadablePath: jest.MockedFunction<typeof pathUtils.getReadablePath>

	// Helper to reset mocks and setup default behaviors
	const setupMocks = () => {
		jest.clearAllMocks()

		// Assign mocks from modules
		mockFileExistsAtPath = fsUtils.fileExistsAtPath as jest.MockedFunction<typeof fsUtils.fileExistsAtPath>
		mockParseXml = xmlUtils.parseXml as jest.MockedFunction<typeof xmlUtils.parseXml>
		mockInsertGroups = insertGroupsUtil.insertGroups as jest.MockedFunction<typeof insertGroupsUtil.insertGroups>
		mockFormatResponse = formatResponseUtil.formatResponse
		mockFsReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>
		mockPathResolve = path.resolve as jest.MockedFunction<typeof path.resolve>
		mockDelay = delay as jest.MockedFunction<typeof delay>
		mockGetReadablePath = pathUtils.getReadablePath as jest.MockedFunction<typeof pathUtils.getReadablePath>

		// Reset Cline state object mocks
		mockClineInstance.consecutiveMistakeCount = 0
		mockClineInstance.didEditFile = false
		mockDiffViewProvider.isEditing = false // Reset editing state

		// Reset function mocks on Cline instance
		;(mockClineInstance.sayAndCreateMissingParamError as jest.Mock).mockClear()
		;(mockClineInstance.say as jest.Mock).mockClear()
		;(mockClineInstance.ask as jest.Mock).mockClear()
		;(mockClineInstance.getFileContextTracker as jest.Mock).mockClear().mockReturnValue(mockFileContextTracker)
		;(mockFileContextTracker.trackFileContext as jest.Mock).mockClear()

		// Reset DiffViewProvider mocks
		mockDiffViewProvider.open.mockClear()
		mockDiffViewProvider.update.mockClear()
		mockDiffViewProvider.scrollToFirstDiff.mockClear()
		mockDiffViewProvider.revertChanges.mockClear()
		mockDiffViewProvider.saveChanges.mockClear()
		mockDiffViewProvider.reset.mockClear()

		// Tool function mocks
		mockAskApproval = jest.fn() // Not directly used by insertContentTool, but part of the signature
		mockHandleError = jest.fn()
		mockPushToolResult = jest.fn()
		mockRemoveClosingTag = jest.fn((_tag, value) => value || "") // Simple mock returning the value

		// Default successful mock implementations
		mockPathResolve.mockImplementation((...paths) => path.join(...paths)) // Use path.join for simplicity
		mockGetReadablePath.mockImplementation((_cwd, relPath) => relPath || "") // Simple mock that always returns string
		mockFileExistsAtPath.mockResolvedValue(true)
		mockFsReadFile.mockResolvedValue("Line 1\nLine 3")
		mockParseXml.mockReturnValue({ operation: ":start_line:2\n-------\nInserted Line 2" })
		mockInsertGroups.mockReturnValue(["Line 1", "Inserted Line 2", "Line 3"])
		mockFormatResponse.createPrettyPatch = jest
			.fn()
			.mockReturnValue("@@ -1,2 +1,3 @@\n Line 1\n+Inserted Line 2\n Line 3")
		mockFormatResponse.toolError = jest.fn().mockImplementation((msg) => `Error: ${msg}`)
		mockDelay.mockResolvedValue(undefined)

		// Default approval flow
		;(mockClineInstance.ask as jest.Mock).mockResolvedValue({ response: "yesButtonClicked" }) // Default to approve
		mockDiffViewProvider.saveChanges.mockResolvedValue({
			newProblemsMessage: "",
			userEdits: null,
			finalContent: "Line 1\nInserted Line 2\nLine 3",
		})
	}

	beforeEach(() => {
		setupMocks() // Setup mocks before each test

		// Default ToolUse block
		mockBlock = {
			type: "tool_use",
			name: "insert_content",
			params: {
				path: "test.txt",
				operations: `<operation>:start_line:2\n-------\nInserted Line 2</operation>`,
			},
			partial: false,
		} as ToolUse
	})

	test("should successfully insert content when approved", async () => {
		// Arrange
		const originalContent = "Line 1\nLine 3"
		const finalContent = "Line 1\nInserted Line 2\nLine 3"
		const relPath = "test.txt"

		mockFsReadFile.mockResolvedValue(originalContent)
		mockDiffViewProvider.saveChanges.mockResolvedValue({
			newProblemsMessage: "",
			userEdits: null,
			finalContent,
		})

		// Act
		await insertContentTool(
			mockClineInstance,
			mockBlock,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)
		// Assert
		// Check file existence with the correct absolute path
		expect(mockFileExistsAtPath).toHaveBeenCalledWith(path.join("/workspace", "test.txt"))
		expect(mockFsReadFile).toHaveBeenCalledWith(path.join("/workspace", "test.txt"), "utf8") // Read file
		expect(mockParseXml).toHaveBeenCalledWith(mockBlock.params.operations) // Parse operations
		expect(mockInsertGroups).toHaveBeenCalledWith(
			originalContent.split("\n"),
			expect.arrayContaining([
				expect.objectContaining({
					index: 1, // 0-based index for line 2
					elements: expect.any(Array),
				}),
			]),
		)

		// Check diff view interactions
		expect(mockDiffViewProvider.open).toHaveBeenCalledWith(relPath)
		expect(mockDiffViewProvider.update).toHaveBeenCalledTimes(2) // Once with original, once with updated
		expect(mockDiffViewProvider.scrollToFirstDiff).toHaveBeenCalled()

		// Check user approval flow
		expect(mockClineInstance.ask).toHaveBeenCalledWith("tool", expect.any(String), expect.any(Boolean))
		expect(mockDiffViewProvider.saveChanges).toHaveBeenCalled()
		expect(mockFileContextTracker.trackFileContext).toHaveBeenCalledWith(relPath, "roo_edited")
		expect(mockClineInstance.didEditFile).toBe(true)

		// Check final result
		expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("successfully inserted"))
		expect(mockDiffViewProvider.reset).toHaveBeenCalled()
	})

	test("should handle missing path parameter", async () => {
		// Arrange
		mockBlock.params.path = undefined

		// Act
		await insertContentTool(
			mockClineInstance,
			mockBlock,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Assert
		expect(mockClineInstance.consecutiveMistakeCount).toBe(1)
		expect(mockClineInstance.sayAndCreateMissingParamError).toHaveBeenCalledWith("insert_content", "path")
		expect(mockPushToolResult).toHaveBeenCalled()
		expect(mockFileExistsAtPath).not.toHaveBeenCalled() // Should not proceed to file check
	})

	test("should handle missing operations parameter", async () => {
		// Arrange
		mockBlock.params.operations = undefined

		// Act
		await insertContentTool(
			mockClineInstance,
			mockBlock,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Assert
		expect(mockClineInstance.consecutiveMistakeCount).toBe(1)
		expect(mockClineInstance.sayAndCreateMissingParamError).toHaveBeenCalledWith("insert_content", "operations")
		expect(mockPushToolResult).toHaveBeenCalled()
	})

	test("should handle non-existent file", async () => {
		// Arrange
		mockFileExistsAtPath.mockResolvedValue(false)

		// Act
		await insertContentTool(
			mockClineInstance,
			mockBlock,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Assert
		expect(mockClineInstance.consecutiveMistakeCount).toBe(1)
		expect(mockClineInstance.say).toHaveBeenCalledWith("error", expect.stringContaining("File does not exist"))
		expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("File does not exist"))
	})

	test("should handle invalid XML operations format", async () => {
		// Arrange
		mockParseXml.mockImplementation(() => {
			throw new Error("XML parsing error")
		})

		// Act
		await insertContentTool(
			mockClineInstance,
			mockBlock,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Assert
		expect(mockClineInstance.consecutiveMistakeCount).toBe(1)
		expect(mockClineInstance.say).toHaveBeenCalledWith(
			"error",
			expect.stringContaining("Failed to parse operations"),
		)
		expect(mockPushToolResult).toHaveBeenCalledWith("Error: Invalid operations XML format")
	})

	test("should handle invalid operation format", async () => {
		// Arrange
		mockParseXml.mockReturnValue({ operation: "Invalid operation format without start_line" })

		// Act
		await insertContentTool(
			mockClineInstance,
			mockBlock,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Assert
		expect(mockClineInstance.consecutiveMistakeCount).toBe(1)
		expect(mockClineInstance.say).toHaveBeenCalledWith(
			"error",
			expect.stringContaining("Failed to parse operations"),
		)
	})

	test("should handle multiple operations", async () => {
		// Arrange
		const operations = [":start_line:2\n-------\nInserted Line 2", ":start_line:4\n-------\nInserted Line 4"]
		mockBlock.params.operations = `<operation>${operations[0]}</operation><operation>${operations[1]}</operation>`
		mockParseXml.mockReturnValue({ operation: operations })

		const originalContent = "Line 1\nLine 3\nLine 5"
		const finalContent = "Line 1\nInserted Line 2\nLine 3\nInserted Line 4\nLine 5"

		mockFsReadFile.mockResolvedValue(originalContent)
		mockInsertGroups.mockReturnValue(finalContent.split("\n"))

		// Act
		await insertContentTool(
			mockClineInstance,
			mockBlock,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Assert
		expect(mockInsertGroups).toHaveBeenCalledWith(
			originalContent.split("\n"),
			expect.arrayContaining([
				expect.objectContaining({ index: 1 }), // First operation
				expect.objectContaining({ index: 3 }), // Second operation
			]),
		)
		expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("successfully inserted"))
	})

	test("should handle user rejection of changes", async () => {
		// Arrange
		;(mockClineInstance.ask as jest.Mock).mockResolvedValue({ response: "noButtonClicked" })

		// Act
		await insertContentTool(
			mockClineInstance,
			mockBlock,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Assert
		expect(mockDiffViewProvider.revertChanges).toHaveBeenCalled()
		expect(mockPushToolResult).toHaveBeenCalledWith("Changes were rejected by the user.")
		expect(mockFileContextTracker.trackFileContext).not.toHaveBeenCalled()
		expect(mockClineInstance.didEditFile).toBe(false)
	})

	test("should handle user edits to the diff", async () => {
		// Arrange
		const userEdits = "User edited diff content"
		const finalContent = "Line 1\nUser Edited Line 2\nLine 3"

		mockDiffViewProvider.saveChanges.mockResolvedValue({
			newProblemsMessage: "",
			userEdits,
			finalContent,
		})

		// Act
		await insertContentTool(
			mockClineInstance,
			mockBlock,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Assert
		expect(mockClineInstance.say).toHaveBeenCalledWith("user_feedback_diff", expect.any(String))
		expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("The user made the following updates"))
		expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining(userEdits))
		expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining(finalContent))
	})

	test("should handle no changes needed", async () => {
		// Arrange
		mockFormatResponse.createPrettyPatch.mockReturnValue(null) // No diff generated

		// Act
		await insertContentTool(
			mockClineInstance,
			mockBlock,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Assert
		expect(mockDiffViewProvider.update).toHaveBeenCalledTimes(1) // Only the initial update
		expect(mockClineInstance.ask).toHaveBeenCalledTimes(1) // Only the initial ask
		expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("No changes needed"))
	})

	test("should handle errors during execution", async () => {
		// Arrange
		const error = new Error("Test error")
		mockFsReadFile.mockRejectedValue(error)

		// Act
		await insertContentTool(
			mockClineInstance,
			mockBlock,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Assert
		expect(mockHandleError).toHaveBeenCalledWith("insert content", error)
		expect(mockDiffViewProvider.reset).toHaveBeenCalled()
	})

	test("should handle partial tool use", async () => {
		// Arrange
		mockBlock.partial = true

		// Act
		await insertContentTool(
			mockClineInstance,
			mockBlock,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Assert
		expect(mockClineInstance.ask).toHaveBeenCalledWith("tool", expect.any(String), true)
		expect(mockFileExistsAtPath).not.toHaveBeenCalled() // Should not proceed with normal flow
		expect(mockPushToolResult).not.toHaveBeenCalled()
	})

	test("should handle new problems message after saving changes", async () => {
		// Arrange
		const newProblemsMessage = "\n\nWarning: There are some linting issues in the file."
		mockDiffViewProvider.saveChanges.mockResolvedValue({
			newProblemsMessage,
			userEdits: null,
			finalContent: "Line 1\nInserted Line 2\nLine 3",
		})

		// Act
		await insertContentTool(
			mockClineInstance,
			mockBlock,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Assert
		expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining(newProblemsMessage))
	})
})
