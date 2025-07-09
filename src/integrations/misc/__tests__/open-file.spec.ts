import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as vscode from "vscode"
import * as path from "path"
import * as os from "os"
import { openFile } from "../open-file"

// Mock vscode module
vi.mock("vscode", () => ({
	Uri: {
		file: vi.fn((path: string) => ({ fsPath: path })),
	},
	workspace: {
		fs: {
			stat: vi.fn(),
			writeFile: vi.fn(),
		},
		openTextDocument: vi.fn(),
	},
	window: {
		showTextDocument: vi.fn(),
		showErrorMessage: vi.fn(),
		tabGroups: {
			all: [],
		},
		activeTextEditor: undefined,
	},
	commands: {
		executeCommand: vi.fn(),
	},
	FileType: {
		Directory: 2,
		File: 1,
	},
	Selection: vi.fn((startLine: number, startChar: number, endLine: number, endChar: number) => ({
		start: { line: startLine, character: startChar },
		end: { line: endLine, character: endChar },
	})),
	TabInputText: vi.fn(),
}))

// Mock utils
vi.mock("../../utils/path", () => ({
	arePathsEqual: vi.fn((a: string, b: string) => a === b),
	getWorkspacePath: vi.fn(() => "/Users/roocode"),
}))

// Mock i18n
vi.mock("../../i18n", () => ({
	t: vi.fn((key: string, params?: any) => {
		// Return the key without namespace prefix to match actual behavior
		if (key.startsWith("common:")) {
			return key.replace("common:", "")
		}
		return key
	}),
}))

describe("openFile", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.spyOn(console, "warn").mockImplementation(() => {})
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("decodeURIComponent error handling", () => {
		it("should handle invalid URI encoding gracefully", async () => {
			const invalidPath = "test%ZZinvalid.txt" // Invalid percent encoding
			const mockDocument = { uri: { fsPath: invalidPath } }

			vi.mocked(vscode.workspace.fs.stat).mockResolvedValue({
				type: vscode.FileType.File,
				ctime: 0,
				mtime: 0,
				size: 0,
			})
			vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any)
			vi.mocked(vscode.window.showTextDocument).mockResolvedValue({} as any)

			await openFile(invalidPath)

			// Should log a warning about decode failure
			expect(console.warn).toHaveBeenCalledWith(
				"Failed to decode file path: URIError: URI malformed. Using original path.",
			)

			// Should still attempt to open the file with the original path
			expect(vscode.workspace.openTextDocument).toHaveBeenCalled()
			expect(vscode.window.showErrorMessage).not.toHaveBeenCalled()
		})

		it("should successfully decode valid URI-encoded paths", async () => {
			const encodedPath = "./src/%5Btest%5D/file.txt" // [test] encoded
			const decodedPath = "./src/[test]/file.txt"
			const mockDocument = { uri: { fsPath: decodedPath } }

			vi.mocked(vscode.workspace.fs.stat).mockResolvedValue({
				type: vscode.FileType.File,
				ctime: 0,
				mtime: 0,
				size: 0,
			})
			vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any)
			vi.mocked(vscode.window.showTextDocument).mockResolvedValue({} as any)

			await openFile(encodedPath)

			// Should not log any warnings
			expect(console.warn).not.toHaveBeenCalled()

			// Should use the decoded path
			const expectedPath = path.join("/Users/roocode", "src/[test]/file.txt")
			expect(vscode.Uri.file).toHaveBeenCalledWith(expectedPath)
			expect(vscode.workspace.openTextDocument).toHaveBeenCalled()
			expect(vscode.window.showErrorMessage).not.toHaveBeenCalled()
		})

		it("should handle paths with special characters that need encoding", async () => {
			const pathWithSpecialChars = "./src/[brackets]/file with spaces.txt"
			const mockDocument = { uri: { fsPath: pathWithSpecialChars } }

			vi.mocked(vscode.workspace.fs.stat).mockResolvedValue({
				type: vscode.FileType.File,
				ctime: 0,
				mtime: 0,
				size: 0,
			})
			vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any)
			vi.mocked(vscode.window.showTextDocument).mockResolvedValue({} as any)

			await openFile(pathWithSpecialChars)

			// Should work without errors
			expect(console.warn).not.toHaveBeenCalled()
			expect(vscode.workspace.openTextDocument).toHaveBeenCalled()
			expect(vscode.window.showErrorMessage).not.toHaveBeenCalled()
		})

		it("should handle already decoded paths without double-decoding", async () => {
			const normalPath = "./src/normal/file.txt"
			const mockDocument = { uri: { fsPath: normalPath } }

			vi.mocked(vscode.workspace.fs.stat).mockResolvedValue({
				type: vscode.FileType.File,
				ctime: 0,
				mtime: 0,
				size: 0,
			})
			vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any)
			vi.mocked(vscode.window.showTextDocument).mockResolvedValue({} as any)

			await openFile(normalPath)

			// Should work without errors
			expect(console.warn).not.toHaveBeenCalled()
			expect(vscode.workspace.openTextDocument).toHaveBeenCalled()
			expect(vscode.window.showErrorMessage).not.toHaveBeenCalled()
		})
	})

	describe("error handling", () => {
		it("should show error message when file does not exist", async () => {
			const nonExistentPath = "./does/not/exist.txt"

			vi.mocked(vscode.workspace.fs.stat).mockRejectedValue(new Error("File not found"))

			await openFile(nonExistentPath)

			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("errors.could_not_open_file")
		})

		it("should handle generic errors", async () => {
			const testPath = "./test.txt"

			vi.mocked(vscode.workspace.fs.stat).mockRejectedValue("Not an Error object")

			await openFile(testPath)

			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("errors.could_not_open_file")
		})
	})

	describe("directory handling", () => {
		it("should reveal directories in explorer", async () => {
			const dirPath = "./src/components"

			vi.mocked(vscode.workspace.fs.stat).mockResolvedValue({
				type: vscode.FileType.Directory,
				ctime: 0,
				mtime: 0,
				size: 0,
			})

			await openFile(dirPath)

			expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
				"revealInExplorer",
				expect.objectContaining({ fsPath: expect.stringContaining("components") }),
			)
			expect(vscode.commands.executeCommand).toHaveBeenCalledWith("list.expand")
			expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled()
		})
	})

	describe("file creation", () => {
		it("should create new files when create option is true", async () => {
			const newFilePath = "./new/file.txt"
			const content = "Hello, world!"

			vi.mocked(vscode.workspace.fs.stat).mockRejectedValue(new Error("File not found"))
			vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue({} as any)
			vi.mocked(vscode.window.showTextDocument).mockResolvedValue({} as any)

			await openFile(newFilePath, { create: true, content })

			expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(
				expect.objectContaining({ fsPath: expect.stringContaining("new/file.txt") }),
				Buffer.from(content, "utf8"),
			)
			expect(vscode.workspace.openTextDocument).toHaveBeenCalled()
		})
	})
})
