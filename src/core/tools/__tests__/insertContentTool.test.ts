import * as path from "path"
import * as fs from "fs/promises"

import { fileExistsAtPath } from "../../../utils/fs"
import { ToolUse, ToolResponse } from "../../../shared/tools"
import { insertContentTool } from "../insertContentTool"

// Mock external dependencies
jest.mock("path", () => {
	const originalPath = jest.requireActual("path")
	return {
		...originalPath,
		resolve: jest.fn().mockImplementation((...args) => args.join("/")),
	}
})

jest.mock("fs/promises", () => ({
	readFile: jest.fn(),
	writeFile: jest.fn(),
}))

jest.mock("delay", () => jest.fn())

jest.mock("../../../utils/fs", () => ({
	fileExistsAtPath: jest.fn().mockResolvedValue(false),
}))

jest.mock("../../prompts/responses", () => ({
	formatResponse: {
		toolError: jest.fn((msg) => `Error: ${msg}`),
		rooIgnoreError: jest.fn((path) => `Access denied: ${path}`),
		createPrettyPatch: jest.fn((_path, original, updated) => `Diff: ${original} -> ${updated}`),
	},
}))

jest.mock("../../../utils/path", () => ({
	getReadablePath: jest.fn().mockReturnValue("test/path.txt"),
}))

jest.mock("../../ignore/RooIgnoreController", () => ({
	RooIgnoreController: class {
		initialize() {
			return Promise.resolve()
		}
		validateAccess() {
			return true
		}
	},
}))

describe("insertContentTool", () => {
	const testFilePath = "test/file.txt"
	const absoluteFilePath = "/test/file.txt"

	const mockedFileExistsAtPath = fileExistsAtPath as jest.MockedFunction<typeof fileExistsAtPath>
	const mockedFsReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>
	const mockedPathResolve = path.resolve as jest.MockedFunction<typeof path.resolve>

	let mockCline: any
	let mockAskApproval: jest.Mock
	let mockHandleError: jest.Mock
	let mockPushToolResult: jest.Mock
	let mockRemoveClosingTag: jest.Mock
	let toolResult: ToolResponse | undefined

	beforeEach(() => {
		jest.clearAllMocks()

		mockedPathResolve.mockReturnValue(absoluteFilePath)
		mockedFileExistsAtPath.mockResolvedValue(true) // Assume file exists by default for insert
		mockedFsReadFile.mockResolvedValue("") // Default empty file content

		mockCline = {
			cwd: "/",
			consecutiveMistakeCount: 0,
			didEditFile: false,
			rooIgnoreController: {
				validateAccess: jest.fn().mockReturnValue(true),
			},
			diffViewProvider: {
				editType: undefined,
				isEditing: false,
				originalContent: "",
				open: jest.fn().mockResolvedValue(undefined),
				update: jest.fn().mockResolvedValue(undefined),
				reset: jest.fn().mockResolvedValue(undefined),
				revertChanges: jest.fn().mockResolvedValue(undefined),
				saveChanges: jest.fn().mockResolvedValue({
					newProblemsMessage: "",
					userEdits: null,
					finalContent: "final content",
				}),
				scrollToFirstDiff: jest.fn(),
				pushToolWriteResult: jest.fn().mockImplementation(async function (
					this: any,
					task: any,
					cwd: string,
					isNewFile: boolean,
				) {
					return "Tool result message"
				}),
			},
			fileContextTracker: {
				trackFileContext: jest.fn().mockResolvedValue(undefined),
			},
			say: jest.fn().mockResolvedValue(undefined),
			ask: jest.fn().mockResolvedValue({ response: "yesButtonClicked" }), // Default to approval
			recordToolError: jest.fn(),
			sayAndCreateMissingParamError: jest.fn().mockResolvedValue("Missing param error"),
		}

		mockAskApproval = jest.fn().mockResolvedValue(true)
		mockHandleError = jest.fn().mockResolvedValue(undefined)
		mockRemoveClosingTag = jest.fn((tag, content) => content)

		toolResult = undefined
	})

	async function executeInsertContentTool(
		params: Partial<ToolUse["params"]> = {},
		options: {
			fileExists?: boolean
			isPartial?: boolean
			accessAllowed?: boolean
			fileContent?: string
			askApprovalResponse?: "yesButtonClicked" | "noButtonClicked" | string
		} = {},
	): Promise<ToolResponse | undefined> {
		const fileExists = options.fileExists ?? true
		const isPartial = options.isPartial ?? false
		const accessAllowed = options.accessAllowed ?? true
		const fileContent = options.fileContent ?? ""

		mockedFileExistsAtPath.mockResolvedValue(fileExists)
		mockedFsReadFile.mockResolvedValue(fileContent)
		mockCline.rooIgnoreController.validateAccess.mockReturnValue(accessAllowed)
		mockCline.ask.mockResolvedValue({ response: options.askApprovalResponse ?? "yesButtonClicked" })

		const toolUse: ToolUse = {
			type: "tool_use",
			name: "insert_content",
			params: {
				path: testFilePath,
				line: "1",
				content: "New content",
				...params,
			},
			partial: isPartial,
		}

		await insertContentTool(
			mockCline,
			toolUse,
			mockAskApproval,
			mockHandleError,
			(result: ToolResponse) => {
				toolResult = result
			},
			mockRemoveClosingTag,
		)

		return toolResult
	}

	describe("new file creation logic", () => {
		it("creates a new file and inserts content at line 0 (append)", async () => {
			const contentToInsert = "New Line 1\nNew Line 2"
			await executeInsertContentTool(
				{ line: "0", content: contentToInsert },
				{ fileExists: false, fileContent: "" },
			)

			expect(mockedFileExistsAtPath).toHaveBeenCalledWith(absoluteFilePath)
			expect(mockedFsReadFile).not.toHaveBeenCalled() // Should not read if file doesn't exist
			expect(mockCline.diffViewProvider.update).toHaveBeenCalledWith(contentToInsert, true)
			expect(mockCline.diffViewProvider.editType).toBe("create")
			expect(mockCline.diffViewProvider.pushToolWriteResult).toHaveBeenCalledWith(mockCline, mockCline.cwd, true)
		})

		it("creates a new file and inserts content at line 1 (beginning)", async () => {
			const contentToInsert = "Hello World!"
			await executeInsertContentTool(
				{ line: "1", content: contentToInsert },
				{ fileExists: false, fileContent: "" },
			)

			expect(mockedFileExistsAtPath).toHaveBeenCalledWith(absoluteFilePath)
			expect(mockedFsReadFile).not.toHaveBeenCalled()
			expect(mockCline.diffViewProvider.update).toHaveBeenCalledWith(contentToInsert, true)
			expect(mockCline.diffViewProvider.editType).toBe("create")
			expect(mockCline.diffViewProvider.pushToolWriteResult).toHaveBeenCalledWith(mockCline, mockCline.cwd, true)
		})

		it("creates an empty new file if content is empty string", async () => {
			await executeInsertContentTool({ line: "1", content: "" }, { fileExists: false, fileContent: "" })

			expect(mockedFileExistsAtPath).toHaveBeenCalledWith(absoluteFilePath)
			expect(mockedFsReadFile).not.toHaveBeenCalled()
			expect(mockCline.diffViewProvider.update).toHaveBeenCalledWith("", true)
			expect(mockCline.diffViewProvider.editType).toBe("create")
			expect(mockCline.diffViewProvider.pushToolWriteResult).toHaveBeenCalledWith(mockCline, mockCline.cwd, true)
		})

		it("returns an error when inserting content at an arbitrary line number into a new file", async () => {
			const contentToInsert = "Arbitrary insert"
			const result = await executeInsertContentTool(
				{ line: "5", content: contentToInsert },
				{ fileExists: false, fileContent: "" },
			)

			expect(mockedFileExistsAtPath).toHaveBeenCalledWith(absoluteFilePath)
			expect(mockedFsReadFile).not.toHaveBeenCalled()
			expect(mockCline.consecutiveMistakeCount).toBe(1)
			expect(mockCline.recordToolError).toHaveBeenCalledWith("insert_content")
			expect(mockCline.say).toHaveBeenCalledWith("error", expect.stringContaining("non-existent file"))
			expect(mockCline.diffViewProvider.update).not.toHaveBeenCalled()
			expect(mockCline.diffViewProvider.pushToolWriteResult).not.toHaveBeenCalled()
		})
	})
})
