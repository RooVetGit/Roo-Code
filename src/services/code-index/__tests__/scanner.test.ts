import { scanDirectoryForCodeBlocks } from "../scanner"
import { CodeBlock } from "../parser"
import { RooIgnoreController } from "../../../core/ignore/RooIgnoreController"

// Mock dependencies
jest.mock("../../glob/list-files", () => ({
	listFiles: jest.fn(),
}))
jest.mock("fs/promises", () => ({
	stat: jest.fn(),
}))
jest.mock("../parser", () => ({
	parseCodeFileBySize: jest.fn(),
	CodeBlock: jest.requireActual("../parser").CodeBlock,
}))
jest.mock("vscode", () => {
	const mockDisposable = { dispose: jest.fn() }
	const mockEventEmitter = {
		event: jest.fn(),
		fire: jest.fn(),
	}

	return {
		workspace: {
			createFileSystemWatcher: jest.fn(() => ({
				onDidCreate: jest.fn(() => mockDisposable),
				onDidChange: jest.fn(() => mockDisposable),
				onDidDelete: jest.fn(() => mockDisposable),
				dispose: jest.fn(),
			})),
		},
		RelativePattern: jest.fn().mockImplementation((base, pattern) => ({
			base,
			pattern,
		})),
		EventEmitter: jest.fn().mockImplementation(() => mockEventEmitter),
		Disposable: {
			from: jest.fn(),
		},
	}
})

const mockListFiles = require("../../glob/list-files").listFiles
const mockStat = require("fs/promises").stat
const mockParseCodeFileBySize = require("../parser").parseCodeFileBySize

describe("scanDirectoryForCodeBlocks", () => {
	const mockCodeBlock: CodeBlock = {
		file_path: "test.js",
		identifier: "testFunction",
		type: "function",
		start_line: 1,
		end_line: 5,
		content: "function testFunction() {}",
		fileHash: "hash1",
		segmentHash: "hash2",
	}

	beforeEach(() => {
		jest.clearAllMocks()

		// Default mock implementations
		// Simplify the list to focus on core filtering logic
		mockListFiles.mockResolvedValue([["test.js", "dir/", "ignored.txt", "test.txt"], false])
		mockStat.mockImplementation(async (path: string) => {
			// Make async
			if (path === "large.js") {
				// Simulate a large file
				return { size: 2 * 1024 * 1024, isDirectory: () => false }
			}
			if (path.endsWith("/")) {
				// Simulate a directory
				return { size: 4096, isDirectory: () => true }
			}
			// Default: simulate a regular file
			return { size: 1024, isDirectory: () => false }
		})
		mockParseCodeFileBySize.mockResolvedValue([mockCodeBlock])
	})

	it("should filter out directories", async () => {
		const result = await scanDirectoryForCodeBlocks()
		expect(result).toHaveLength(1)
		expect(mockParseCodeFileBySize).not.toHaveBeenCalledWith("dir/")
	})

	it("should filter by .rooignore when controller is provided", async () => {
		const mockController = {
			filterPaths: jest.fn().mockReturnValue(["test.js"]),
			initialize: jest.fn(),
		} as unknown as RooIgnoreController

		await scanDirectoryForCodeBlocks(process.cwd(), mockController)
		expect(mockController.filterPaths).toHaveBeenCalled()
		expect(mockParseCodeFileBySize).not.toHaveBeenCalledWith("ignored.js")
	})

	it("should initialize new RooIgnoreController when none is provided", async () => {
		const mockInit = jest.fn()
		jest.spyOn(RooIgnoreController.prototype, "initialize").mockImplementation(mockInit)

		await scanDirectoryForCodeBlocks()
		expect(mockInit).toHaveBeenCalled()
	})

	it("should filter by supported extensions", async () => {
		await scanDirectoryForCodeBlocks()
		expect(mockParseCodeFileBySize).not.toHaveBeenCalledWith("test.txt")
	})

	it("should filter by file size (<= 1MB)", async () => {
		await scanDirectoryForCodeBlocks()
		expect(mockParseCodeFileBySize).not.toHaveBeenCalledWith("large.js")
	})

	it("should parse valid files and return CodeBlocks", async () => {
		const result = await scanDirectoryForCodeBlocks()
		expect(result).toEqual([mockCodeBlock])
		expect(mockParseCodeFileBySize).toHaveBeenCalledWith("test.js")
	})

	it("should handle parse errors gracefully", async () => {
		mockParseCodeFileBySize.mockRejectedValueOnce(new Error("Parse error"))
		const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {})

		const result = await scanDirectoryForCodeBlocks()
		expect(result).toEqual([])
		expect(consoleSpy).toHaveBeenCalled()
		consoleSpy.mockRestore()
	})

	it("should return empty array when no files match criteria", async () => {
		mockListFiles.mockResolvedValue([[], false])
		const result = await scanDirectoryForCodeBlocks()
		expect(result).toEqual([])
	})
})
