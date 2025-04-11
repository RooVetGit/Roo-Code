import * as vscode from "vscode"
import * as path from "path"
import fs from "fs/promises"
import { openFile } from "../../../integrations/misc/open-file"
import { getWorkspacePath } from "../../../utils/path"
// Test through exported functions parseMentions and openMention
import { parseMentions, openMention } from "../index"
import { UrlContentFetcher } from "../../../services/browser/UrlContentFetcher"

// Mocks
jest.mock("fs/promises", () => ({
	stat: jest.fn(),
	readdir: jest.fn(),
}))
jest.mock("../../../integrations/misc/open-file", () => ({
	openFile: jest.fn(),
}))
jest.mock("../../../utils/path", () => ({
	getWorkspacePath: jest.fn(),
}))
jest.mock(
	"vscode",
	() => ({
		commands: {
			executeCommand: jest.fn(),
		},
		Uri: {
			file: jest.fn((p) => ({ fsPath: p })), // Simple mock for Uri.file
		},
		window: {
			showErrorMessage: jest.fn(),
		},
		env: {
			openExternal: jest.fn(),
		},
	}),
	{ virtual: true },
)
jest.mock("../../../integrations/misc/extract-text", () => ({
	extractTextFromFile: jest.fn(),
}))
jest.mock("isbinaryfile", () => ({
	isBinaryFile: jest.fn().mockResolvedValue(false),
}))
jest.mock("../../../services/browser/UrlContentFetcher")

// Helper to reset mocks between tests
const resetMocks = () => {
	;(fs.stat as jest.Mock).mockClear()
	;(fs.readdir as jest.Mock).mockClear()
	;(openFile as jest.Mock).mockClear()
	;(getWorkspacePath as jest.Mock).mockClear()
	;(vscode.commands.executeCommand as jest.Mock).mockClear()
	;(vscode.Uri.file as jest.Mock).mockClear()
	;(require("../../../integrations/misc/extract-text").extractTextFromFile as jest.Mock).mockClear()
	;(require("isbinaryfile").isBinaryFile as jest.Mock).mockClear()
}

describe("Core Mentions Logic", () => {
	const MOCK_CWD = "/mock/workspace"

	beforeEach(() => {
		resetMocks()
		// Default mock implementations
		;(getWorkspacePath as jest.Mock).mockReturnValue(MOCK_CWD)
	})

	describe("parseMentions", () => {
		let mockUrlFetcher: UrlContentFetcher

		beforeEach(() => {
			mockUrlFetcher = new (UrlContentFetcher as jest.Mock<UrlContentFetcher>)()
			;(fs.stat as jest.Mock).mockResolvedValue({ isFile: () => true, isDirectory: () => false })
			;(require("../../../integrations/misc/extract-text").extractTextFromFile as jest.Mock).mockResolvedValue(
				"Mock file content",
			)
		})

		it("should correctly parse mentions with escaped spaces and fetch content", async () => {
			const text = "Please check the file @/path/to/file\\ with\\ spaces.txt"
			const mentionPath = "/path/to/file\\ with\\ spaces.txt"
			const expectedUnescaped = "path/to/file with spaces.txt" // Note: leading '/' removed by slice(1) in parseMentions
			const expectedAbsPath = path.resolve(MOCK_CWD, expectedUnescaped)

			const result = await parseMentions(text, MOCK_CWD, mockUrlFetcher)

			// Check if fs.stat was called with the unescaped path
			expect(fs.stat).toHaveBeenCalledWith(expectedAbsPath)
			// Check if extractTextFromFile was called with the unescaped path
			expect(require("../../../integrations/misc/extract-text").extractTextFromFile).toHaveBeenCalledWith(
				expectedAbsPath,
			)

			// Check the output format
			expect(result).toContain(`'path/to/file\\ with\\ spaces.txt' (see below for file content)`)
			expect(result).toContain(
				`<file_content path="path/to/file\\ with\\ spaces.txt">\nMock file content\n</file_content>`,
			)
		})

		it("should handle folder mentions with escaped spaces", async () => {
			const text = "Look in @/my\\ documents/folder\\ name/"
			const mentionPath = "/my\\ documents/folder\\ name/"
			const expectedUnescaped = "my documents/folder name/"
			const expectedAbsPath = path.resolve(MOCK_CWD, expectedUnescaped)
			;(fs.stat as jest.Mock).mockResolvedValue({ isFile: () => false, isDirectory: () => true })
			;(fs.readdir as jest.Mock).mockResolvedValue([]) // Empty directory

			const result = await parseMentions(text, MOCK_CWD, mockUrlFetcher)

			expect(fs.stat).toHaveBeenCalledWith(expectedAbsPath)
			expect(fs.readdir).toHaveBeenCalledWith(expectedAbsPath, { withFileTypes: true })
			expect(result).toContain(`'my\\ documents/folder\\ name/' (see below for folder content)`)
			expect(result).toContain(`<folder_content path="my\\ documents/folder\\ name/">`) // Content check might be more complex
		})

		it("should handle errors when accessing paths with escaped spaces", async () => {
			const text = "Check @/nonexistent\\ file.txt"
			const mentionPath = "/nonexistent\\ file.txt"
			const expectedUnescaped = "nonexistent file.txt"
			const expectedAbsPath = path.resolve(MOCK_CWD, expectedUnescaped)
			const mockError = new Error("ENOENT: no such file or directory")
			;(fs.stat as jest.Mock).mockRejectedValue(mockError)

			const result = await parseMentions(text, MOCK_CWD, mockUrlFetcher)

			expect(fs.stat).toHaveBeenCalledWith(expectedAbsPath)
			expect(result).toContain(
				`<file_content path="nonexistent\\ file.txt">\nError fetching content: Failed to access path "nonexistent\\ file.txt": ${mockError.message}\n</file_content>`,
			)
		})

		// Add more tests for parseMentions if needed (URLs, other mentions combined with escaped paths etc.)
	})

	describe("openMention", () => {
		beforeEach(() => {
			;(getWorkspacePath as jest.Mock).mockReturnValue(MOCK_CWD)
		})

		it("should unescape file path before opening", async () => {
			const mention = "/file\\ with\\ spaces.txt"
			const expectedUnescaped = "file with spaces.txt"
			const expectedAbsPath = path.resolve(MOCK_CWD, expectedUnescaped)

			await openMention(mention)

			expect(openFile).toHaveBeenCalledWith(expectedAbsPath)
			expect(vscode.commands.executeCommand).not.toHaveBeenCalled()
		})

		it("should unescape folder path before revealing", async () => {
			const mention = "/folder\\ with\\ spaces/"
			const expectedUnescaped = "folder with spaces/"
			const expectedAbsPath = path.resolve(MOCK_CWD, expectedUnescaped)
			const expectedUri = { fsPath: expectedAbsPath } // From mock
			;(vscode.Uri.file as jest.Mock).mockReturnValue(expectedUri)

			await openMention(mention)

			expect(vscode.commands.executeCommand).toHaveBeenCalledWith("revealInExplorer", expectedUri)
			expect(vscode.Uri.file).toHaveBeenCalledWith(expectedAbsPath)
			expect(openFile).not.toHaveBeenCalled()
		})

		it("should handle mentions without paths correctly", async () => {
			await openMention("@problems")
			expect(vscode.commands.executeCommand).toHaveBeenCalledWith("workbench.actions.view.problems")

			await openMention("@terminal")
			expect(vscode.commands.executeCommand).toHaveBeenCalledWith("workbench.action.terminal.focus")

			await openMention("@http://example.com")
			expect(vscode.env.openExternal).toHaveBeenCalled() // Check if called, specific URI mock might be needed for detailed check

			await openMention("@git-changes") // Assuming no specific action for this yet
			// Add expectations if an action is defined for git-changes

			await openMention("@a1b2c3d") // Assuming no specific action for commit hashes yet
			// Add expectations if an action is defined for commit hashes
		})

		it("should do nothing if mention is undefined or empty", async () => {
			await openMention(undefined)
			await openMention("")
			expect(openFile).not.toHaveBeenCalled()
			expect(vscode.commands.executeCommand).not.toHaveBeenCalled()
			expect(vscode.env.openExternal).not.toHaveBeenCalled()
		})

		it("should do nothing if cwd is not available", async () => {
			;(getWorkspacePath as jest.Mock).mockReturnValue(undefined)
			await openMention("/some\\ path.txt")
			expect(openFile).not.toHaveBeenCalled()
			expect(vscode.commands.executeCommand).not.toHaveBeenCalled()
		})
	})
})
