import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"

import { FileWriter } from "../FileWriter"
import { Task } from "../../../core/task/Task"

// Mock VSCode API
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(() => ({
			get: vi.fn(),
		})),
	},
	languages: {
		getDiagnostics: vi.fn(() => []),
	},
	DiagnosticSeverity: {
		Error: 0,
	},
}))

// Mock fs module
vi.mock("fs/promises", () => ({
	readFile: vi.fn(),
	writeFile: vi.fn(),
	unlink: vi.fn(),
	rmdir: vi.fn(),
}))

// Mock other dependencies
vi.mock("../../../utils/fs", () => ({
	createDirectoriesForFile: vi.fn(() => Promise.resolve([])),
}))

vi.mock("../../diagnostics", () => ({
	diagnosticsToProblemsString: vi.fn(() => Promise.resolve("")),
	getNewDiagnostics: vi.fn(() => []),
}))

vi.mock("../../../utils/path", () => ({
	getReadablePath: vi.fn((cwd, relPath) => relPath),
}))

vi.mock("../../../core/prompts/responses", () => ({
	formatResponse: {
		createPrettyPatch: vi.fn(() => "mock-diff"),
	},
}))

vi.mock("strip-bom", () => ({
	default: vi.fn((content) => content),
}))

describe("FileWriter", () => {
	let fileWriter: FileWriter
	const mockCwd = "/test/cwd"
	const mockTask = {} as Task

	beforeEach(() => {
		vi.clearAllMocks()
		fileWriter = new FileWriter(mockCwd)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("initialize", () => {
		it("should initialize without errors", async () => {
			await expect(fileWriter.initialize()).resolves.toBeUndefined()
		})
	})

	describe("open", () => {
		it("should open an existing file for modification", async () => {
			const mockContent = "existing content"
			vi.mocked(fs.readFile).mockResolvedValue(mockContent)

			await fileWriter.open("test.txt")

			expect(fileWriter.editType).toBe("modify")
			expect(fileWriter.originalContent).toBe(mockContent)
			expect(fileWriter.isEditing).toBe(true)
		})

		it("should open a new file for creation", async () => {
			vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"))

			await fileWriter.open("new-file.txt")

			expect(fileWriter.editType).toBe("create")
			expect(fileWriter.originalContent).toBe("")
			expect(fileWriter.isEditing).toBe(true)
		})

		it("should handle viewColumn parameter (ignored)", async () => {
			vi.mocked(fs.readFile).mockResolvedValue("content")

			await expect(fileWriter.open("test.txt", "SomeViewColumn")).resolves.toBeUndefined()
		})
	})

	describe("update", () => {
		beforeEach(async () => {
			vi.mocked(fs.readFile).mockResolvedValue("original content")
			await fileWriter.open("test.txt")
		})

		it("should write final content to file", async () => {
			const content = "new content"

			await fileWriter.update(content, true)

			expect(fs.writeFile).toHaveBeenCalledWith(path.resolve(mockCwd, "test.txt"), content, "utf-8")
		})

		it("should preserve empty last line if original content had one", async () => {
			fileWriter.originalContent = "content\n"
			const content = "new content"

			await fileWriter.update(content, true)

			expect(fs.writeFile).toHaveBeenCalledWith(path.resolve(mockCwd, "test.txt"), "new content\n", "utf-8")
		})

		it("should not write to file if not final", async () => {
			await fileWriter.update("content", false)

			expect(fs.writeFile).not.toHaveBeenCalled()
		})
	})

	describe("saveChanges", () => {
		beforeEach(async () => {
			vi.mocked(fs.readFile).mockResolvedValue("original content")
			await fileWriter.open("test.txt")
			await fileWriter.update("new content", true)
		})

		it("should return save results", async () => {
			vi.mocked(fs.readFile).mockResolvedValue("new content")

			const result = await fileWriter.saveChanges()

			expect(result).toEqual({
				newProblemsMessage: "",
				userEdits: undefined,
				finalContent: "new content",
			})
		})
	})

	describe("pushToolWriteResult", () => {
		beforeEach(async () => {
			vi.mocked(fs.readFile).mockResolvedValue("content")
			await fileWriter.open("test.txt")
		})

		it("should return formatted XML response", async () => {
			const result = await fileWriter.pushToolWriteResult(mockTask, mockCwd, false)

			expect(result).toContain("<file_write_result>")
			expect(result).toContain("<path>test.txt</path>")
			expect(result).toContain("<operation>modified</operation>")
		})

		it("should handle new file creation", async () => {
			const result = await fileWriter.pushToolWriteResult(mockTask, mockCwd, true)

			expect(result).toContain("<operation>created</operation>")
		})
	})

	describe("revertChanges", () => {
		it("should delete new file and directories", async () => {
			vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"))
			await fileWriter.open("new-file.txt")

			await fileWriter.revertChanges()

			expect(fs.unlink).toHaveBeenCalled()
		})

		it("should restore original content for existing file", async () => {
			const originalContent = "original content"
			vi.mocked(fs.readFile).mockResolvedValue(originalContent)
			await fileWriter.open("existing-file.txt")

			await fileWriter.revertChanges()

			expect(fs.writeFile).toHaveBeenCalledWith(
				path.resolve(mockCwd, "existing-file.txt"),
				originalContent,
				"utf-8",
			)
		})
	})

	describe("scrollToFirstDiff", () => {
		it("should be a no-op for file-based editing", () => {
			expect(() => fileWriter.scrollToFirstDiff()).not.toThrow()
		})
	})

	describe("disableAutoFocusAfterUserInteraction", () => {
		it("should be a no-op for file-based editing", () => {
			expect(() => fileWriter.disableAutoFocusAfterUserInteraction()).not.toThrow()
		})
	})

	describe("reset", () => {
		it("should reset all state", async () => {
			vi.mocked(fs.readFile).mockResolvedValue("content")
			await fileWriter.open("test.txt")

			await fileWriter.reset()

			expect(fileWriter.editType).toBeUndefined()
			expect(fileWriter.isEditing).toBe(false)
			expect(fileWriter.originalContent).toBeUndefined()
		})
	})

	describe("resetWithListeners", () => {
		it("should call reset", async () => {
			const resetSpy = vi.spyOn(fileWriter, "reset")

			fileWriter.resetWithListeners()

			expect(resetSpy).toHaveBeenCalled()
		})
	})
})
