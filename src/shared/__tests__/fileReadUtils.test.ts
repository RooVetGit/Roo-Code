import { isBinaryFile } from "isbinaryfile"
import * as path from "path"
import { processFileForReading } from "../fileReadUtils"
import { RooIgnoreController } from "../../core/ignore/RooIgnoreController"

// Define default mock content source
const getGlobalDefaultMockLines = () => Array.from({ length: 5 }, (_, i) => `line ${i + 1}`)
const getGlobalDefaultMockContentString = () => getGlobalDefaultMockLines().join("\n")

jest.mock("path", () => {
	const originalPath = jest.requireActual("path")
	return {
		...originalPath,
		resolve: jest.fn().mockImplementation((...args) => args.join("/")),
	}
})

jest.mock("node:fs", () => {
	const originalFs = jest.requireActual("node:fs")
	const streamMock = {
		on: jest.fn().mockReturnThis(),
		pipe: jest.fn().mockReturnThis(),
		// @ts-ignore
		[Symbol.asyncIterator]: async function* () {
			for (const line of getGlobalDefaultMockLines()) {
				yield line
			}
		},
	}
	return {
		...originalFs,
		createReadStream: jest.fn().mockReturnValue(streamMock),
		promises: {
			readFile: jest.fn().mockImplementation(async () => getGlobalDefaultMockContentString()),
		},
	}
})

jest.mock("node:readline", () => ({
	createInterface: jest.fn().mockImplementation((_options) => ({
		[Symbol.asyncIterator]: jest.fn().mockImplementation(async function* () {
			for (const line of getGlobalDefaultMockLines()) {
				yield line
			}
		}),
		close: jest.fn(),
	})),
}))

jest.mock("isbinaryfile")
jest.mock("../../services/tree-sitter", () => ({
	parseSourceCodeDefinitionsForFile: jest.fn(),
}))

jest.mock("../../core/ignore/RooIgnoreController", () => ({
	RooIgnoreController: class {
		// Mock only the method needed by fileReadUtils
		validateAccess: jest.Mock<boolean, [string]> = jest.fn().mockReturnValue(true)
	},
}))

describe("processFileForReading", () => {
	const testFilePath = "test/file.txt"
	const absoluteFilePath = "/test/file.txt"

	const mockedIsBinaryFile = isBinaryFile as jest.MockedFunction<typeof isBinaryFile>
	const mockedPathResolve = path.resolve as jest.MockedFunction<typeof path.resolve>
	const mockRooIgnoreController = new RooIgnoreController("/mock/cwd")

	beforeEach(() => {
		jest.clearAllMocks()
		mockedPathResolve.mockReturnValue(absoluteFilePath)
		mockedIsBinaryFile.mockResolvedValue(false)
	})

	it("should process a text file with line range", async () => {
		const result = await processFileForReading(absoluteFilePath, testFilePath, 500, 2, 4, mockRooIgnoreController)

		expect(result).toEqual({
			relativePath: testFilePath,
			contentWithLineNumbers: expect.any(String),
			totalLinesInFile: expect.any(Number),
			isBinary: false,
			wasTruncated: false,
			wasRangeRead: true,
			actualStartLine: 2,
			actualEndLine: 4,
		})
	})

	it("should handle binary files", async () => {
		mockedIsBinaryFile.mockResolvedValue(true)

		const result = await processFileForReading(absoluteFilePath, testFilePath, 500, 1, 5, mockRooIgnoreController)

		expect(result).toEqual({
			relativePath: testFilePath,
			notice: "File is binary. Content display may be limited.",
			totalLinesInFile: expect.any(Number),
			isBinary: true,
			wasTruncated: false,
			wasRangeRead: true,
		})
	})

	describe("processFileForReading with maxReadFileLine setting", () => {
		it("should return full content when maxReadFileLine is negative (-1)", async () => {
			// This test will now use the global default mocks (5 lines of "line X")
			// fs.promises.readFile will provide the 5 lines, and countFileLines will also count 5 lines.
			const result = await processFileForReading(
				absoluteFilePath,
				testFilePath,
				-1, // maxReadFileLine = -1
				undefined,
				undefined,
				mockRooIgnoreController,
			)

			expect(result).toEqual({
				relativePath: testFilePath,
				contentWithLineNumbers: getGlobalDefaultMockLines()
					.map((line, i) => `${i + 1} | ${line}`)
					.join("\n"),
				totalLinesInFile: 5,
				isBinary: false,
				wasTruncated: false,
				wasRangeRead: false,
				actualStartLine: 1,
				actualEndLine: 5,
			})
		})

		it("should truncate content when maxReadFileLine is less than file length", async () => {
			// This test uses the global default mocks (5 lines "line X").
			// processFileForReading will call countFileLines (sees 5 lines),
			// then determine truncation, then call readLines which will read from the 5-line mock
			// but limit to maxReadFileLine.
			// NO local mock override for readline needed here for this specific scenario.
			const result = await processFileForReading(
				absoluteFilePath,
				testFilePath,
				3, // maxReadFileLine = 3
				undefined,
				undefined,
				mockRooIgnoreController,
			)

			expect(result).toEqual({
				relativePath: testFilePath,
				contentWithLineNumbers: "1 | line 1\n2 | line 2\n3 | line 3",
				totalLinesInFile: 5,
				isBinary: false,
				wasTruncated: true,
				wasRangeRead: false,
				actualStartLine: 1,
				actualEndLine: 3,
				notice: "Showing only 3 of 5 total lines. Use start_line and end_line if you need to read more.",
			})
		})

		it("should return full content when maxReadFileLine equals file length", async () => {
			// Uses global default mocks (5 lines "line X")
			const result = await processFileForReading(
				absoluteFilePath,
				testFilePath,
				5, // maxReadFileLine = 5
				undefined,
				undefined,
				mockRooIgnoreController,
			)

			expect(result).toEqual({
				relativePath: testFilePath,
				contentWithLineNumbers: getGlobalDefaultMockLines()
					.map((line, i) => `${i + 1} | ${line}`)
					.join("\n"),
				totalLinesInFile: 5,
				isBinary: false,
				wasTruncated: false,
				wasRangeRead: false,
				actualStartLine: 1,
				actualEndLine: 5,
			})
		})

		it("should return full content when maxReadFileLine exceeds file length", async () => {
			// Uses global default mocks (5 lines "line X")
			const result = await processFileForReading(
				absoluteFilePath,
				testFilePath,
				10, // maxReadFileLine = 10
				undefined,
				undefined,
				mockRooIgnoreController,
			)

			expect(result).toEqual({
				relativePath: testFilePath,
				contentWithLineNumbers: "1 | line 1\n2 | line 2\n3 | line 3\n4 | line 4\n5 | line 5",
				totalLinesInFile: 5,
				isBinary: false,
				wasTruncated: false,
				wasRangeRead: false,
				actualStartLine: 1,
				actualEndLine: 5,
			})
		})
	})

	describe("processFileForReading with invalid range parameters", () => {
		it("should return error for non-numeric start_line", async () => {
			const result = await processFileForReading(
				absoluteFilePath,
				testFilePath,
				500,
				"invalid" as any,
				undefined,
				mockRooIgnoreController,
			)

			expect(result).toEqual({
				relativePath: testFilePath,
				error: "Invalid start_line value",
				totalLinesInFile: 0,
				isBinary: false,
				wasTruncated: false,
				wasRangeRead: false,
			})
		})

		it("should return error for non-numeric end_line", async () => {
			const result = await processFileForReading(
				absoluteFilePath,
				testFilePath,
				500,
				undefined,
				"invalid" as any,
				mockRooIgnoreController,
			)

			expect(result).toEqual({
				relativePath: testFilePath,
				error: "Invalid end_line value",
				totalLinesInFile: 0,
				isBinary: false,
				wasTruncated: false,
				wasRangeRead: false,
			})
		})

		it("should return error for negative start_line", async () => {
			const result = await processFileForReading(
				absoluteFilePath,
				testFilePath,
				500,
				-1,
				undefined,
				mockRooIgnoreController,
			)

			expect(result).toEqual({
				relativePath: testFilePath,
				error: "Invalid start_line value",
				totalLinesInFile: 0,
				isBinary: false,
				wasTruncated: false,
				wasRangeRead: false,
			})
		})

		it("should return error for negative end_line", async () => {
			const result = await processFileForReading(
				absoluteFilePath,
				testFilePath,
				500,
				undefined,
				-1,
				mockRooIgnoreController,
			)

			expect(result).toEqual({
				relativePath: testFilePath,
				error: "Invalid end_line value",
				totalLinesInFile: 0,
				isBinary: false,
				wasTruncated: false,
				wasRangeRead: false,
			})
		})

		it("should return error when start_line > end_line", async () => {
			const result = await processFileForReading(
				absoluteFilePath,
				testFilePath,
				500,
				5,
				3,
				mockRooIgnoreController,
			)

			expect(result).toEqual({
				relativePath: testFilePath,
				error: "start_line must be less than or equal to end_line",
				totalLinesInFile: 0,
				isBinary: false,
				wasTruncated: false,
				wasRangeRead: false,
			})
		})
	})

	describe("processFileForReading line numbering verification", () => {
		it("should correctly number lines for full file read", async () => {
			const specificMockLines = ["first line", "second line", "third line"]
			const specificMockContentString = specificMockLines.join("\n")
			const { createInterface: mockRlCreateInterface } = require("node:readline")
			const { promises: mockFsPromises } = require("node:fs")

			mockRlCreateInterface.mockImplementation(() => ({
				[Symbol.asyncIterator]: async function* () {
					for (const line of specificMockLines) yield line
				},
				close: jest.fn(),
			}))
			mockFsPromises.readFile.mockResolvedValue(specificMockContentString)

			const result = await processFileForReading(
				absoluteFilePath,
				testFilePath,
				-1, // full read
				undefined,
				undefined,
				mockRooIgnoreController,
			)

			expect(result.contentWithLineNumbers).toBe("1 | first line\n2 | second line\n3 | third line")
			expect(result.totalLinesInFile).toBe(3)
		})

		it("should correctly number lines for truncated read", async () => {
			// Simulating a file that has 3 lines, but we only want to read 2.
			const fullFileSpecificMockLines = ["first line", "second line", "third line"]
			const { createInterface: mockRlCreateInterface } = require("node:readline")
			// fs.promises.readFile mock is not strictly needed here if truncation path is taken,
			// but good practice if the test was ever to change to not truncate.
			// For this test, countFileLines needs to see 3 lines.
			mockRlCreateInterface.mockImplementation(() => ({
				[Symbol.asyncIterator]: async function* () {
					for (const line of fullFileSpecificMockLines) yield line
				},
				close: jest.fn(),
			}))

			const result = await processFileForReading(
				absoluteFilePath,
				testFilePath,
				2, // truncate at 2 lines
				undefined,
				undefined,
				mockRooIgnoreController,
			)

			expect(result.contentWithLineNumbers).toBe("1 | first line\n2 | second line")
		})

		it("should correctly number lines for range read", async () => {
			const specificMockLinesForRangeTest = [
				"range test line 1",
				"range test line 2", // This is the one we want to start with (line 2)
				"range test line 3", // This is the one we want to end with (line 3)
				"range test line 4",
			]
			const { createInterface: mockRlCreateInterface } = require("node:readline")
			// countFileLines and readLines both use readline, so this mock serves both.
			mockRlCreateInterface.mockImplementation(() => ({
				[Symbol.asyncIterator]: async function* () {
					for (const line of specificMockLinesForRangeTest) {
						yield line
					}
				},
				close: jest.fn(),
			}))

			const result = await processFileForReading(
				absoluteFilePath,
				testFilePath,
				500, // maxReadFileLine (not strictly relevant for pure range read if range is smaller)
				2, // requestedStartLine
				3, // requestedEndLine
				mockRooIgnoreController,
			)

			expect(result.contentWithLineNumbers).toBe("2 | range test line 2\n3 | range test line 3")
			expect(result.totalLinesInFile).toBe(specificMockLinesForRangeTest.length)
			expect(result.actualStartLine).toBe(2)
			expect(result.actualEndLine).toBe(3)
			expect(result.wasRangeRead).toBe(true)
			expect(result.notice).toBeUndefined()
		})
	})

	it("should handle access denied files", async () => {
		const denyingController = new RooIgnoreController("/mock/cwd")
		denyingController.validateAccess = jest.fn().mockReturnValue(false) as any

		const result = await processFileForReading(absoluteFilePath, testFilePath, 500, 1, 5, denyingController)

		expect(result).toEqual({
			relativePath: testFilePath,
			error: "Access to file denied by .rooignore",
			totalLinesInFile: 0,
			isBinary: false,
			wasTruncated: false,
			wasRangeRead: false,
		})
	})

	it("should handle empty files", async () => {
		const { createReadStream } = require("node:fs")
		const { createInterface } = require("node:readline")

		createReadStream.mockImplementation(() => ({
			on: jest.fn((event, _callback) => {
				if (event === "data") {
					// No data emitted for empty file
					return this
				}
				return this
			}),
			pipe: jest.fn(),
		}))

		createInterface.mockImplementation(() => ({
			[Symbol.asyncIterator]: jest.fn().mockImplementation(function* () {
				// No lines yielded for empty file
				return
			}),
			close: jest.fn(),
		}))

		const result = await processFileForReading(
			absoluteFilePath,
			testFilePath,
			500,
			undefined,
			undefined,
			mockRooIgnoreController,
		)

		expect(result).toMatchObject({
			relativePath: testFilePath,
			notice: "File is empty.",
			totalLinesInFile: 0,
			isBinary: false,
			wasTruncated: false,
			wasRangeRead: false,
		})
	})

	it("should handle files with source code definitions", async () => {
		const { parseSourceCodeDefinitionsForFile: localMockedParse } = jest.requireMock("../../services/tree-sitter")
		const definitions = "function test() {}"
		localMockedParse.mockResolvedValue(definitions)

		const { createInterface } = require("node:readline")
		createInterface.mockImplementation(() => ({
			[Symbol.asyncIterator]: jest.fn().mockImplementation(function* () {
				for (let i = 1; i <= 5; i++) {
					yield `line ${i}`
				}
			}),
			close: jest.fn(),
		}))

		const result = await processFileForReading(
			absoluteFilePath,
			testFilePath,
			0, // maxReadFileLine = 0 to trigger definitions lookup
			undefined,
			undefined,
			mockRooIgnoreController,
		)

		expect(localMockedParse).toHaveBeenCalled()
		expect(result).toMatchObject({
			relativePath: testFilePath,
			sourceCodeDefinitions: definitions,
			notice: "Content omitted (maxReadFileLine: 0). Showing definitions if available.",
			totalLinesInFile: 5,
			isBinary: false,
			wasTruncated: true,
			wasRangeRead: false,
		})
	})
})
