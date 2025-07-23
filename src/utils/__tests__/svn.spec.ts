import { describe, it, expect, vi, beforeEach } from "vitest"
import { promises as fs } from "fs"
import { exec } from "child_process"
import { promisify } from "util"
import * as path from "path"

// Use vi.hoisted to ensure the mock is available at the right time
const { mockExecAsync } = vi.hoisted(() => ({
	mockExecAsync: vi.fn(),
}))

// Mock modules before importing the functions
vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [
			{
				uri: {
					fsPath: "/test/workspace",
				},
			},
		],
	},
	window: {
		createOutputChannel: vi.fn(() => ({
			appendLine: vi.fn(),
			show: vi.fn(),
		})),
		showErrorMessage: vi.fn(),
		showWarningMessage: vi.fn(),
		showInformationMessage: vi.fn(),
	},
	env: {
		openExternal: vi.fn(),
	},
	Uri: {
		parse: vi.fn(),
	},
}))

vi.mock("fs", () => ({
	promises: {
		access: vi.fn(),
	},
}))

vi.mock("child_process", () => ({
	exec: vi.fn(),
}))

vi.mock("util", () => ({
	promisify: vi.fn(() => mockExecAsync),
}))

// Import functions after mocking
import {
	checkSvnInstalled,
	checkSvnRepo,
	getSvnRepositoryInfo,
	extractSvnRepositoryName,
	searchSvnCommits,
	getSvnCommitInfoForMentions,
	getWorkspaceSvnInfo,
} from "../svn"

describe("SVN Utilities", () => {
	let mockFsAccess: any

	beforeEach(() => {
		vi.clearAllMocks()

		// Setup fs.access mock
		mockFsAccess = vi.mocked(fs.access)
	})

	describe("checkSvnInstalled", () => {
		it("should return true when SVN is installed", async () => {
			mockExecAsync.mockResolvedValue({ stdout: "svn, version 1.14.0\n", stderr: "" })

			const result = await checkSvnInstalled()
			expect(result).toBe(true)
			expect(mockExecAsync).toHaveBeenCalledWith("svn --version")
		})

		it("should return false when SVN is not installed", async () => {
			mockExecAsync.mockRejectedValue(new Error("Command not found"))

			const result = await checkSvnInstalled()
			expect(result).toBe(false)
		})
	})

	describe("checkSvnRepo", () => {
		it("should return true for valid SVN repository", async () => {
			mockFsAccess.mockResolvedValue(undefined)

			const result = await checkSvnRepo("/test/workspace")
			expect(result).toBe(true)
			// Use path.join to handle platform-specific path separators
			expect(mockFsAccess).toHaveBeenCalledWith(path.join("/test/workspace", ".svn"))
		})

		it("should return false for non-SVN directory", async () => {
			mockFsAccess.mockRejectedValue(new Error("ENOENT"))

			const result = await checkSvnRepo("/test/workspace")
			expect(result).toBe(false)
		})
	})

	describe("getSvnRepositoryInfo", () => {
		it("should return repository info for valid SVN workspace", async () => {
			mockFsAccess.mockResolvedValue(undefined)
			mockExecAsync.mockResolvedValue({
				stdout: `URL: https://svn.example.com/myproject/trunk
Working Copy Root Path: /test/workspace`,
				stderr: "",
			})

			const result = await getSvnRepositoryInfo("/test/workspace")
			expect(result.repositoryUrl).toBe("https://svn.example.com/myproject/trunk")
			expect(result.repositoryName).toBe("myproject")
			expect(result.workingCopyRoot).toBe("/test/workspace")
		})

		it("should return empty object for non-SVN directory", async () => {
			mockFsAccess.mockRejectedValue(new Error("ENOENT"))

			const result = await getSvnRepositoryInfo("/test/workspace")
			expect(result).toEqual({})
		})

		it("should handle SVN command failure gracefully", async () => {
			mockFsAccess.mockResolvedValue(undefined)
			mockExecAsync.mockRejectedValue(new Error("SVN command failed"))

			const result = await getSvnRepositoryInfo("/test/workspace")
			expect(result).toEqual({})
		})
	})

	describe("extractSvnRepositoryName", () => {
		it("should extract repository name from trunk URL", () => {
			const result = extractSvnRepositoryName("https://svn.example.com/myproject/trunk")
			expect(result).toBe("myproject")
		})

		it("should extract repository name from branches URL", () => {
			const result = extractSvnRepositoryName("https://svn.example.com/myproject/branches/feature")
			expect(result).toBe("myproject")
		})

		it("should extract repository name from tags URL", () => {
			const result = extractSvnRepositoryName("https://svn.example.com/myproject/tags/v1.0")
			expect(result).toBe("myproject")
		})

		it("should extract repository name from simple URL", () => {
			const result = extractSvnRepositoryName("https://svn.example.com/myproject")
			expect(result).toBe("myproject")
		})

		it("should handle invalid URLs gracefully", () => {
			const result = extractSvnRepositoryName("")
			expect(result).toBe("")
		})
	})

	describe("searchSvnCommits", () => {
		it("should return commits matching search query", async () => {
			// Mock checkSvnInstalled to return true
			mockExecAsync.mockResolvedValueOnce({ stdout: "svn, version 1.14.0\n", stderr: "" }).mockResolvedValueOnce({
				stdout: `<?xml version="1.0" encoding="UTF-8"?>
<log>
<logentry revision="123">
<author>john.doe</author>
<date>2023-01-15T10:30:00.000000Z</date>
<msg>Test commit message</msg>
</logentry>
</log>`,
				stderr: "",
			})

			// Mock checkSvnRepo to return true
			mockFsAccess.mockResolvedValue(undefined)

			const result = await searchSvnCommits("test", "/test/workspace")
			expect(result).toHaveLength(1)
			expect(result[0].revision).toBe("123")
			expect(result[0].author).toBe("john.doe")
			expect(result[0].message).toBe("Test commit message")
		})

		it("should return empty array when SVN is not available", async () => {
			mockExecAsync.mockRejectedValue(new Error("Command not found"))

			const result = await searchSvnCommits("test", "/test/workspace")
			expect(result).toEqual([])
		})
	})

	describe("getSvnCommitInfoForMentions", () => {
		it("should return commit info for valid revision", async () => {
			// Mock checkSvnInstalled and checkSvnRepo
			mockExecAsync.mockResolvedValueOnce({ stdout: "svn, version 1.14.0\n", stderr: "" }).mockResolvedValueOnce({
				stdout: `------------------------------------------------------------------------
r123 | john.doe | 2023-01-15 10:30:00 +0000 (Sun, 15 Jan 2023) | 1 line

Test commit message
------------------------------------------------------------------------`,
				stderr: "",
			})

			mockFsAccess.mockResolvedValue(undefined)

			const result = await getSvnCommitInfoForMentions("123", "/test/workspace")
			expect(result).toContain("r123")
			expect(result).toContain("john.doe")
			expect(result).toContain("Test commit message")
		})

		it("should return error message for invalid revision", async () => {
			// Mock checkSvnInstalled to fail
			mockExecAsync.mockRejectedValue(new Error("Command not found"))

			const result = await getSvnCommitInfoForMentions("invalid", "/test/workspace")
			expect(result).toBe("Error: SVN not available or not an SVN repository")
		})
	})

	describe("getWorkspaceSvnInfo", () => {
		it("should return SVN info for workspace", async () => {
			// Mock fs.access to simulate .svn directory exists
			mockFsAccess.mockResolvedValue(undefined)

			// Mock execAsync for svn info command
			mockExecAsync.mockResolvedValue({
				stdout: `URL: https://svn.example.com/workspace/trunk
Working Copy Root Path: /test/workspace`,
				stderr: "",
			})

			const result = await getWorkspaceSvnInfo()
			expect(result.repositoryUrl).toBe("https://svn.example.com/workspace/trunk")
			expect(result.repositoryName).toBe("workspace")
			expect(result.workingCopyRoot).toBe("/test/workspace")
		})

		it("should return empty object when no workspace folders", async () => {
			// Mock vscode workspace with no folders
			const vscode = await import("vscode")
			const mockWorkspace = vi.mocked(vscode.workspace)

			// Use Object.defineProperty to mock the readonly property
			Object.defineProperty(mockWorkspace, "workspaceFolders", {
				value: undefined,
				writable: true,
				configurable: true,
			})

			const result = await getWorkspaceSvnInfo()
			expect(result).toEqual({})

			// Restore the original value for other tests
			Object.defineProperty(mockWorkspace, "workspaceFolders", {
				value: [
					{
						uri: {
							fsPath: "/test/workspace",
						},
					},
				],
				writable: true,
				configurable: true,
			})
		})
	})
})
