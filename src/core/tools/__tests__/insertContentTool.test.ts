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

// Mock insertGroups from diff/insert-groups
jest.mock("../../diff/insert-groups", () => ({
	insertGroups: jest.fn().mockImplementation((lines, groups) => {
		let newLines = [...lines]
		for (const group of groups) {
			const { index, elements } = group
			if (index === -1 || index >= newLines.length) {
				// Append to end
				newLines.push(...elements)
			} else if (index < 0) {
				// Insert at beginning (index -1 for line 0, but insertGroups expects 0 for beginning)
				// This mock simplifies, assuming index -1 is always append.
				// For line 1, index is 0.
				newLines.splice(0, 0, ...elements)
			} else {
				newLines.splice(index, 0, ...elements)
			}
		}
		return newLines
	}),
}))

describe("insertContentTool", () => {
	const testFilePath = "test/file.txt"
	const absoluteFilePath = "/test/file.txt"

	const mockedFileExistsAtPath = fileExistsAtPath as jest.MockedFunction<typeof fileExistsAtPath>
	const mockedFsReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>
	const mockedPathResolve = path.resolve as jest.MockedFunction<typeof path.resolve>
	const mockedInsertGroups = require("../../diff/insert-groups").insertGroups as jest.MockedFunction<any>

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

	describe("parameter validation", () => {
		it("returns error if path is missing", async () => {
			const result = await executeInsertContentTool({ path: undefined })
			expect(mockCline.sayAndCreateMissingParamError).toHaveBeenCalledWith("insert_content", "path")
			expect(result).toBe("Missing param error")
		})

		it("returns error if line is missing", async () => {
			const result = await executeInsertContentTool({ line: undefined })
			expect(mockCline.sayAndCreateMissingParamError).toHaveBeenCalledWith("insert_content", "line")
			expect(result).toBe("Missing param error")
		})

		it("returns error if content is missing", async () => {
			const result = await executeInsertContentTool({ content: undefined })
			expect(mockCline.sayAndCreateMissingParamError).toHaveBeenCalledWith("insert_content", "content")
			expect(result).toBe("Missing param error")
		})

		it("returns error if line number is invalid (NaN)", async () => {
			const result = await executeInsertContentTool({ line: "abc" })
			expect(result).toBe("Error: Invalid line number. Must be a non-negative integer.")
		})

		it("returns error if line number is invalid (negative)", async () => {
			const result = await executeInsertContentTool({ line: "-5" })
			expect(result).toBe("Error: Invalid line number. Must be a non-negative integer.")
		})
	})

	describe("file existence and access", () => {
		it("returns error if file does not exist", async () => {
			const result = await executeInsertContentTool({}, { fileExists: false })
			expect(mockCline.say).toHaveBeenCalledWith(
				"error",
				expect.stringContaining(`File does not exist at path: ${absoluteFilePath}`),
			)
			expect(result).toBe(
				`File does not exist at path: ${absoluteFilePath}\n\n<error_details>\nThe specified file could not be found. Please verify the file path and try again.\n</error_details>`,
			)
		})

		it("returns error if access is denied by rooIgnoreController", async () => {
			const result = await executeInsertContentTool({}, { accessAllowed: false })
			expect(mockCline.say).toHaveBeenCalledWith("rooignore_error", testFilePath)
		})
	})

	describe("insertion logic", () => {
		it("inserts content at the beginning of an empty file (line 1)", async () => {
			const contentToInsert = "Line 1\nLine 2"
			await executeInsertContentTool({ line: "1", content: contentToInsert }, { fileContent: "" })

			expect(mockCline.diffViewProvider.update).toHaveBeenCalledWith(contentToInsert + "\n", true)
		})

		it("inserts content at the beginning of a file with content (line 1)", async () => {
			const originalContent = "Existing Line 1\nExisting Line 2"
			const contentToInsert = "New Line A\nNew Line B"
			await executeInsertContentTool({ line: "1", content: contentToInsert }, { fileContent: originalContent })

			const expectedContent = "New Line A\nNew Line B\nExisting Line 1\nExisting Line 2"
			expect(mockCline.diffViewProvider.update).toHaveBeenCalledWith(expectedContent, true)
		})

		it("appends content to an empty file (line 0)", async () => {
			const contentToInsert = "Appended Line 1\nAppended Line 2"
			await executeInsertContentTool({ line: "0", content: contentToInsert }, { fileContent: "" })

			expect(mockCline.diffViewProvider.update).toHaveBeenCalledWith(contentToInsert, true)
		})

		it("appends content to a file that does NOT end with a newline (line 0)", async () => {
			const originalContent = "Existing Line 1\nExisting Line 2"
			const contentToInsert = "Appended Line 1\nAppended Line 2"
			await executeInsertContentTool({ line: "0", content: contentToInsert }, { fileContent: originalContent })

			const expectedContent = "Existing Line 1\nExisting Line 2\nAppended Line 1\nAppended Line 2"
			expect(mockCline.diffViewProvider.update).toHaveBeenCalledWith(expectedContent, true)
		})

		it("appends content to a file that DOES end with a newline (line 0)", async () => {
			const originalContent = "Existing Line 1\nExisting Line 2\n" // Ends with newline
			const contentToInsert = "Appended Line 1\nAppended Line 2"
			await executeInsertContentTool({ line: "0", content: contentToInsert }, { fileContent: originalContent })

			// Expected: no extra blank line
			const expectedContent = "Existing Line 1\nExisting Line 2\nAppended Line 1\nAppended Line 2"
			expect(mockCline.diffViewProvider.update).toHaveBeenCalledWith(expectedContent, true)
		})

		it("handles content with multiple leading carriage returns", async () => {
			const originalContent = "Existing Line"
			const contentToInsert = "\n\nNew Line"
			await executeInsertContentTool({ line: "0", content: contentToInsert }, { fileContent: originalContent })

			const expectedContent = "Existing Line\n\n\nNew Line" // Original + 2 newlines + content
			expect(mockCline.diffViewProvider.update).toHaveBeenCalledWith(expectedContent, true)
		})

		it("handles content with multiple trailing carriage returns", async () => {
			const originalContent = "Existing Line"
			const contentToInsert = "New Line\n\n"
			await executeInsertContentTool({ line: "0", content: contentToInsert }, { fileContent: originalContent })

			const expectedContent = "Existing Line\nNew Line\n\n"
			expect(mockCline.diffViewProvider.update).toHaveBeenCalledWith(expectedContent, true)
		})

		it("handles content with both leading and trailing carriage returns", async () => {
			const originalContent = "Existing Line"
			const contentToInsert = "\n\nNew Line\n\n"
			await executeInsertContentTool({ line: "0", content: contentToInsert }, { fileContent: originalContent })

			const expectedContent = "Existing Line\n\n\nNew Line\n\n"
			expect(mockCline.diffViewProvider.update).toHaveBeenCalledWith(expectedContent, true)
		})

		it("inserts content in the middle of a file", async () => {
			const originalContent = "Line 1\nLine 2\nLine 3"
			const contentToInsert = "Inserted A\nInserted B"
			await executeInsertContentTool({ line: "2", content: contentToInsert }, { fileContent: originalContent })

			const expectedContent = "Line 1\nInserted A\nInserted B\nLine 2\nLine 3"
			expect(mockCline.diffViewProvider.update).toHaveBeenCalledWith(expectedContent, true)
		})
	})
})
