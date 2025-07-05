// npx vitest src/core/tools/__tests__/readFileTool.spec.ts

import * as path from "path"

import { countFileLines } from "../../../integrations/misc/line-counter"
import { readLines } from "../../../integrations/misc/read-lines"
import { extractTextFromFile } from "../../../integrations/misc/extract-text"
import { parseSourceCodeDefinitionsForFile } from "../../../services/tree-sitter"
import { isBinaryFile } from "isbinaryfile"
import { ReadFileToolUse, ToolParamName, ToolResponse } from "../../../shared/tools"
import { readFileTool } from "../readFileTool"
import { formatResponse } from "../../prompts/responses"

vi.mock("path", async () => {
	const originalPath = await vi.importActual("path")
	return {
		default: originalPath,
		...originalPath,
		resolve: vi.fn().mockImplementation((...args) => args.join("/")),
	}
})

// Already mocked above with hoisted fsPromises

vi.mock("isbinaryfile")

vi.mock("../../../integrations/misc/line-counter")
vi.mock("../../../integrations/misc/read-lines")

// Mock fs/promises readFile for image tests
const fsPromises = vi.hoisted(() => ({
	readFile: vi.fn(),
	stat: vi.fn().mockResolvedValue({ size: 1024 }),
}))
vi.mock("fs/promises", () => fsPromises)

// Mock input content for tests
let mockInputContent = ""

// First create all the mocks
vi.mock("../../../integrations/misc/extract-text", () => ({
	extractTextFromFile: vi.fn(),
	addLineNumbers: vi.fn(),
	getSupportedBinaryFormats: vi.fn(() => [".pdf", ".docx", ".ipynb"]),
}))
vi.mock("../../../services/tree-sitter")

// Then create the mock functions
const addLineNumbersMock = vi.fn().mockImplementation((text, startLine = 1) => {
	if (!text) return ""
	const lines = typeof text === "string" ? text.split("\n") : [text]
	return lines.map((line, i) => `${startLine + i} | ${line}`).join("\n")
})

const extractTextFromFileMock = vi.fn()
const getSupportedBinaryFormatsMock = vi.fn(() => [".pdf", ".docx", ".ipynb"])

// Mock formatResponse - use vi.hoisted to ensure mocks are available before vi.mock
const { toolResultMock, imageBlocksMock } = vi.hoisted(() => {
	const toolResultMock = vi.fn((text: string, images?: string[]) => {
		if (images && images.length > 0) {
			return [
				{ type: "text", text },
				...images.map((img) => {
					const [header, data] = img.split(",")
					const media_type = header.match(/:(.*?);/)?.[1] || "image/png"
					return { type: "image", source: { type: "base64", media_type, data } }
				}),
			]
		}
		return text
	})
	const imageBlocksMock = vi.fn((images?: string[]) => {
		return images
			? images.map((img) => {
					const [header, data] = img.split(",")
					const media_type = header.match(/:(.*?);/)?.[1] || "image/png"
					return { type: "image", source: { type: "base64", media_type, data } }
				})
			: []
	})
	return { toolResultMock, imageBlocksMock }
})

vi.mock("../../prompts/responses", () => ({
	formatResponse: {
		toolDenied: vi.fn(() => "The user denied this operation."),
		toolDeniedWithFeedback: vi.fn(
			(feedback?: string) =>
				`The user denied this operation and provided the following feedback:\n<feedback>\n${feedback}\n</feedback>`,
		),
		toolApprovedWithFeedback: vi.fn(
			(feedback?: string) =>
				`The user approved this operation and provided the following context:\n<feedback>\n${feedback}\n</feedback>`,
		),
		rooIgnoreError: vi.fn(
			(path: string) =>
				`Access to ${path} is blocked by the .rooignore file settings. You must try to continue in the task without using this file, or ask the user to update the .rooignore file.`,
		),
		toolResult: toolResultMock,
		imageBlocks: imageBlocksMock,
	},
}))

vi.mock("../../ignore/RooIgnoreController", () => ({
	RooIgnoreController: class {
		initialize() {
			return Promise.resolve()
		}
		validateAccess() {
			return true
		}
	},
}))

vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockReturnValue(true),
}))

describe("read_file tool with maxReadFileLine setting", () => {
	// Test data
	const testFilePath = "test/file.txt"
	const absoluteFilePath = "/test/file.txt"
	const fileContent = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5"
	const numberedFileContent = "1 | Line 1\n2 | Line 2\n3 | Line 3\n4 | Line 4\n5 | Line 5\n"
	const sourceCodeDef = "\n\n# file.txt\n1--5 | Content"

	// Mocked functions with correct types
	const mockedCountFileLines = vi.mocked(countFileLines)
	const mockedReadLines = vi.mocked(readLines)
	const mockedExtractTextFromFile = vi.mocked(extractTextFromFile)
	const mockedParseSourceCodeDefinitionsForFile = vi.mocked(parseSourceCodeDefinitionsForFile)

	const mockedIsBinaryFile = vi.mocked(isBinaryFile)
	const mockedPathResolve = vi.mocked(path.resolve)

	const mockCline: any = {}
	let mockProvider: any
	let toolResult: ToolResponse | undefined

	beforeEach(() => {
		vi.clearAllMocks()

		mockedPathResolve.mockReturnValue(absoluteFilePath)
		mockedIsBinaryFile.mockResolvedValue(false)

		mockInputContent = fileContent

		// Setup the extractTextFromFile mock implementation with the current mockInputContent
		// Reset the spy before each test
		addLineNumbersMock.mockClear()

		// Setup the extractTextFromFile mock to call our spy
		mockedExtractTextFromFile.mockImplementation((_filePath) => {
			// Call the spy and return its result
			return Promise.resolve(addLineNumbersMock(mockInputContent))
		})

		mockProvider = {
			getState: vi.fn(),
			deref: vi.fn().mockReturnThis(),
		}

		mockCline.cwd = "/"
		mockCline.task = "Test"
		mockCline.providerRef = mockProvider
		mockCline.rooIgnoreController = {
			validateAccess: vi.fn().mockReturnValue(true),
		}
		mockCline.say = vi.fn().mockResolvedValue(undefined)
		mockCline.ask = vi.fn().mockResolvedValue({ response: "yesButtonClicked" })
		mockCline.presentAssistantMessage = vi.fn()
		mockCline.handleError = vi.fn().mockResolvedValue(undefined)
		mockCline.pushToolResult = vi.fn()
		mockCline.removeClosingTag = vi.fn((tag, content) => content)

		mockCline.fileContextTracker = {
			trackFileContext: vi.fn().mockResolvedValue(undefined),
		}

		mockCline.recordToolUsage = vi.fn().mockReturnValue(undefined)
		mockCline.recordToolError = vi.fn().mockReturnValue(undefined)

		toolResult = undefined
	})

	/**
	 * Helper function to execute the read file tool with different maxReadFileLine settings
	 */
	async function executeReadFileTool(
		params: Partial<ReadFileToolUse["params"]> = {},
		options: {
			maxReadFileLine?: number
			totalLines?: number
			skipAddLineNumbersCheck?: boolean // Flag to skip addLineNumbers check
			path?: string
			start_line?: string
			end_line?: string
		} = {},
	): Promise<ToolResponse | undefined> {
		// Configure mocks based on test scenario
		const maxReadFileLine = options.maxReadFileLine ?? 500
		const totalLines = options.totalLines ?? 5

		mockProvider.getState.mockResolvedValue({ maxReadFileLine })
		mockedCountFileLines.mockResolvedValue(totalLines)

		// Reset the spy before each test
		addLineNumbersMock.mockClear()

		// Format args string based on params
		let argsContent = `<file><path>${options.path || testFilePath}</path>`
		if (options.start_line && options.end_line) {
			argsContent += `<line_range>${options.start_line}-${options.end_line}</line_range>`
		}
		argsContent += `</file>`

		// Create a tool use object
		const toolUse: ReadFileToolUse = {
			type: "tool_use",
			name: "read_file",
			params: { args: argsContent, ...params },
			partial: false,
		}

		await readFileTool(
			mockCline,
			toolUse,
			mockCline.ask,
			vi.fn(),
			(result: ToolResponse) => {
				toolResult = result
			},
			(_: ToolParamName, content?: string) => content ?? "",
		)

		return toolResult
	}

	describe("when maxReadFileLine is negative", () => {
		it("should read the entire file using extractTextFromFile", async () => {
			// Setup - use default mockInputContent
			mockInputContent = fileContent

			// Execute
			const result = await executeReadFileTool({}, { maxReadFileLine: -1 })

			// Verify - just check that the result contains the expected elements
			expect(result).toContain(`<file><path>${testFilePath}</path>`)
			expect(result).toContain(`<content lines="1-5">`)
		})

		it("should not show line snippet in approval message when maxReadFileLine is -1", async () => {
			// This test verifies the line snippet behavior for the approval message
			// Setup - use default mockInputContent
			mockInputContent = fileContent

			// Execute - we'll reuse executeReadFileTool to run the tool
			await executeReadFileTool({}, { maxReadFileLine: -1 })

			// Verify the empty line snippet for full read was passed to the approval message
			// Look at the parameters passed to the 'ask' method in the approval message
			const askCall = mockCline.ask.mock.calls[0]
			const completeMessage = JSON.parse(askCall[1])

			// Verify the reason (lineSnippet) is empty or undefined for full read
			expect(completeMessage.reason).toBeFalsy()
		})
	})

	describe("when maxReadFileLine is 0", () => {
		it("should return an empty content with source code definitions", async () => {
			// Setup - for maxReadFileLine = 0, the implementation won't call readLines
			mockedParseSourceCodeDefinitionsForFile.mockResolvedValue(sourceCodeDef)

			// Execute - skip addLineNumbers check as it's not called for maxReadFileLine=0
			const result = await executeReadFileTool(
				{},
				{
					maxReadFileLine: 0,
					totalLines: 5,
					skipAddLineNumbersCheck: true,
				},
			)

			// Verify
			expect(result).toContain(`<file><path>${testFilePath}</path>`)
			expect(result).toContain(`<list_code_definition_names>`)

			// Verify XML structure
			expect(result).toContain("<notice>Showing only 0 of 5 total lines")
			expect(result).toContain("</notice>")
			expect(result).toContain("<list_code_definition_names>")
			expect(result).toContain(sourceCodeDef.trim())
			expect(result).toContain("</list_code_definition_names>")
			expect(result).not.toContain("<content") // No content when maxReadFileLine is 0
		})
	})

	describe("when maxReadFileLine is less than file length", () => {
		it("should read only maxReadFileLine lines and add source code definitions", async () => {
			// Setup
			const content = "Line 1\nLine 2\nLine 3"
			const numberedContent = "1 | Line 1\n2 | Line 2\n3 | Line 3"
			mockedReadLines.mockResolvedValue(content)
			mockedParseSourceCodeDefinitionsForFile.mockResolvedValue(sourceCodeDef)

			// Setup addLineNumbers to always return numbered content
			addLineNumbersMock.mockReturnValue(numberedContent)

			// Execute
			const result = await executeReadFileTool({}, { maxReadFileLine: 3 })

			// Verify - just check that the result contains the expected elements
			expect(result).toContain(`<file><path>${testFilePath}</path>`)
			expect(result).toContain(`<content lines="1-3">`)
			expect(result).toContain(`<list_code_definition_names>`)
			expect(result).toContain("<notice>Showing only 3 of 5 total lines")
		})
	})

	describe("when maxReadFileLine equals or exceeds file length", () => {
		it("should use extractTextFromFile when maxReadFileLine > totalLines", async () => {
			// Setup
			mockedCountFileLines.mockResolvedValue(5) // File shorter than maxReadFileLine
			mockInputContent = fileContent

			// Execute
			const result = await executeReadFileTool({}, { maxReadFileLine: 10, totalLines: 5 })

			// Verify - just check that the result contains the expected elements
			expect(result).toContain(`<file><path>${testFilePath}</path>`)
			expect(result).toContain(`<content lines="1-5">`)
		})

		it("should read with extractTextFromFile when file has few lines", async () => {
			// Setup
			mockedCountFileLines.mockResolvedValue(3) // File shorter than maxReadFileLine
			mockInputContent = fileContent

			// Execute
			const result = await executeReadFileTool({}, { maxReadFileLine: 5, totalLines: 3 })

			// Verify - just check that the result contains the expected elements
			expect(result).toContain(`<file><path>${testFilePath}</path>`)
			expect(result).toContain(`<content lines="1-3">`)
		})
	})

	describe("when file is binary", () => {
		it("should always use extractTextFromFile regardless of maxReadFileLine", async () => {
			// Setup
			mockedIsBinaryFile.mockResolvedValue(true)
			mockedCountFileLines.mockResolvedValue(3)
			mockedExtractTextFromFile.mockResolvedValue("")

			// Execute
			const result = await executeReadFileTool({}, { maxReadFileLine: 3, totalLines: 3 })

			// Verify - just check basic structure, the actual binary handling may vary
			expect(result).toContain(`<file><path>${testFilePath}</path>`)
			expect(typeof result).toBe("string")
		})
	})

	describe("with range parameters", () => {
		it("should honor start_line and end_line when provided", async () => {
			// Setup
			mockedReadLines.mockResolvedValue("Line 2\nLine 3\nLine 4")

			// Execute using executeReadFileTool with range parameters
			const rangeResult = await executeReadFileTool(
				{},
				{
					start_line: "2",
					end_line: "4",
				},
			)

			// Verify - just check that the result contains the expected elements
			expect(rangeResult).toContain(`<file><path>${testFilePath}</path>`)
			expect(rangeResult).toContain(`<content lines="2-4">`)
		})
	})
})

describe("read_file tool XML output structure", () => {
	// Test basic XML structure
	const testFilePath = "test/file.txt"
	const absoluteFilePath = "/test/file.txt"
	const fileContent = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5"

	const mockedCountFileLines = vi.mocked(countFileLines)
	const mockedExtractTextFromFile = vi.mocked(extractTextFromFile)
	const mockedIsBinaryFile = vi.mocked(isBinaryFile)
	const mockedPathResolve = vi.mocked(path.resolve)

	const mockCline: any = {}
	let mockProvider: any
	let toolResult: ToolResponse | undefined

	beforeEach(() => {
		vi.clearAllMocks()

		mockedPathResolve.mockReturnValue(absoluteFilePath)
		mockedIsBinaryFile.mockResolvedValue(false)

		// Set default implementation for extractTextFromFile
		mockedExtractTextFromFile.mockImplementation((filePath) => {
			return Promise.resolve(addLineNumbersMock(mockInputContent))
		})

		mockInputContent = fileContent

		// Setup mock provider with default maxReadFileLine
		mockProvider = {
			getState: vi.fn().mockResolvedValue({ maxReadFileLine: -1 }), // Default to full file read
			deref: vi.fn().mockReturnThis(),
		}

		mockCline.cwd = "/"
		mockCline.task = "Test"
		mockCline.providerRef = mockProvider
		mockCline.rooIgnoreController = {
			validateAccess: vi.fn().mockReturnValue(true),
		}
		mockCline.say = vi.fn().mockResolvedValue(undefined)
		mockCline.ask = vi.fn().mockResolvedValue({ response: "yesButtonClicked" })
		mockCline.presentAssistantMessage = vi.fn()
		mockCline.sayAndCreateMissingParamError = vi.fn().mockResolvedValue("Missing required parameter")

		mockCline.fileContextTracker = {
			trackFileContext: vi.fn().mockResolvedValue(undefined),
		}

		mockCline.recordToolUsage = vi.fn().mockReturnValue(undefined)
		mockCline.recordToolError = vi.fn().mockReturnValue(undefined)
		mockCline.didRejectTool = false

		toolResult = undefined
	})

	async function executeReadFileTool(
		params: {
			args?: string
		} = {},
		options: {
			totalLines?: number
			maxReadFileLine?: number
			isBinary?: boolean
			validateAccess?: boolean
		} = {},
	): Promise<ToolResponse | undefined> {
		// Configure mocks based on test scenario
		const totalLines = options.totalLines ?? 5
		const maxReadFileLine = options.maxReadFileLine ?? 500
		const isBinary = options.isBinary ?? false
		const validateAccess = options.validateAccess ?? true

		mockProvider.getState.mockResolvedValue({ maxReadFileLine })
		mockedCountFileLines.mockResolvedValue(totalLines)
		mockedIsBinaryFile.mockResolvedValue(isBinary)
		mockCline.rooIgnoreController.validateAccess = vi.fn().mockReturnValue(validateAccess)

		let argsContent = `<file><path>${testFilePath}</path></file>`

		// Create a tool use object
		const toolUse: ReadFileToolUse = {
			type: "tool_use",
			name: "read_file",
			params: { args: argsContent, ...params },
			partial: false,
		}

		// Execute the tool
		await readFileTool(
			mockCline,
			toolUse,
			mockCline.ask,
			vi.fn(),
			(result: ToolResponse) => {
				toolResult = result
			},
			(param: ToolParamName, content?: string) => content ?? "",
		)

		return toolResult
	}

	describe("Basic XML Structure Tests", () => {
		it("should produce XML output with no unnecessary indentation", async () => {
			// Setup
			const numberedContent = "1 | Line 1\n2 | Line 2\n3 | Line 3\n4 | Line 4\n5 | Line 5"
			// For XML structure test
			mockedExtractTextFromFile.mockImplementation(() => {
				addLineNumbersMock(mockInputContent)
				return Promise.resolve(numberedContent)
			})
			mockProvider.getState.mockResolvedValue({ maxReadFileLine: -1 })

			// Execute
			const result = await executeReadFileTool()

			// Verify
			expect(result).toBe(
				`<files>\n<file><path>${testFilePath}</path>\n<content lines="1-5">\n${numberedContent}</content>\n</file>\n</files>`,
			)
		})

		it("should follow the correct XML structure format", async () => {
			// Setup
			mockInputContent = fileContent
			// Execute
			const result = await executeReadFileTool({}, { maxReadFileLine: -1 })

			// Verify using regex to check structure
			const xmlStructureRegex = new RegExp(
				`^<files>\\n<file><path>${testFilePath}</path>\\n<content lines="1-5">\\n.*</content>\\n</file>\\n</files>$`,
				"s",
			)
			expect(result).toMatch(xmlStructureRegex)
		})

		it("should handle empty files correctly", async () => {
			// Setup
			mockedCountFileLines.mockResolvedValue(0)
			mockedExtractTextFromFile.mockResolvedValue("")
			mockProvider.getState.mockResolvedValue({ maxReadFileLine: -1 })

			// Execute
			const result = await executeReadFileTool({}, { totalLines: 0 })

			// Verify
			expect(result).toBe(
				`<files>\n<file><path>${testFilePath}</path>\n<content/><notice>File is empty</notice>\n</file>\n</files>`,
			)
		})
	})

	describe("Error Handling Tests", () => {
		it("should include error tag for invalid path", async () => {
			// Setup - missing path parameter
			const toolUse: ReadFileToolUse = {
				type: "tool_use",
				name: "read_file",
				params: {},
				partial: false,
			}

			// Execute the tool
			await readFileTool(
				mockCline,
				toolUse,
				mockCline.ask,
				vi.fn(),
				(result: ToolResponse) => {
					toolResult = result
				},
				(param: ToolParamName, content?: string) => content ?? "",
			)

			// Verify
			expect(toolResult).toBe(`<files><error>Missing required parameter</error></files>`)
		})

		it("should include error tag for RooIgnore error", async () => {
			// Execute - skip addLineNumbers check as it returns early with an error
			const result = await executeReadFileTool({}, { validateAccess: false })

			// Verify
			expect(result).toBe(
				`<files>\n<file><path>${testFilePath}</path><error>Access to ${testFilePath} is blocked by the .rooignore file settings. You must try to continue in the task without using this file, or ask the user to update the .rooignore file.</error></file>\n</files>`,
			)
		})
	})
})

describe("read_file tool with image support", () => {
	const testImagePath = "test/image.png"
	const absoluteImagePath = "/test/image.png"
	const base64ImageData =
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
	const imageBuffer = Buffer.from(base64ImageData, "base64")

	const mockedCountFileLines = vi.mocked(countFileLines)
	const mockedIsBinaryFile = vi.mocked(isBinaryFile)
	const mockedPathResolve = vi.mocked(path.resolve)
	const mockedFsReadFile = vi.mocked(fsPromises.readFile)
	const mockedExtractTextFromFile = vi.mocked(extractTextFromFile)

	const mockCline: any = {}
	let mockProvider: any
	let toolResult: ToolResponse | undefined

	beforeEach(() => {
		vi.clearAllMocks()

		mockedPathResolve.mockReturnValue(absoluteImagePath)
		mockedIsBinaryFile.mockResolvedValue(true)
		mockedCountFileLines.mockResolvedValue(0)
		mockedFsReadFile.mockResolvedValue(imageBuffer)

		mockProvider = {
			getState: vi.fn().mockResolvedValue({ maxReadFileLine: -1 }),
			deref: vi.fn().mockReturnThis(),
		}

		mockCline.cwd = "/"
		mockCline.task = "Test"
		mockCline.providerRef = mockProvider
		mockCline.rooIgnoreController = {
			validateAccess: vi.fn().mockReturnValue(true),
		}
		mockCline.say = vi.fn().mockResolvedValue(undefined)
		mockCline.ask = vi.fn().mockResolvedValue({ response: "yesButtonClicked" })
		mockCline.presentAssistantMessage = vi.fn()
		mockCline.handleError = vi.fn().mockResolvedValue(undefined)
		mockCline.pushToolResult = vi.fn()
		mockCline.removeClosingTag = vi.fn((tag, content) => content)

		mockCline.fileContextTracker = {
			trackFileContext: vi.fn().mockResolvedValue(undefined),
		}

		mockCline.recordToolUsage = vi.fn().mockReturnValue(undefined)
		mockCline.recordToolError = vi.fn().mockReturnValue(undefined)

		toolResult = undefined
	})

	async function executeReadImageTool(imagePath: string = testImagePath): Promise<ToolResponse | undefined> {
		const argsContent = `<file><path>${imagePath}</path></file>`
		const toolUse: ReadFileToolUse = {
			type: "tool_use",
			name: "read_file",
			params: { args: argsContent },
			partial: false,
		}

		await readFileTool(
			mockCline,
			toolUse,
			mockCline.ask,
			vi.fn(),
			(result: ToolResponse) => {
				toolResult = result
			},
			(_: ToolParamName, content?: string) => content ?? "",
		)

		return toolResult
	}

	describe("Image Format Detection", () => {
		it.each([
			[".png", "image.png", "image/png"],
			[".jpg", "photo.jpg", "image/jpeg"],
			[".jpeg", "picture.jpeg", "image/jpeg"],
			[".gif", "animation.gif", "image/gif"],
			[".bmp", "bitmap.bmp", "image/bmp"],
			[".svg", "vector.svg", "image/svg+xml"],
			[".webp", "modern.webp", "image/webp"],
			[".ico", "favicon.ico", "image/x-icon"],
			[".avif", "new-format.avif", "image/avif"],
		])("should detect %s as an image format", async (ext, filename, expectedMimeType) => {
			// Setup
			const imagePath = `test/${filename}`
			const absolutePath = `/test/${filename}`
			mockedPathResolve.mockReturnValue(absolutePath)

			// Execute
			const result = await executeReadImageTool(imagePath)

			// Verify result is a multi-part response
			expect(Array.isArray(result)).toBe(true)
			const textPart = (result as any[]).find((p) => p.type === "text")?.text
			const imagePart = (result as any[]).find((p) => p.type === "image")

			// Verify text part
			expect(textPart).toContain(`<file><path>${imagePath}</path>`)
			expect(textPart).not.toContain("<image_data>")
			expect(textPart).toContain(`<notice>Image file`)

			// Verify image part
			expect(imagePart).toBeDefined()
			expect(imagePart.source.media_type).toBe(expectedMimeType)
			expect(imagePart.source.data).toBe(base64ImageData)
		})
	})

	describe("Image Reading Functionality", () => {
		it("should read image file and return a multi-part response", async () => {
			// Execute
			const result = await executeReadImageTool()

			// Verify result is a multi-part response
			expect(Array.isArray(result)).toBe(true)
			const textPart = (result as any[]).find((p) => p.type === "text")?.text
			const imagePart = (result as any[]).find((p) => p.type === "image")

			// Verify text part
			expect(textPart).toContain(`<file><path>${testImagePath}</path>`)
			expect(textPart).not.toContain(`<image_data>`)
			expect(textPart).toContain(`<notice>Image file`)

			// Verify image part
			expect(imagePart).toBeDefined()
			expect(imagePart.source.media_type).toBe("image/png")
			expect(imagePart.source.data).toBe(base64ImageData)
		})

		it("should call formatResponse.toolResult with text and image data", async () => {
			// Execute
			await executeReadImageTool()

			// Verify toolResultMock was called correctly
			expect(toolResultMock).toHaveBeenCalledTimes(1)
			const callArgs = toolResultMock.mock.calls[0]
			const textArg = callArgs[0]
			const imagesArg = callArgs[1]

			expect(textArg).toContain(`<file><path>${testImagePath}</path>`)
			expect(imagesArg).toBeDefined()
			expect(imagesArg).toBeInstanceOf(Array)
			expect(imagesArg!.length).toBe(1)
			expect(imagesArg![0]).toBe(`data:image/png;base64,${base64ImageData}`)
		})

		it("should extract and display PNG dimensions correctly", async () => {
			// Setup - Create a proper PNG buffer with known dimensions (100x200 pixels)
			const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) // PNG signature
			const ihdrLength = Buffer.from([0x00, 0x00, 0x00, 0x0D]) // IHDR chunk length (13 bytes)
			const ihdrType = Buffer.from("IHDR", "ascii") // IHDR chunk type
			const width = Buffer.alloc(4)
			width.writeUInt32BE(100, 0) // Width: 100 pixels
			const height = Buffer.alloc(4)
			height.writeUInt32BE(200, 0) // Height: 200 pixels
			const ihdrData = Buffer.from([0x08, 0x02, 0x00, 0x00, 0x00]) // Bit depth, color type, compression, filter, interlace
			const crc = Buffer.from([0x00, 0x00, 0x00, 0x00]) // Dummy CRC
			
			const pngBuffer = Buffer.concat([pngSignature, ihdrLength, ihdrType, width, height, ihdrData, crc])
			const pngBase64 = pngBuffer.toString("base64")
			
			mockedFsReadFile.mockResolvedValue(pngBuffer)

			// Execute
			const result = await executeReadImageTool()

			// Verify result is a multi-part response
			expect(Array.isArray(result)).toBe(true)
			const textPart = (result as any[]).find((p) => p.type === "text")?.text
			const imagePart = (result as any[]).find((p) => p.type === "image")

			// Verify text part contains dimensions
			expect(textPart).toContain(`<file><path>${testImagePath}</path>`)
			expect(textPart).toContain("100x200 pixels") // Should include the dimensions
			expect(textPart).toContain(`<notice>Image file`)

			// Verify image part
			expect(imagePart).toBeDefined()
			expect(imagePart.source.media_type).toBe("image/png")
			expect(imagePart.source.data).toBe(pngBase64)
		})

		it("should handle large image files", async () => {
			// Setup - simulate a large image
			const largeBase64 = "A".repeat(1000000) // 1MB of base64 data
			const largeBuffer = Buffer.from(largeBase64, "base64")
			mockedFsReadFile.mockResolvedValue(largeBuffer)

			// Execute
			const result = await executeReadImageTool()

			// Verify it still works with large data
			expect(Array.isArray(result)).toBe(true)
			const imagePart = (result as any[]).find((p) => p.type === "image")
			expect(imagePart).toBeDefined()
			expect(imagePart.source.media_type).toBe("image/png")
			expect(imagePart.source.data).toBe(largeBase64)
		})

		it("should handle errors when reading image files", async () => {
			// Setup - simulate read error
			mockedFsReadFile.mockRejectedValue(new Error("Failed to read image"))

			// Create a spy for handleError
			const handleErrorSpy = vi.fn()

			// Execute with the spy
			const argsContent = `<file><path>${testImagePath}</path></file>`
			const toolUse: ReadFileToolUse = {
				type: "tool_use",
				name: "read_file",
				params: { args: argsContent },
				partial: false,
			}

			await readFileTool(
				mockCline,
				toolUse,
				mockCline.ask,
				handleErrorSpy, // Use our spy here
				(result: ToolResponse) => {
					toolResult = result
				},
				(_: ToolParamName, content?: string) => content ?? "",
			)

			// Verify error handling
			expect(toolResult).toContain("<error>Error reading image file: Failed to read image</error>")
			expect(handleErrorSpy).toHaveBeenCalled()
		})
	})

	describe("Binary File Handling", () => {
		it("should not treat non-image binary files as images", async () => {
			// Setup
			const binaryPath = "test/document.pdf"
			const absolutePath = "/test/document.pdf"
			mockedPathResolve.mockReturnValue(absolutePath)
			mockedExtractTextFromFile.mockResolvedValue("PDF content extracted")

			// Execute
			const result = await executeReadImageTool(binaryPath)

			// Verify it uses extractTextFromFile instead
			expect(result).not.toContain("<image_data>")
			// Make the test platform-agnostic by checking the call was made (path normalization can vary)
			expect(mockedExtractTextFromFile).toHaveBeenCalledTimes(1)
			const callArgs = mockedExtractTextFromFile.mock.calls[0]
			expect(callArgs[0]).toMatch(/[\\\/]test[\\\/]document\.pdf$/)
		})

		it("should handle unknown binary formats", async () => {
			// Setup
			const binaryPath = "test/unknown.bin"
			const absolutePath = "/test/unknown.bin"
			mockedPathResolve.mockReturnValue(absolutePath)
			mockedExtractTextFromFile.mockResolvedValue("")

			// Execute
			const result = await executeReadImageTool(binaryPath)

			// Verify
			expect(result).not.toContain("<image_data>")
			expect(result).toContain('<binary_file format="bin"')
		})
	})

	describe("Edge Cases", () => {
		it("should handle case-insensitive image extensions", async () => {
			// Test uppercase extensions
			const uppercasePath = "test/IMAGE.PNG"
			const absolutePath = "/test/IMAGE.PNG"
			mockedPathResolve.mockReturnValue(absolutePath)

			// Execute
			const result = await executeReadImageTool(uppercasePath)

			// Verify
			expect(Array.isArray(result)).toBe(true)
			const imagePart = (result as any[]).find((p) => p.type === "image")
			expect(imagePart).toBeDefined()
			expect(imagePart.source.media_type).toBe("image/png")
		})

		it("should handle files with multiple dots in name", async () => {
			// Setup
			const complexPath = "test/my.photo.backup.png"
			const absolutePath = "/test/my.photo.backup.png"
			mockedPathResolve.mockReturnValue(absolutePath)

			// Execute
			const result = await executeReadImageTool(complexPath)

			// Verify
			expect(Array.isArray(result)).toBe(true)
			const imagePart = (result as any[]).find((p) => p.type === "image")
			expect(imagePart).toBeDefined()
			expect(imagePart.source.media_type).toBe("image/png")
		})

		it("should handle empty image files", async () => {
			// Setup - empty buffer
			mockedFsReadFile.mockResolvedValue(Buffer.from(""))

			// Execute
			const result = await executeReadImageTool()

			// Verify - should still create valid data URL
			expect(Array.isArray(result)).toBe(true)
			const imagePart = (result as any[]).find((p) => p.type === "image")
			expect(imagePart).toBeDefined()
			expect(imagePart.source.media_type).toBe("image/png")
			expect(imagePart.source.data).toBe("")
		})
	})
})
