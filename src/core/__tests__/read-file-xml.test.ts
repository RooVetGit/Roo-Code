import * as path from "path"
import { readFileContent } from "../../integrations/misc/extract-text"
import { ReadFileToolUse } from "../assistant-message"
import { Cline } from "../Cline"

// Mock dependencies
jest.mock("../../integrations/misc/extract-text")
jest.mock("../ignore/RooIgnoreController", () => ({
	RooIgnoreController: class {
		initialize() {
			return Promise.resolve()
		}
		validateAccess() {
			return true
		}
	},
}))
jest.mock("fs/promises", () => ({
	mkdir: jest.fn().mockResolvedValue(undefined),
	writeFile: jest.fn().mockResolvedValue(undefined),
	readFile: jest.fn().mockResolvedValue("{}"),
}))
jest.mock("../../utils/fs", () => ({
	fileExistsAtPath: jest.fn().mockReturnValue(true),
}))

// Mock path
jest.mock("path", () => {
	const originalPath = jest.requireActual("path")
	return {
		...originalPath,
		resolve: jest.fn().mockImplementation((...args) => args.join("/")),
	}
})

describe("read_file tool XML output structure", () => {
	// Test data
	const testFilePath = "test/file.txt"
	const absoluteFilePath = "/test/file.txt"
	const fileContent = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5"
	const numberedFileContent = "1 | Line 1\n2 | Line 2\n3 | Line 3\n4 | Line 4\n5 | Line 5\n"

	// Mocked functions with correct types
	const mockedReadFileContent = readFileContent as jest.MockedFunction<typeof readFileContent>
	const mockedPathResolve = path.resolve as jest.MockedFunction<typeof path.resolve>

	// Mock instances
	const mockCline: any = {}
	let mockProvider: any
	let toolResult: string | undefined

	beforeEach(() => {
		jest.clearAllMocks()

		// Setup path resolution
		mockedPathResolve.mockReturnValue(absoluteFilePath)

		// Setup mock provider
		mockProvider = {
			getState: jest.fn().mockResolvedValue({ maxReadFileLine: 500 }),
			deref: jest.fn().mockReturnThis(),
		}

		// Setup Cline instance with mock methods
		mockCline.cwd = "/"
		mockCline.task = "Test"
		mockCline.providerRef = mockProvider
		mockCline.rooIgnoreController = {
			validateAccess: jest.fn().mockReturnValue(true),
		}
		mockCline.say = jest.fn().mockResolvedValue(undefined)
		mockCline.ask = jest.fn().mockResolvedValue(true)
		mockCline.presentAssistantMessage = jest.fn()
		mockCline.sayAndCreateMissingParamError = jest.fn().mockResolvedValue("Missing required parameter")
		// Add mock for getFileContextTracker method
		mockCline.getFileContextTracker = jest.fn().mockReturnValue({
			trackFileContext: jest.fn().mockResolvedValue(undefined),
		})

		// Reset tool result
		toolResult = undefined
	})

	/**
	 * Helper function to execute the read file tool with custom parameters
	 */
	async function executeReadFileTool(
		params: Partial<ReadFileToolUse["params"]> = {},
		options: {
			maxReadFileLine?: number
			validateAccess?: boolean
		} = {},
	): Promise<string | undefined> {
		const { maxReadFileLine = 500, validateAccess = true } = options

		mockProvider.getState.mockResolvedValue({ maxReadFileLine })
		mockCline.rooIgnoreController.validateAccess = jest.fn().mockReturnValue(validateAccess)

		// Create a tool use object
		const toolUse: ReadFileToolUse = {
			type: "tool_use",
			name: "read_file",
			params: {
				path: testFilePath,
				...params,
			},
			partial: false,
		}

		// Import the tool implementation dynamically to avoid hoisting issues
		const { readFileTool } = require("../tools/readFileTool")

		// Execute the tool
		await readFileTool(
			mockCline,
			toolUse,
			mockCline.ask,
			jest.fn(),
			(result: string) => {
				toolResult = result
			},
			(param: string, value: string) => value,
		)

		return toolResult
	}

	describe("Basic XML Structure Tests", () => {
		it("should produce XML output with no unnecessary indentation", async () => {
			// Setup mock response
			mockedReadFileContent.mockResolvedValue(
				`<file><path>${testFilePath}</path>\n<content lines="1-5">\n${numberedFileContent}</content>\n</file>`,
			)

			// Execute
			const result = await executeReadFileTool()

			// Verify
			expect(result).toBe(
				`<file><path>${testFilePath}</path>\n<content lines="1-5">\n${numberedFileContent}</content>\n</file>`,
			)
		})

		it("should follow the correct XML structure format", async () => {
			// Setup mock response
			mockedReadFileContent.mockResolvedValue(
				`<file><path>${testFilePath}</path>\n<content lines="1-5">\n${numberedFileContent}</content>\n</file>`,
			)

			// Execute
			const result = await executeReadFileTool()

			// Verify using regex to check structure
			const xmlStructureRegex = new RegExp(
				`^<file><path>${testFilePath}</path>\\n<content lines="1-5">\\n.*</content>\\n</file>$`,
				"s",
			)
			expect(result).toMatch(xmlStructureRegex)
		})
	})

	describe("Line Range Tests", () => {
		it("should include lines attribute when start_line is specified", async () => {
			const startLine = 2
			mockedReadFileContent.mockResolvedValue(
				`<file><path>${testFilePath}</path>\n<content lines="${startLine}-5">\n${numberedFileContent}</content>\n</file>`,
			)

			const result = await executeReadFileTool({ start_line: startLine.toString() })

			expect(result).toContain(`<content lines="${startLine}-5">`)
		})

		it("should include lines attribute when end_line is specified", async () => {
			const endLine = 3
			mockedReadFileContent.mockResolvedValue(
				`<file><path>${testFilePath}</path>\n<content lines="1-${endLine}">\n${numberedFileContent}</content>\n</file>`,
			)

			const result = await executeReadFileTool({ end_line: endLine.toString() })

			expect(result).toContain(`<content lines="1-${endLine}">`)
		})

		it("should include lines attribute when both start_line and end_line are specified", async () => {
			const startLine = 2
			const endLine = 4
			mockedReadFileContent.mockResolvedValue(
				`<file><path>${testFilePath}</path>\n<content lines="${startLine}-${endLine}">\n${numberedFileContent}</content>\n</file>`,
			)

			const result = await executeReadFileTool({
				start_line: startLine.toString(),
				end_line: endLine.toString(),
			})

			expect(result).toContain(`<content lines="${startLine}-${endLine}">`)
		})

		it("should include content when maxReadFileLine=0 and range is specified", async () => {
			const maxReadFileLine = 0
			const startLine = 2
			const endLine = 4
			const totalLines = 10

			mockedReadFileContent.mockResolvedValue(
				`<file><path>${testFilePath}</path>\n<content lines="${startLine}-${endLine}">\n${numberedFileContent}</content>\n</file>`,
			)

			const result = await executeReadFileTool(
				{
					start_line: startLine.toString(),
					end_line: endLine.toString(),
				},
				{ maxReadFileLine },
			)

			expect(result).toContain(`<content lines="${startLine}-${endLine}">`)
			expect(result).not.toContain("<list_code_definition_names>")
			expect(result).not.toContain(`<notice>Showing only ${maxReadFileLine} of ${totalLines} total lines`)
		})

		it("should include content when maxReadFileLine=0 and only start_line is specified", async () => {
			const maxReadFileLine = 0
			const startLine = 3
			const totalLines = 10

			mockedReadFileContent.mockResolvedValue(
				`<file><path>${testFilePath}</path>\n<content lines="${startLine}-${totalLines}">\n${numberedFileContent}</content>\n</file>`,
			)

			const result = await executeReadFileTool(
				{
					start_line: startLine.toString(),
				},
				{ maxReadFileLine },
			)

			expect(result).toContain(`<content lines="${startLine}-${totalLines}">`)
			expect(result).not.toContain("<list_code_definition_names>")
			expect(result).not.toContain(`<notice>Showing only ${maxReadFileLine} of ${totalLines} total lines`)
		})

		it("should include content when maxReadFileLine=0 and only end_line is specified", async () => {
			const maxReadFileLine = 0
			const endLine = 3
			const totalLines = 10

			mockedReadFileContent.mockResolvedValue(
				`<file><path>${testFilePath}</path>\n<content lines="1-${endLine}">\n${numberedFileContent}</content>\n</file>`,
			)

			const result = await executeReadFileTool(
				{
					end_line: endLine.toString(),
				},
				{ maxReadFileLine },
			)

			expect(result).toContain(`<content lines="1-${endLine}">`)
			expect(result).not.toContain("<list_code_definition_names>")
			expect(result).not.toContain(`<notice>Showing only ${maxReadFileLine} of ${totalLines} total lines`)
		})

		it("should include full range content when maxReadFileLine=5 and content has more than 5 lines", async () => {
			const maxReadFileLine = 5
			const startLine = 2
			const endLine = 8
			const totalLines = 10
			const rangeContent = Array(endLine - startLine + 1)
				.fill("Range line content")
				.map((line, i) => `${startLine + i} | ${line}`)
				.join("\n")

			mockedReadFileContent.mockResolvedValue(
				`<file><path>${testFilePath}</path>\n<content lines="${startLine}-${endLine}">\n${rangeContent}\n</content>\n</file>`,
			)

			const result = await executeReadFileTool(
				{
					start_line: startLine.toString(),
					end_line: endLine.toString(),
				},
				{ maxReadFileLine },
			)

			expect(result).toContain(`<content lines="${startLine}-${endLine}">`)
			expect(result).not.toContain("<list_code_definition_names>")
			expect(result).not.toContain(`<notice>Showing only ${maxReadFileLine} of ${totalLines} total lines`)
			expect(result?.split("\n").length).toBeGreaterThan(maxReadFileLine)
		})
	})

	describe("Notice and Definition Tags Tests", () => {
		it("should include notice tag for truncated files", async () => {
			const maxReadFileLine = 3
			mockedReadFileContent.mockResolvedValue(
				`<file><path>${testFilePath}</path>\n<content lines="1-${maxReadFileLine}">\n${numberedFileContent}</content>\n<notice>Showing only ${maxReadFileLine} of 5 total lines</notice>\n</file>`,
			)

			const result = await executeReadFileTool({}, { maxReadFileLine })

			expect(result).toContain(`<notice>Showing only ${maxReadFileLine} of 5 total lines`)
		})

		it("should include list_code_definition_names tag when source code definitions are available", async () => {
			const sourceCodeDef = "\n\n# file.txt\n1--5 | Content"
			mockedReadFileContent.mockResolvedValue(
				`<file><path>${testFilePath}</path>\n<content lines="1-5">\n${numberedFileContent}</content>\n<list_code_definition_names>${sourceCodeDef}</list_code_definition_names>\n</file>`,
			)

			const result = await executeReadFileTool()

			expect(result).toMatch(
				new RegExp(
					`<list_code_definition_names>[\\s\\S]*${sourceCodeDef.trim()}[\\s\\S]*</list_code_definition_names>`,
				),
			)
		})

		it("should only have definitions, no content when maxReadFileLine=0", async () => {
			const maxReadFileLine = 0
			const totalLines = 10
			const sourceCodeDef = "\n\n# file.txt\n1--5 | Content"

			mockedReadFileContent.mockResolvedValue(
				`<file><path>${testFilePath}</path>\n<notice>Showing only 0 of ${totalLines} total lines. Use start_line and end_line if you need to read more</notice>\n<list_code_definition_names>${sourceCodeDef}</list_code_definition_names>\n</file>`,
			)

			const result = await executeReadFileTool({}, { maxReadFileLine })

			expect(result).toContain(`<notice>Showing only 0 of ${totalLines} total lines`)
			expect(result).toMatch(
				new RegExp(
					`<list_code_definition_names>[\\s\\S]*${sourceCodeDef.trim()}[\\s\\S]*</list_code_definition_names>`,
				),
			)
			expect(result).not.toContain("<content")
		})

		it("should handle maxReadFileLine=0 with no source code definitions", async () => {
			const maxReadFileLine = 0
			const totalLines = 10

			mockedReadFileContent.mockResolvedValue(
				`<file><path>${testFilePath}</path>\n<notice>Showing only 0 of ${totalLines} total lines. Use start_line and end_line if you need to read more</notice>\n</file>`,
			)

			const result = await executeReadFileTool({}, { maxReadFileLine })

			expect(result).toContain(
				`<file><path>${testFilePath}</path>\n<notice>Showing only 0 of ${totalLines} total lines. Use start_line and end_line if you need to read more</notice>\n</file>`,
			)
			expect(result).not.toContain("<list_code_definition_names>")
			expect(result).not.toContain("<content")
		})
	})

	describe("Binary File Tests", () => {
		it("should handle binary files correctly", async () => {
			const binaryContent = "Binary content"
			mockedReadFileContent.mockResolvedValue(
				`<file><path>${testFilePath}</path>\n<content lines="1-5">\n${binaryContent}</content>\n</file>`,
			)

			const result = await executeReadFileTool()

			expect(result).toBe(
				`<file><path>${testFilePath}</path>\n<content lines="1-5">\n${binaryContent}</content>\n</file>`,
			)
		})

		it("should handle binary files with maxReadFileLine=0", async () => {
			const maxReadFileLine = 0
			const binaryContent = "Binary content"
			mockedReadFileContent.mockResolvedValue(
				`<file><path>${testFilePath}</path>\n<content lines="1-5">\n${binaryContent}</content>\n</file>`,
			)

			const result = await executeReadFileTool({}, { maxReadFileLine })

			expect(result).toBe(
				`<file><path>${testFilePath}</path>\n<content lines="1-5">\n${binaryContent}</content>\n</file>`,
			)
		})
	})

	describe("MaxReadFileLine Behavior Tests", () => {
		it("should show all content when maxReadFileLine=-1", async () => {
			const maxReadFileLine = -1
			const totalLines = 1000
			const largeContent = Array(totalLines)
				.fill("Line content")
				.map((line, i) => `${i + 1} | ${line}`)
				.join("\n")

			mockedReadFileContent.mockResolvedValue(
				`<file><path>${testFilePath}</path>\n<content lines="1-${totalLines}">\n${largeContent}\n</content>\n</file>`,
			)

			const result = await executeReadFileTool({}, { maxReadFileLine })

			expect(result).toContain(`<content lines="1-${totalLines}">`)
			expect(result).not.toContain("<notice>")
			expect(result?.split("\n").length).toBeGreaterThan(500) // Default maxReadFileLine
		})

		it("should truncate content when file is larger than maxReadFileLine", async () => {
			const maxReadFileLine = 10
			const totalLines = 20
			mockedReadFileContent.mockResolvedValue(
				`<file><path>${testFilePath}</path>\n<content lines="1-${maxReadFileLine}">\n${numberedFileContent}</content>\n<notice>Showing only ${maxReadFileLine} of ${totalLines} total lines</notice>\n</file>`,
			)

			const result = await executeReadFileTool({}, { maxReadFileLine })

			expect(result).toContain(`<content lines="1-${maxReadFileLine}">`)
			expect(result).toContain(`<notice>Showing only ${maxReadFileLine} of ${totalLines} total lines`)
		})
	})

	describe("Error Handling Tests", () => {
		it("should include error tag for invalid path", async () => {
			const toolUse: ReadFileToolUse = {
				type: "tool_use",
				name: "read_file",
				params: {},
				partial: false,
			}

			const { readFileTool } = require("../tools/readFileTool")

			await readFileTool(
				mockCline,
				toolUse,
				mockCline.ask,
				jest.fn(),
				(result: string) => {
					toolResult = result
				},
				(param: string, value: string) => value,
			)

			expect(toolResult).toContain(`<file><path></path><error>`)
			expect(toolResult).not.toContain(`<content`)
		})

		it("should include error tag for invalid start_line", async () => {
			mockedReadFileContent.mockResolvedValue(
				`<file><path>${testFilePath}</path><error>Invalid start_line value</error></file>`,
			)

			const result = await executeReadFileTool({ start_line: "invalid" })

			expect(result).toContain(`<file><path>${testFilePath}</path><error>Invalid start_line value</error></file>`)
			expect(result).not.toContain(`<content`)
		})

		it("should include error tag for invalid end_line", async () => {
			mockedReadFileContent.mockResolvedValue(
				`<file><path>${testFilePath}</path><error>Invalid end_line value</error></file>`,
			)

			const result = await executeReadFileTool({ end_line: "invalid" })

			expect(result).toContain(`<file><path>${testFilePath}</path><error>Invalid end_line value</error></file>`)
			expect(result).not.toContain(`<content`)
		})

		it("should include error tag for RooIgnore error", async () => {
			const result = await executeReadFileTool({}, { validateAccess: false })

			expect(result).toContain(`<file><path>${testFilePath}</path><error>`)
			expect(result).not.toContain(`<content`)
		})
	})

	describe("Edge Cases Tests", () => {
		it("should handle empty files correctly", async () => {
			mockedReadFileContent.mockResolvedValue(
				`<file><path>${testFilePath}</path>\n<content/><notice>File is empty</notice>\n</file>`,
			)

			const result = await executeReadFileTool()

			expect(result).toBe(`<file><path>${testFilePath}</path>\n<content/><notice>File is empty</notice>\n</file>`)
		})

		describe("Line Range Validation Tests", () => {
			it("should handle start_line greater than end_line", async () => {
				mockedReadFileContent.mockResolvedValue(
					`<file><path>${testFilePath}</path><error>Invalid line range: start_line cannot be greater than end_line</error></file>`,
				)

				const result = await executeReadFileTool({
					start_line: "5",
					end_line: "3",
				})

				expect(result).toContain("Invalid line range: start_line cannot be greater than end_line")
				expect(result).not.toContain("<content")
			})

			it("should handle start_line greater than total lines", async () => {
				mockedReadFileContent.mockResolvedValue(
					`<file><path>${testFilePath}</path><error>Invalid line range: start_line exceeds total lines</error></file>`,
				)

				const result = await executeReadFileTool({
					start_line: "10",
				})

				expect(result).toContain("Invalid line range: start_line exceeds total lines")
				expect(result).not.toContain("<content")
			})

			it("should handle end_line greater than total lines", async () => {
				mockedReadFileContent.mockResolvedValue(
					`<file><path>${testFilePath}</path><error>Invalid line range: end_line exceeds total lines</error></file>`,
				)

				const result = await executeReadFileTool({
					end_line: "10",
				})

				expect(result).toContain("Invalid line range: end_line exceeds total lines")
				expect(result).not.toContain("<content")
			})

			it("should handle negative line numbers", async () => {
				mockedReadFileContent.mockResolvedValue(
					`<file><path>${testFilePath}</path><error>Invalid line range: line numbers must be positive</error></file>`,
				)

				const result = await executeReadFileTool({
					start_line: "-1",
				})

				expect(result).toContain("Invalid line range: line numbers must be positive")
				expect(result).not.toContain("<content")
			})
		})

		describe("Special File Types Tests", () => {
			it("should handle PDF files", async () => {
				const pdfPath = "test/document.pdf"
				const pdfContent = "Extracted PDF content"
				mockedReadFileContent.mockResolvedValue(
					`<file><path>${pdfPath}</path>\n<content lines="1-5">\n${pdfContent}</content>\n</file>`,
				)

				const result = await executeReadFileTool({ path: pdfPath })

				expect(result).toContain(pdfContent)
				expect(result).toContain("<content lines=")
			})

			it("should handle DOCX files", async () => {
				const docxPath = "test/document.docx"
				const docxContent = "Extracted DOCX content"
				mockedReadFileContent.mockResolvedValue(
					`<file><path>${docxPath}</path>\n<content lines="1-5">\n${docxContent}</content>\n</file>`,
				)

				const result = await executeReadFileTool({ path: docxPath })

				expect(result).toContain(docxContent)
				expect(result).toContain("<content lines=")
			})

			it("should handle IPYNB files", async () => {
				const ipynbPath = "test/notebook.ipynb"
				const ipynbContent = "Extracted Jupyter notebook content"
				mockedReadFileContent.mockResolvedValue(
					`<file><path>${ipynbPath}</path>\n<content lines="1-5">\n${ipynbContent}</content>\n</file>`,
				)

				const result = await executeReadFileTool({ path: ipynbPath })

				expect(result).toContain(ipynbContent)
				expect(result).toContain("<content lines=")
			})
		})

		describe("MaxReadFileLine Edge Cases", () => {
			it("should handle maxReadFileLine = 1", async () => {
				const maxReadFileLine = 1
				const totalLines = 5
				mockedReadFileContent.mockResolvedValue(
					`<file><path>${testFilePath}</path>\n<content lines="1-1">\n1 | Line 1\n</content>\n<notice>Showing only ${maxReadFileLine} of ${totalLines} total lines</notice>\n</file>`,
				)

				const result = await executeReadFileTool({}, { maxReadFileLine })

				expect(result).toContain(`<content lines="1-1">`)
				expect(result).toContain(`<notice>Showing only ${maxReadFileLine} of ${totalLines} total lines`)
				expect(result?.split("\n").filter((line) => line.match(/^\d+ \|/)).length).toBe(1)
			})

			it("should handle maxReadFileLine greater than total lines", async () => {
				const maxReadFileLine = 1000
				const totalLines = 5
				mockedReadFileContent.mockResolvedValue(
					`<file><path>${testFilePath}</path>\n<content lines="1-${totalLines}">\n${numberedFileContent}</content>\n</file>`,
				)

				const result = await executeReadFileTool({}, { maxReadFileLine })

				expect(result).toContain(`<content lines="1-${totalLines}">`)
				expect(result).not.toContain("<notice>")
				expect(result?.split("\n").filter((line) => line.match(/^\d+ \|/)).length).toBe(totalLines)
			})

			it("should handle maxReadFileLine = total lines", async () => {
				const maxReadFileLine = 5
				const totalLines = 5
				mockedReadFileContent.mockResolvedValue(
					`<file><path>${testFilePath}</path>\n<content lines="1-${totalLines}">\n${numberedFileContent}</content>\n</file>`,
				)

				const result = await executeReadFileTool({}, { maxReadFileLine })

				expect(result).toContain(`<content lines="1-${totalLines}">`)
				expect(result).not.toContain("<notice>")
				expect(result?.split("\n").filter((line) => line.match(/^\d+ \|/)).length).toBe(totalLines)
			})
		})

		it("should handle empty files correctly with maxReadFileLine=0", async () => {
			const maxReadFileLine = 0
			mockedReadFileContent.mockResolvedValue(
				`<file><path>${testFilePath}</path>\n<content/><notice>File is empty</notice>\n</file>`,
			)

			const result = await executeReadFileTool({}, { maxReadFileLine })

			expect(result).toBe(`<file><path>${testFilePath}</path>\n<content/><notice>File is empty</notice>\n</file>`)
		})

		it("should handle empty files correctly with maxReadFileLine=-1", async () => {
			const maxReadFileLine = -1
			mockedReadFileContent.mockResolvedValue(
				`<file><path>${testFilePath}</path>\n<content/><notice>File is empty</notice>\n</file>`,
			)

			const result = await executeReadFileTool({}, { maxReadFileLine })

			expect(result).toBe(`<file><path>${testFilePath}</path>\n<content/><notice>File is empty</notice>\n</file>`)
		})

		it("should handle file read errors correctly", async () => {
			const errorMessage = "File not found"
			mockedReadFileContent.mockRejectedValue(new Error(errorMessage))

			const result = await executeReadFileTool()

			expect(result).toContain(
				`<file><path>${testFilePath}</path><error>Error reading file: ${errorMessage}</error></file>`,
			)
			expect(result).not.toContain(`<content`)
		})
	})
})
