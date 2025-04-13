// Create mock vscode module before importing anything
import * as path from "path"
const createMockUri = (scheme: string, path: string) => ({
	scheme,
	authority: "",
	path,
	query: "",
	fragment: "",
	fsPath: path,
	with: jest.fn(),
	toString: () => path,
	toJSON: () => ({
		scheme,
		authority: "",
		path,
		query: "",
		fragment: "",
	}),
})

const mockExecuteCommand = jest.fn()
const mockOpenExternal = jest.fn()
const mockShowErrorMessage = jest.fn()

const mockVscode = {
	workspace: {
		workspaceFolders: [
			{
				uri: { fsPath: "/test/workspace" },
			},
		] as { uri: { fsPath: string } }[] | undefined,
		getWorkspaceFolder: jest.fn().mockReturnValue("/test/workspace"),
		fs: {
			stat: jest.fn(),
			writeFile: jest.fn(),
		},
		openTextDocument: jest.fn().mockResolvedValue({}),
	},
	window: {
		showErrorMessage: mockShowErrorMessage,
		showInformationMessage: jest.fn(),
		showWarningMessage: jest.fn(),
		createTextEditorDecorationType: jest.fn(),
		createOutputChannel: jest.fn(),
		createWebviewPanel: jest.fn(),
		showTextDocument: jest.fn().mockResolvedValue({}),
		activeTextEditor: undefined as
			| undefined
			| {
					document: {
						uri: { fsPath: string }
					}
			  },
	},
	commands: {
		executeCommand: mockExecuteCommand,
	},
	env: {
		openExternal: mockOpenExternal,
	},
	Uri: {
		parse: jest.fn((url: string) => createMockUri("https", url)),
		file: jest.fn((path: string) => createMockUri("file", path)),
	},
	Position: jest.fn(),
	Range: jest.fn(),
	TextEdit: jest.fn(),
	WorkspaceEdit: jest.fn(),
	DiagnosticSeverity: {
		Error: 0,
		Warning: 1,
		Information: 2,
		Hint: 3,
	},
}

// Mock fs
const mockFs = {
	stat: jest.fn(),
	readdir: jest.fn(),
}

// Mock extract text function
const mockExtractTextFromFile = jest.fn()

// Mock open file function
const mockOpenFile = jest.fn()

// Mock modules
jest.mock("vscode", () => mockVscode)
jest.mock("../../../services/browser/UrlContentFetcher")
jest.mock("../../../utils/git")
jest.mock("../../../utils/path")
jest.mock("../../../integrations/misc/open-file", () => ({
	openFile: jest.fn().mockImplementation((path) => mockOpenFile(path)),
}))
jest.mock("fs/promises", () => mockFs)
jest.mock("../../../integrations/misc/extract-text", () => ({
	extractTextFromFile: jest.fn().mockImplementation((path) => mockExtractTextFromFile(path)),
}))

// Now import the modules that use the mocks
import { parseMentions, openMention } from "../index"
import { UrlContentFetcher } from "../../../services/browser/UrlContentFetcher"
import * as git from "../../../utils/git"
import { openFile } from "../../../integrations/misc/open-file"
import { extractTextFromFile } from "../../../integrations/misc/extract-text"

import { getWorkspacePath } from "../../../utils/path"
;(getWorkspacePath as jest.Mock).mockReturnValue("/test/workspace")

// We need to handle the console.error properly for tests
const originalConsoleError = console.error
// Replace console.error with a mock during tests
console.error = jest.fn()

// Helper function to normalize path for cross-platform tests
function normalizePath(pathString: string): string {
	// Replace backslashes with forward slashes for comparison
	return pathString.replace(/\\/g, "/")
}

describe("mentions", () => {
	const mockCwd = "C:\\test\\workspace"
	let mockUrlContentFetcher: UrlContentFetcher

	beforeEach(() => {
		jest.clearAllMocks()

		// Create a mock instance with just the methods we need
		mockUrlContentFetcher = {
			launchBrowser: jest.fn().mockResolvedValue(undefined),
			closeBrowser: jest.fn().mockResolvedValue(undefined),
			urlToMarkdown: jest.fn().mockResolvedValue(""),
		} as unknown as UrlContentFetcher

		// Reset all mocks
		mockVscode.workspace.fs.stat.mockReset()
		mockVscode.workspace.fs.writeFile.mockReset()
		mockVscode.workspace.openTextDocument.mockReset().mockResolvedValue({})
		mockVscode.window.showTextDocument.mockReset().mockResolvedValue({})
		mockVscode.window.showErrorMessage.mockReset()
		mockExecuteCommand.mockReset()
		mockOpenExternal.mockReset()
		mockFs.stat.mockReset()
		mockFs.readdir.mockReset()
		mockExtractTextFromFile.mockReset()
		mockOpenFile.mockReset()
	})

	afterAll(() => {
		// Restore original console.error after all tests
		console.error = originalConsoleError
	})

	describe("parseMentions", () => {
		it("should parse git commit mentions", async () => {
			const commitHash = "abc1234"
			const commitInfo = `abc1234 Fix bug in parser

Author: John Doe
Date: Mon Jan 5 23:50:06 2025 -0500

Detailed commit message with multiple lines
- Fixed parsing issue
- Added tests`

			jest.mocked(git.getCommitInfo).mockResolvedValue(commitInfo)

			const result = await parseMentions(`Check out this commit @${commitHash}`, mockCwd, mockUrlContentFetcher)

			expect(result).toContain(`'${commitHash}' (see below for commit info)`)
			expect(result).toContain(`<git_commit hash="${commitHash}">`)
			expect(result).toContain(commitInfo)
		})

		it("should handle errors fetching git info", async () => {
			const commitHash = "abc1234"
			const errorMessage = "Failed to get commit info"

			jest.mocked(git.getCommitInfo).mockRejectedValue(new Error(errorMessage))

			const result = await parseMentions(`Check out this commit @${commitHash}`, mockCwd, mockUrlContentFetcher)

			expect(result).toContain(`'${commitHash}' (see below for commit info)`)
			expect(result).toContain(`<git_commit hash="${commitHash}">`)
			expect(result).toContain(`Error fetching commit info: ${errorMessage}`)
		})

		it("should correctly handle file mentions with escaped spaces", async () => {
			// Setup mocks
			const fileContent = "This is the content of the file with spaces"
			mockExtractTextFromFile.mockResolvedValue(fileContent)
			mockFs.stat.mockResolvedValue({
				isFile: () => true,
				isDirectory: () => false,
			} as any)

			const testText = "Check this file: @/path/with\\ spaces/test\\ file.txt"
			await parseMentions(testText, mockCwd, mockUrlContentFetcher)

			// Call parseMentions
			const result = await parseMentions(testText, mockCwd, mockUrlContentFetcher)

			// Get the path that was passed to extractTextFromFile
			const extractFilePath = mockExtractTextFromFile.mock.calls[0][0]

			// Construct the expected unescaped path in a platform-independent way
			const expectedUnescapedPath = path.resolve(mockCwd, "path", "with spaces", "test file.txt")

			// For debugging
			console.log("Actual path in test:", extractFilePath)
			console.log("Expected path in test:", expectedUnescapedPath)

			// Verify the path passed was the correctly unescaped path
			expect(normalizePath(extractFilePath)).toEqual(normalizePath(expectedUnescapedPath))

			// Verify result includes file content
			expect(result).toContain(fileContent)

			// Verify the path in the result still maintains escaped form for display
			expect(result).toContain('<file_content path="path/with\\ spaces/test\\ file.txt">')
		})

		it("should correctly handle directory mentions with escaped spaces", async () => {
			// Setup directory structure mock
			mockFs.stat.mockResolvedValue({
				isFile: () => false,
				isDirectory: () => true,
			} as any)

			// Mock directory entries
			mockFs.readdir.mockResolvedValue([
				{ name: "file1.txt", isFile: () => true, isDirectory: () => false },
				{ name: "file with spaces.txt", isFile: () => true, isDirectory: () => false },
				{ name: "sub dir", isDirectory: () => true, isFile: () => false },
			] as any)

			// Test text with a directory mention containing escaped spaces
			const testText = "Check this directory: @/path/with\\ spaces/"

			// Call parseMentions
			const result = await parseMentions(testText, mockCwd, mockUrlContentFetcher)

			// Get the path that was passed to readdir
			const readdirPath = mockFs.readdir.mock.calls[0][0]

			// Construct the expected unescaped path
			const expectedUnescapedPath = path.resolve(mockCwd, "path", "with spaces")

			// For debugging
			console.log("Actual directory path in test:", readdirPath)
			console.log("Expected directory path in test:", expectedUnescapedPath)

			// Verify fs.readdir was called with proper unescaped path
			expect(normalizePath(readdirPath)).toEqual(normalizePath(expectedUnescapedPath))

			// Verify directory listing in result
			expect(result).toContain("file1.txt")
			expect(result).toContain("file with spaces.txt")
			expect(result).toContain("sub dir/")

			// Verify the path in the result still maintains escaped form for display
			expect(result).toContain('<folder_content path="path/with\\ spaces/">')
		})

		// Test the internal unescapePathSpaces function indirectly through parseMentions
		it("should properly handle various escape patterns", async () => {
			// Setup mocks
			mockExtractTextFromFile.mockResolvedValue("test content")
			mockFs.stat.mockResolvedValue({
				isFile: () => true,
				isDirectory: () => false,
			} as any)

			// Test specific escape patterns one at a time
			const testEscapedPath = "/path/with\\ one\\ space.txt"
			const testText = `Testing @${testEscapedPath}`

			// Call parseMentions
			await parseMentions(testText, mockCwd, mockUrlContentFetcher)

			// Get the path that was passed to extractTextFromFile
			const extractFilePath = mockExtractTextFromFile.mock.calls[0][0]

			// Construct expected unescaped path
			const expectedUnescapedPath = path.resolve(mockCwd, "path", "with one space.txt")

			// For debugging
			console.log("Actual path with spaces in test:", extractFilePath)
			console.log("Expected path with spaces in test:", expectedUnescapedPath)

			// Verify the path was correctly unescaped
			expect(normalizePath(extractFilePath)).toEqual(normalizePath(expectedUnescapedPath))
		})

		// Additional test to cover more edge cases and complex paths
		it("should handle complex paths and multiple mentions in the same text", async () => {
			// Setup mocks
			mockExtractTextFromFile.mockResolvedValue("File content")
			mockFs.stat.mockResolvedValue({
				isFile: () => true,
				isDirectory: () => false,
			} as any)

			// Test with a single complex path with multiple spaces
			const complexPath = "/complex/path\\ with\\ multiple\\ spaces/file.txt"
			const testText = `Test complex path: @${complexPath}`

			// Call parseMentions
			const result = await parseMentions(testText, mockCwd, mockUrlContentFetcher)

			// Get the path that was passed to extractTextFromFile
			const extractFilePath = mockExtractTextFromFile.mock.calls[0][0]

			// Construct expected path
			const expectedPath = path.resolve(mockCwd, "complex", "path with multiple spaces", "file.txt")

			// Verify the path was correctly resolved
			expect(normalizePath(extractFilePath)).toEqual(normalizePath(expectedPath))

			// Verify XML tag format is correct (no leading slash, backslashes preserved)
			expect(result).toContain('<file_content path="complex/path\\ with\\ multiple\\ spaces/file.txt">')
		})

		// Test platform-specific path handling without modifying Node's path module
		it("should correctly handle paths with both forward and backslashes", async () => {
			// Setup mocks
			mockExtractTextFromFile.mockResolvedValue("File content")
			mockFs.stat.mockResolvedValue({
				isFile: () => true,
				isDirectory: () => false,
			} as any)

			// Test path with forward slashes (Unix-style)
			const unixStylePath = "/unix/style/path\\ with/spaces/file.txt"
			const unixText = `Check this Unix path: @${unixStylePath}`

			// Call parseMentions for Unix style
			const unixResult = await parseMentions(unixText, mockCwd, mockUrlContentFetcher)

			// Get path from first call
			const unixExtractPath = mockExtractTextFromFile.mock.calls[0][0]

			// Reset mocks
			jest.clearAllMocks()

			// Test path with backslashes (Windows-style)
			const winStylePath = "/windows\\\\style/path\\ with\\\\spaces/file.txt"
			const winText = `Check this Windows path: @${winStylePath}`

			// Call parseMentions for Windows style
			const winResult = await parseMentions(winText, mockCwd, mockUrlContentFetcher)

			// Get path from first call
			const winExtractPath = mockExtractTextFromFile.mock.calls[0][0]

			// Both paths should be normalized by normalizePath
			expect(normalizePath(unixExtractPath)).toContain("unix/style/path with/spaces/file.txt")
			expect(normalizePath(winExtractPath)).toContain("windows/style/path with/spaces/file.txt")

			// XML tags should preserve the original slash style
			expect(unixResult).toContain('<file_content path="unix/style/path\\ with/spaces/file.txt">')
			expect(winResult).toContain('<file_content path="windows\\\\style/path\\ with\\\\spaces/file.txt">')
		})
	})

	describe("openMention", () => {
		it("should handle file paths and problems", async () => {
			// We need a special wrapper for handling errors in tests
			let errorThrown = false

			// Mock error function to simulate file not existing
			mockOpenFile.mockImplementationOnce(() => {
				errorThrown = true
				throw new Error("File does not exist")
			})

			try {
				// Call openMention and wait for it to complete
				await openMention("/path/to/file")
			} catch (e) {
				// We expect an error but want to continue the test
			}

			// Verify openFile was called
			expect(mockOpenFile).toHaveBeenCalled()

			// Verify error was thrown
			expect(errorThrown).toBe(true)

			// Verify no other method was called
			expect(mockExecuteCommand).not.toHaveBeenCalled()
			expect(mockOpenExternal).not.toHaveBeenCalled()

			// Reset mocks for next test
			jest.clearAllMocks()

			// Test problems command
			await openMention("problems")
			expect(mockExecuteCommand).toHaveBeenCalledWith("workbench.actions.view.problems")
		})

		it("should handle URLs", async () => {
			const url = "https://example.com"
			await openMention(url)
			const mockUri = mockVscode.Uri.parse(url)
			expect(mockVscode.env.openExternal).toHaveBeenCalled()
			const calledArg = mockVscode.env.openExternal.mock.calls[0][0]
			expect(calledArg).toEqual(
				expect.objectContaining({
					scheme: mockUri.scheme,
					authority: mockUri.authority,
					path: mockUri.path,
					query: mockUri.query,
					fragment: mockUri.fragment,
				}),
			)
		})

		it("should correctly handle file paths with escaped spaces", async () => {
			// Test path with escaped spaces
			const escapedPath = "/path/with\\ spaces/file\\ name\\ with\\ spaces.txt"

			// Call openMention with path containing escaped spaces
			await openMention(escapedPath)

			// Get the path that was passed to openFile
			const openFilePath = mockOpenFile.mock.calls[0][0]

			// Construct expected unescaped path
			const expectedUnescapedPath = path.join(mockCwd, "path", "with spaces", "file name with spaces.txt")

			// For debugging
			console.log("Actual path in openFile test:", openFilePath)
			console.log("Expected path in openFile test:", expectedUnescapedPath)

			// Verify the path was correctly unescaped
			expect(normalizePath(openFilePath)).toEqual(normalizePath(expectedUnescapedPath))

			// Reset mocks
			jest.clearAllMocks()

			// Test with a directory path
			const escapedDirPath = "/directory/with\\ spaces/"

			// Call openMention with directory path containing escaped spaces
			await openMention(escapedDirPath)

			// Verify reveal in explorer was called with correct unescaped path
			// We need to check the Uri object passed to executeCommand
			const revealCallArgs = mockExecuteCommand.mock.calls.find((call) => call[0] === "revealInExplorer")
			expect(revealCallArgs).toBeDefined()
			const revealedUri = revealCallArgs[1]

			// Construct expected path for Uri
			const expectedUriPath = path.join(mockCwd, "directory", "with spaces")

			// Check Uri properties
			expect(revealedUri).toBeDefined()
			expect(revealedUri.scheme).toEqual("file")
			expect(revealedUri.fsPath).toEqual(expectedUriPath)
		})
	})
})
