import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import path from "path"
import fs from "fs/promises"
import { isBinaryFile } from "isbinaryfile"
import { readFileTool } from "../readFileTool"
import { Task } from "../../task/Task"
import { ToolUse } from "../../../shared/tools"
import { countFileLines } from "../../../integrations/misc/line-counter"
import { extractTextFromFile, getSupportedBinaryFormats, addLineNumbers } from "../../../integrations/misc/extract-text"
import { parseSourceCodeDefinitionsForFile } from "../../../services/tree-sitter"

// Mock dependencies
vi.mock("fs/promises", () => ({
	default: {
		stat: vi.fn(),
		readFile: vi.fn(),
	},
}))
vi.mock("isbinaryfile")
vi.mock("../../task/Task")
vi.mock("../../../integrations/misc/line-counter")
vi.mock("../../../integrations/misc/extract-text")
vi.mock("../../../services/tree-sitter")

// Create mock functions
const getSupportedBinaryFormatsMock = vi.fn(() => [".pdf", ".docx", ".ipynb", ".xlsx"])
const extractTextFromFileMock = vi.fn()
const addLineNumbersMock = vi.fn()

// Mock RooIgnoreController to handle vscode import
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

// Mock other dependencies
vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockReturnValue(true),
}))

const mockFs = vi.mocked(fs)
const mockIsBinaryFile = vi.mocked(isBinaryFile)
const mockedCountFileLines = vi.mocked(countFileLines)
const mockedExtractTextFromFile = vi.mocked(extractTextFromFile)
const mockedGetSupportedBinaryFormats = vi.mocked(getSupportedBinaryFormats)
const mockedAddLineNumbers = vi.mocked(addLineNumbers)
const mockedParseSourceCodeDefinitionsForFile = vi.mocked(parseSourceCodeDefinitionsForFile)

describe("readFileTool - Image Support", () => {
	let mockTask: any
	let mockAskApproval: any
	let mockHandleError: any
	let mockPushToolResult: any
	let mockRemoveClosingTag: any
	let toolResults: string[]

	beforeEach(() => {
		vi.clearAllMocks()
		toolResults = []

		// Setup mocks
		mockedGetSupportedBinaryFormats.mockReturnValue([".pdf", ".docx", ".ipynb", ".xlsx"])
		mockedCountFileLines.mockResolvedValue(0)
		mockedExtractTextFromFile.mockResolvedValue("")
		mockedAddLineNumbers.mockImplementation((text) => text)
		mockedParseSourceCodeDefinitionsForFile.mockResolvedValue("")

		mockTask = {
			cwd: "/test/workspace",
			rooIgnoreController: {
				validateAccess: vi.fn().mockReturnValue(true),
			},
			fileContextTracker: {
				trackFileContext: vi.fn(),
			},
			providerRef: {
				deref: vi.fn().mockReturnValue({
					getState: vi.fn().mockResolvedValue({ maxReadFileLine: -1 }),
				}),
			},
			ask: vi.fn().mockResolvedValue({ response: "yesButtonClicked" }),
		}

		mockAskApproval = vi.fn()
		mockHandleError = vi.fn()
		mockPushToolResult = vi.fn((result: string) => {
			toolResults.push(result)
		})
		mockRemoveClosingTag = vi.fn()
	})

	afterEach(() => {
		vi.resetAllMocks()
	})

	it("should read PNG image file as base64", async () => {
		const imagePath = "test-image.png"
		const imageBuffer = Buffer.from("fake-png-data")
		const expectedBase64 = imageBuffer.toString("base64")

		// Mock file operations
		mockIsBinaryFile.mockResolvedValue(true)
		mockFs.stat.mockResolvedValue({ size: 1024 } as any)
		mockFs.readFile.mockResolvedValue(imageBuffer)

		const block: ToolUse = {
			type: "tool_use",
			name: "read_file",
			params: {
				args: `<file><path>${imagePath}</path></file>`,
			},
			partial: false,
		}

		await readFileTool(mockTask, block, mockAskApproval, mockHandleError, mockPushToolResult, mockRemoveClosingTag)

		expect(toolResults).toHaveLength(1)
		expect(toolResults[0]).toContain(`<image_data mime_type="image/png" size="1024">${expectedBase64}</image_data>`)
		expect(mockTask.fileContextTracker.trackFileContext).toHaveBeenCalledWith(imagePath, "read_tool")
	})

	it("should read JPEG image file as base64", async () => {
		const imagePath = "test-image.jpg"
		const imageBuffer = Buffer.from("fake-jpeg-data")
		const expectedBase64 = imageBuffer.toString("base64")

		// Mock file operations
		mockIsBinaryFile.mockResolvedValue(true)
		mockFs.stat.mockResolvedValue({ size: 2048 } as any)
		mockFs.readFile.mockResolvedValue(imageBuffer)

		const block: ToolUse = {
			type: "tool_use",
			name: "read_file",
			params: {
				args: `<file><path>${imagePath}</path></file>`,
			},
			partial: false,
		}

		await readFileTool(mockTask, block, mockAskApproval, mockHandleError, mockPushToolResult, mockRemoveClosingTag)

		expect(toolResults).toHaveLength(1)
		expect(toolResults[0]).toContain(
			`<image_data mime_type="image/jpeg" size="2048">${expectedBase64}</image_data>`,
		)
	})

	it("should handle multiple image files", async () => {
		const imagePaths = ["image1.png", "image2.jpg"]
		const imageBuffers = [Buffer.from("fake-png-data"), Buffer.from("fake-jpeg-data")]

		// Mock file operations
		mockIsBinaryFile.mockResolvedValue(true)
		mockFs.stat.mockResolvedValueOnce({ size: 1024 } as any).mockResolvedValueOnce({ size: 2048 } as any)
		mockFs.readFile.mockResolvedValueOnce(imageBuffers[0]).mockResolvedValueOnce(imageBuffers[1])

		const block: ToolUse = {
			type: "tool_use",
			name: "read_file",
			params: {
				args: `<file><path>${imagePaths[0]}</path></file><file><path>${imagePaths[1]}</path></file>`,
			},
			partial: false,
		}

		await readFileTool(mockTask, block, mockAskApproval, mockHandleError, mockPushToolResult, mockRemoveClosingTag)

		expect(toolResults).toHaveLength(1)
		expect(toolResults[0]).toContain(`<image_data mime_type="image/png"`)
		expect(toolResults[0]).toContain(`<image_data mime_type="image/jpeg"`)
		expect(toolResults[0]).toContain(imageBuffers[0].toString("base64"))
		expect(toolResults[0]).toContain(imageBuffers[1].toString("base64"))
	})

	it("should reject image files that are too large", async () => {
		const imagePath = "large-image.png"
		const largeSize = 15 * 1024 * 1024 // 15MB (exceeds 10MB limit)

		// Mock file operations
		mockIsBinaryFile.mockResolvedValue(true)
		mockFs.stat.mockResolvedValue({ size: largeSize } as any)

		const block: ToolUse = {
			type: "tool_use",
			name: "read_file",
			params: {
				args: `<file><path>${imagePath}</path></file>`,
			},
			partial: false,
		}

		await readFileTool(mockTask, block, mockAskApproval, mockHandleError, mockPushToolResult, mockRemoveClosingTag)

		expect(toolResults).toHaveLength(1)
		expect(toolResults[0]).toContain("<error>Error reading image file:")
		expect(toolResults[0]).toContain("Image file is too large")
		expect(mockHandleError).toHaveBeenCalled()
	})

	it("should handle unsupported image formats as binary files", async () => {
		const imagePath = "test-image.tga" // Unsupported format

		// Mock file operations
		mockIsBinaryFile.mockResolvedValue(true)

		const block: ToolUse = {
			type: "tool_use",
			name: "read_file",
			params: {
				args: `<file><path>${imagePath}</path></file>`,
			},
			partial: false,
		}

		await readFileTool(mockTask, block, mockAskApproval, mockHandleError, mockPushToolResult, mockRemoveClosingTag)

		expect(toolResults).toHaveLength(1)
		expect(toolResults[0]).toContain("<notice>Binary file</notice>")
	})

	it("should support WebP images", async () => {
		const imagePath = "test-image.webp"
		const imageBuffer = Buffer.from("fake-webp-data")
		const expectedBase64 = imageBuffer.toString("base64")

		// Mock file operations
		mockIsBinaryFile.mockResolvedValue(true)
		mockFs.stat.mockResolvedValue({ size: 1024 } as any)
		mockFs.readFile.mockResolvedValue(imageBuffer)

		const block: ToolUse = {
			type: "tool_use",
			name: "read_file",
			params: {
				args: `<file><path>${imagePath}</path></file>`,
			},
			partial: false,
		}

		await readFileTool(mockTask, block, mockAskApproval, mockHandleError, mockPushToolResult, mockRemoveClosingTag)

		expect(toolResults).toHaveLength(1)
		expect(toolResults[0]).toContain(
			`<image_data mime_type="image/webp" size="1024">${expectedBase64}</image_data>`,
		)
	})

	it("should support SVG images", async () => {
		const imagePath = "test-image.svg"
		const imageBuffer = Buffer.from("<svg>fake-svg-data</svg>")
		const expectedBase64 = imageBuffer.toString("base64")

		// Mock file operations
		mockIsBinaryFile.mockResolvedValue(true)
		mockFs.stat.mockResolvedValue({ size: 512 } as any)
		mockFs.readFile.mockResolvedValue(imageBuffer)

		const block: ToolUse = {
			type: "tool_use",
			name: "read_file",
			params: {
				args: `<file><path>${imagePath}</path></file>`,
			},
			partial: false,
		}

		await readFileTool(mockTask, block, mockAskApproval, mockHandleError, mockPushToolResult, mockRemoveClosingTag)

		expect(toolResults).toHaveLength(1)
		expect(toolResults[0]).toContain(
			`<image_data mime_type="image/svg+xml" size="512">${expectedBase64}</image_data>`,
		)
	})
})
