// Create mock vscode module before importing anything
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

// Mock modules
jest.mock("vscode", () => mockVscode)
jest.mock("../../../services/browser/UrlContentFetcher")
jest.mock("../../../utils/git")
jest.mock("../../../utils/path")

// Now import the modules that use the mocks
import { parseMentions, openMention } from "../index"
import { UrlContentFetcher } from "../../../services/browser/UrlContentFetcher"
import * as git from "../../../utils/git"

import { getWorkspacePath } from "../../../utils/path"
;(getWorkspacePath as jest.Mock).mockReturnValue("/test/workspace")

describe("mentions", () => {
	const mockCwd = "/test/workspace"
	let mockUrlContentFetcher: UrlContentFetcher

	beforeEach(() => {
		jest.clearAllMocks()

		// Create a mock instance with just the methods we need
		mockUrlContentFetcher = {
			launchBrowser: jest.fn().mockResolvedValue(undefined),
			closeBrowser: jest.fn().mockResolvedValue(undefined),
			urlToMarkdown: jest.fn().mockResolvedValue(""),
		} as unknown as UrlContentFetcher

		// Reset all vscode mocks
		mockVscode.workspace.fs.stat.mockReset()
		mockVscode.workspace.fs.writeFile.mockReset()
		mockVscode.workspace.openTextDocument.mockReset().mockResolvedValue({})
		mockVscode.window.showTextDocument.mockReset().mockResolvedValue({})
		mockVscode.window.showErrorMessage.mockReset()
		mockExecuteCommand.mockReset()
		mockOpenExternal.mockReset()
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

		it("should parse file paths with spaces", async () => {
			// Mock the file content fetching
			const fileContent = "This is the content of the file with spaces in its name"

			// Mock the getFileOrFolderContent function (which is called internally by parseMentions)
			// This is done by mocking the fs.readFile that would be called inside getFileOrFolderContent
			const fs = require("fs/promises")
			jest.spyOn(fs, "readFile").mockResolvedValue(fileContent)
			jest.spyOn(fs, "stat").mockResolvedValue({ isFile: () => true, isDirectory: () => false } as any)

			// Test with a file path containing spaces
			const filePath = "/path/with spaces/my file.txt"

			// First, verify that the regex pattern correctly matches the entire path
			// Import the regex pattern directly to test it
			const { mentionRegexGlobal } = require("../../../shared/context-mentions")
			const mentionMatch = `@${filePath}`.match(mentionRegexGlobal)
			expect(mentionMatch).not.toBeNull()
			expect(mentionMatch![0]).toBe(`@${filePath}`)

			// Now test the full parseMentions function
			const result = await parseMentions(`Check out this file @${filePath}`, mockCwd, mockUrlContentFetcher)

			// Verify the file path with spaces was correctly parsed
			expect(result).toContain(`'path/with spaces/my file.txt' (see below for file content)`)
			expect(result).toContain(`<file_content path="path/with spaces/my file.txt">`)
		})

		it("should parse folder paths with spaces", async () => {
			// Mock the folder content fetching
			const folderContent = "├── file1.txt\n├── file2.txt\n└── subfolder/"

			// Mock the getFileOrFolderContent function (which is called internally by parseMentions)
			// This is done by mocking the fs.readdir and fs.stat that would be called inside getFileOrFolderContent
			const fs = require("fs/promises")
			jest.spyOn(fs, "readdir").mockResolvedValue([
				{ name: "file1.txt", isFile: () => true, isDirectory: () => false },
				{ name: "file2.txt", isFile: () => true, isDirectory: () => false },
				{ name: "subfolder", isFile: () => false, isDirectory: () => true }
			])
			jest.spyOn(fs, "stat").mockResolvedValue({ isFile: () => false, isDirectory: () => true } as any)

			const folderPath = "/folder with spaces/"
			const result = await parseMentions(`Check out this folder @${folderPath}`, mockCwd, mockUrlContentFetcher)

			// Verify the folder path with spaces was correctly parsed
			expect(result).toContain(`'folder with spaces/' (see below for folder content)`)
			expect(result).toContain(`<folder_content path="folder with spaces/">`)
		})
	})

	describe("openMention", () => {
		it("should handle file paths and problems", async () => {
			// Mock stat to simulate file not existing
			mockVscode.workspace.fs.stat.mockRejectedValueOnce(new Error("File does not exist"))

			// Call openMention and wait for it to complete
			await openMention("/path/to/file")

			// Verify error handling
			expect(mockExecuteCommand).not.toHaveBeenCalled()
			expect(mockOpenExternal).not.toHaveBeenCalled()
			expect(mockVscode.window.showErrorMessage).toHaveBeenCalledWith("Could not open file: File does not exist")

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
	})
})
