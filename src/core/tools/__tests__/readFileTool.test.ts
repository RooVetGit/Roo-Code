import { processFileForReading, formatProcessedFileResultToString } from "../../../shared/fileReadUtils"
import { ToolUse } from "../../../shared/tools"
import { readFileTool } from "../readFileTool"

jest.mock("../../../shared/fileReadUtils")
jest.mock("path", () => {
	const originalPath = jest.requireActual("path")
	return {
		...originalPath,
		resolve: jest.fn().mockImplementation((...args) => args.join("/")),
	}
})

describe("readFileTool tests", () => {
	let mockPushToolResult: jest.Mock
	let mockAskApproval: jest.Mock
	let mockRemoveClosingTag: jest.Mock
	let mockHandleError: jest.Mock
	let mockCline: any
	let mockProvider: any

	beforeEach(() => {
		jest.clearAllMocks()

		// Mock for providerRef.deref().getState()
		mockProvider = {
			getState: jest.fn().mockResolvedValue({ maxReadFileLine: 500 }), // Default maxReadFileLine
			deref: jest.fn().mockReturnThis(),
		}

		mockPushToolResult = jest.fn()
		mockAskApproval = jest.fn().mockResolvedValue(true)
		mockRemoveClosingTag = jest.fn((_, content) => content)
		mockHandleError = jest.fn()

		mockCline = {
			cwd: "/test/workspace",
			task: "TestTask",
			providerRef: mockProvider,
			rooIgnoreController: {
				validateAccess: jest.fn().mockReturnValue(true),
			},
			fileContextTracker: {
				trackFileContext: jest.fn().mockResolvedValue(undefined),
			},
			say: jest.fn().mockResolvedValue(undefined),
			ask: mockAskApproval,
			recordToolError: jest.fn(),
			sayAndCreateMissingParamError: jest.fn().mockResolvedValue("Missing required parameter"),
			consecutiveMistakeCount: 0,
		}

		// Reset individual spies
		mockPushToolResult.mockClear()
		mockAskApproval.mockClear().mockResolvedValue(true)
		mockRemoveClosingTag.mockClear().mockImplementation((_, content) => content)
		mockHandleError.mockClear()
		;(processFileForReading as jest.Mock).mockClear()
		;(formatProcessedFileResultToString as jest.Mock).mockClear()
	})

	it("should have readFileTool defined", () => {
		expect(readFileTool).toBeDefined()
	})

	describe("Parameter Validation and Error Handling", () => {
		it("should handle missing path parameter", async () => {
			const block: ToolUse = {
				type: "tool_use" as const,
				name: "read_file",
				params: {},
				partial: false,
			}

			await readFileTool(
				mockCline,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockCline.sayAndCreateMissingParamError).toHaveBeenCalledWith("read_file", "path")
			expect(mockPushToolResult).toHaveBeenCalledWith(
				"<file><path></path><error>Missing required parameter</error></file>",
			)
			expect(processFileForReading).not.toHaveBeenCalled()
			expect(mockCline.consecutiveMistakeCount).toBe(1)
			expect(mockCline.recordToolError).toHaveBeenCalledWith("read_file")
		})

		it("should handle invalid start_line parameter", async () => {
			const block: ToolUse = {
				type: "tool_use" as const,
				name: "read_file",
				params: {
					path: "test/file.txt",
					start_line: "not-a-number",
				},
				partial: false,
			}

			await readFileTool(
				mockCline,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockCline.say).toHaveBeenCalledWith("error", "Failed to parse start_line: not-a-number")
			expect(mockPushToolResult).toHaveBeenCalledWith(
				"<file><path>test/file.txt</path><error>Invalid start_line value</error></file>",
			)
			expect(processFileForReading).not.toHaveBeenCalled()
			expect(mockCline.consecutiveMistakeCount).toBe(1)
			expect(mockCline.recordToolError).toHaveBeenCalledWith("read_file")
		})

		it("should handle invalid end_line parameter", async () => {
			const block: ToolUse = {
				type: "tool_use" as const,
				name: "read_file",
				params: {
					path: "test/file.txt",
					end_line: "not-a-number",
				},
				partial: false,
			}

			await readFileTool(
				mockCline,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockCline.say).toHaveBeenCalledWith("error", "Failed to parse end_line: not-a-number")
			expect(mockPushToolResult).toHaveBeenCalledWith(
				"<file><path>test/file.txt</path><error>Invalid end_line value</error></file>",
			)
			expect(processFileForReading).not.toHaveBeenCalled()
			expect(mockCline.consecutiveMistakeCount).toBe(1)
			expect(mockCline.recordToolError).toHaveBeenCalledWith("read_file")
		})
	})

	describe("Main Execution, Approval Flow, and Line Snippets", () => {
		const setupReadFileTest = async (params: Record<string, string>, maxReadFileLine: number = 500) => {
			mockProvider.getState.mockResolvedValue({ maxReadFileLine })
			;(processFileForReading as jest.Mock).mockResolvedValue({
				type: "success",
				path: "test/file.txt",
				content: "file content",
				lines: "1-1",
				totalLines: 1,
				isBinary: false,
			})
			;(formatProcessedFileResultToString as jest.Mock).mockReturnValue(
				"<file><path>test/file.txt</path><content>file content</content></file>",
			)

			const block: ToolUse = {
				type: "tool_use" as const,
				name: "read_file",
				params,
				partial: false,
			}

			await readFileTool(
				mockCline,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)
		}

		it("should handle full file read", async () => {
			await setupReadFileTest({ path: "test/file.txt" }, -1)

			expect(mockAskApproval).toHaveBeenCalledWith("tool", expect.any(String))
			const approvalMessage = JSON.parse(mockAskApproval.mock.calls[0][1])
			expect(approvalMessage.reason).toBeFalsy()

			expect(processFileForReading).toHaveBeenCalled()
			expect(mockCline.fileContextTracker.trackFileContext).toHaveBeenCalledWith("test/file.txt", "read_tool")
			expect(mockPushToolResult).toHaveBeenCalled()
		})

		it("should handle range specified read", async () => {
			await setupReadFileTest({
				path: "test/file.txt",
				start_line: "2",
				end_line: "4",
			})

			const approvalMessage = JSON.parse(mockAskApproval.mock.calls[0][1])
			expect(approvalMessage.reason).toBe("readFile.linesRange")
		})

		it("should handle start_line only read", async () => {
			await setupReadFileTest({
				path: "test/file.txt",
				start_line: "2",
			})

			const approvalMessage = JSON.parse(mockAskApproval.mock.calls[0][1])
			expect(approvalMessage.reason).toBe("readFile.linesFromToEnd")
		})

		it("should handle end_line only read", async () => {
			await setupReadFileTest({
				path: "test/file.txt",
				end_line: "4",
			})

			const approvalMessage = JSON.parse(mockAskApproval.mock.calls[0][1])
			expect(approvalMessage.reason).toBe("readFile.linesFromStartTo")
		})

		it("should handle definitions only read", async () => {
			await setupReadFileTest({ path: "test/file.txt" }, 0)

			const approvalMessage = JSON.parse(mockAskApproval.mock.calls[0][1])
			expect(approvalMessage.reason).toBe("readFile.definitionsOnly")
		})

		it("should handle max lines read", async () => {
			await setupReadFileTest({ path: "test/file.txt" }, 100)

			const approvalMessage = JSON.parse(mockAskApproval.mock.calls[0][1])
			expect(approvalMessage.reason).toBe("readFile.maxLines")
		})

		it("should handle file read denied", async () => {
			mockAskApproval.mockResolvedValueOnce(false)
			await setupReadFileTest({ path: "test/file.txt" })

			expect(processFileForReading).not.toHaveBeenCalled()
			expect(mockPushToolResult).not.toHaveBeenCalled()
		})

		it("should handle partial block processing", async () => {
			const block: ToolUse = {
				type: "tool_use" as const,
				name: "read_file",
				params: { path: "test/file.txt" },
				partial: true,
			}

			await readFileTool(
				mockCline,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockCline.ask).toHaveBeenCalledWith("tool", expect.stringContaining('"tool":"readFile"'), true)
			expect(processFileForReading).not.toHaveBeenCalled()
			expect(mockPushToolResult).not.toHaveBeenCalled()
		})

		it("should handle error during processFileForReading", async () => {
			const error = new Error("Simulated read error")
			;(processFileForReading as jest.Mock).mockRejectedValueOnce(error)

			await setupReadFileTest({ path: "test/file.txt" })

			expect(mockHandleError).toHaveBeenCalledWith("reading file", error)
			expect(mockPushToolResult).toHaveBeenCalledWith(
				"<file><path>test/file.txt</path><error>Error reading file: Simulated read error</error></file>",
			)
		})
	})
})
