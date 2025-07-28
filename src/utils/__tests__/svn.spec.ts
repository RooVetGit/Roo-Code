import { describe, it, expect, vi, beforeEach } from "vitest"
import { promises as fs } from "fs"
import { exec } from "child_process"
import { promisify } from "util"
import * as path from "path"
import * as os from "os"

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
		showErrorMessage: vi.fn(() => Promise.resolve()),
		showWarningMessage: vi.fn(() => Promise.resolve()),
		showInformationMessage: vi.fn(() => Promise.resolve()),
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

		it("should search for specific revision when query is in 'r123' format", async () => {
			// Mock checkSvnInstalled to return true
			mockExecAsync.mockResolvedValueOnce({ stdout: "svn, version 1.14.0\n", stderr: "" }).mockResolvedValueOnce({
				stdout: `<?xml version="1.0" encoding="UTF-8"?>
<log>
<logentry revision="456">
<author>jane.smith</author>
<date>2023-02-15T14:30:00.000000Z</date>
<msg>Specific revision commit</msg>
</logentry>
</log>`,
				stderr: "",
			})

			// Mock checkSvnRepo to return true
			mockFsAccess.mockResolvedValue(undefined)

			const result = await searchSvnCommits("r456", "/test/workspace")
			expect(result).toHaveLength(1)
			expect(result[0].revision).toBe("456")
			expect(result[0].author).toBe("jane.smith")
			expect(result[0].message).toBe("Specific revision commit")
		})

		it("should handle case-insensitive 'r' prefix in revision search", async () => {
			// Mock checkSvnInstalled to return true
			mockExecAsync.mockResolvedValueOnce({ stdout: "svn, version 1.14.0\n", stderr: "" }).mockResolvedValueOnce({
				stdout: `<?xml version="1.0" encoding="UTF-8"?>
<log>
<logentry revision="789">
<author>test.user</author>
<date>2023-03-15T16:30:00.000000Z</date>
<msg>Case insensitive test</msg>
</logentry>
</log>`,
				stderr: "",
			})

			// Mock checkSvnRepo to return true
			mockFsAccess.mockResolvedValue(undefined)

			const result = await searchSvnCommits("R789", "/test/workspace")
			expect(result).toHaveLength(1)
			expect(result[0].revision).toBe("789")
		})

		it("should NOT treat pure numbers as revision searches", async () => {
			// Mock checkSvnInstalled to return true
			mockExecAsync.mockResolvedValueOnce({ stdout: "svn, version 1.14.0\n", stderr: "" }).mockResolvedValueOnce({
				stdout: `<?xml version="1.0" encoding="UTF-8"?>
<log>
<logentry revision="123">
<author>john.doe</author>
<date>2023-01-15T10:30:00.000000Z</date>
<msg>Message containing 456 number</msg>
</logentry>
<logentry revision="456">
<author>jane.smith</author>
<date>2023-02-15T14:30:00.000000Z</date>
<msg>Another commit</msg>
</logentry>
</log>`,
				stderr: "",
			})

			// Mock checkSvnRepo to return true
			mockFsAccess.mockResolvedValue(undefined)

			// Search for pure number "456" should search in message content, not as specific revision
			const result = await searchSvnCommits("456", "/test/workspace")
			// Should find the commit with "456" in the message, NOT the commit with revision 456
			expect(result).toHaveLength(1)
			expect(result[0].revision).toBe("123")
			expect(result[0].message).toContain("456")
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
Changed paths:
   M /test.txt

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

		it("should parse changed files information correctly", async () => {
			// Mock checkSvnInstalled and checkSvnRepo
			mockFsAccess.mockResolvedValue(undefined)
			mockExecAsync
				.mockResolvedValueOnce({ stdout: "svn, version 1.14.0\n", stderr: "" })
				.mockResolvedValueOnce({
					stdout: `------------------------------------------------------------------------
r456 | jane.smith | 2023-02-15 14:30:00 +0800 (Wed, 15 Feb 2023) | 2 lines
Changed paths:
   A /src/new-file.ts
   M /src/existing-file.ts
   D /src/old-file.ts

Added new feature
Fixed bug in existing functionality
------------------------------------------------------------------------`,
					stderr: "",
				})
				.mockResolvedValueOnce({
					stdout: `Index: src/new-file.ts
===================================================================
--- src/new-file.ts	(nonexistent)
+++ src/new-file.ts	(revision 456)
@@ -0,0 +1,3 @@
+export function newFunction() {
+  return 'Hello World';
+}`,
					stderr: "",
				})

			const result = await getSvnCommitInfoForMentions("456", "/test/workspace")

			// Should contain basic commit info
			expect(result).toContain("r456 by jane.smith")
			expect(result).toContain("Added new feature")
			expect(result).toContain("Fixed bug in existing functionality")

			// Should contain changed files section
			expect(result).toContain("Changed files:")
			expect(result).toContain("A /src/new-file.ts")
			expect(result).toContain("M /src/existing-file.ts")
			expect(result).toContain("D /src/old-file.ts")

			// Should contain diff section
			expect(result).toContain("Diff:")
			expect(result).toContain("export function newFunction()")
		})

		it("should handle date parsing with Chinese day names gracefully", async () => {
			// Mock checkSvnInstalled and checkSvnRepo
			mockFsAccess.mockResolvedValue(undefined)
			mockExecAsync
				.mockResolvedValueOnce({ stdout: "svn, version 1.14.0\n", stderr: "" })
				.mockResolvedValueOnce({
					stdout: `------------------------------------------------------------------------
r789 | chinese.user | 2023-03-15 16:30:00 +0800 (星期三, 15 三月 2023) | 1 line
Changed paths:
   M /中文文件.txt

测试中文提交信息
------------------------------------------------------------------------`,
					stderr: "",
				})
				.mockResolvedValueOnce({
					stdout: `Index: 中文文件.txt
===================================================================
--- 中文文件.txt	(revision 788)
+++ 中文文件.txt	(revision 789)
@@ -1 +1 @@
-旧内容
+新内容`,
					stderr: "",
				})

			const result = await getSvnCommitInfoForMentions("789", "/test/workspace")

			// Should contain commit info with extracted date
			expect(result).toContain("r789 by chinese.user")
			expect(result).toContain("2023-03-15 16:30:00 +0800")
			expect(result).toContain("测试中文提交信息")

			// Should handle Chinese file names and content
			expect(result).toContain("M /中文文件.txt")
			expect(result).toContain("新内容")
		})

		it("should handle commit message extraction from improved format", async () => {
			// Mock checkSvnInstalled and checkSvnRepo
			mockFsAccess.mockResolvedValue(undefined)
			mockExecAsync
				.mockResolvedValueOnce({ stdout: "svn, version 1.14.0\n", stderr: "" })
				.mockResolvedValueOnce({
					stdout: `------------------------------------------------------------------------
r100 | developer | 2023-01-01 12:00:00 +0000 (Sun, 01 Jan 2023) | 3 lines
Changed paths:
   M /src/component.ts

This is a multi-line commit message
with detailed explanation
and some additional notes
------------------------------------------------------------------------`,
					stderr: "",
				})
				.mockResolvedValueOnce({
					stdout: "",
					stderr: "",
				})

			const result = await getSvnCommitInfoForMentions("100", "/test/workspace")

			// Should extract multi-line commit message correctly
			expect(result).toContain("This is a multi-line commit message")
			expect(result).toContain("with detailed explanation")
			expect(result).toContain("and some additional notes")
		})

		it("should handle revision with 'r' prefix input", async () => {
			// Mock checkSvnInstalled and checkSvnRepo
			mockFsAccess.mockResolvedValue(undefined)
			mockExecAsync
				.mockResolvedValueOnce({ stdout: "svn, version 1.14.0\n", stderr: "" })
				.mockResolvedValueOnce({
					stdout: `------------------------------------------------------------------------
r555 | test.author | 2023-05-15 10:15:00 +0000 (Mon, 15 May 2023) | 1 line
Changed paths:
   M /test-file.txt

Test with r prefix input
------------------------------------------------------------------------`,
					stderr: "",
				})
				.mockResolvedValueOnce({
					stdout: "",
					stderr: "",
				})

			const result = await getSvnCommitInfoForMentions("r555", "/test/workspace")
			expect(result).toContain("r555 by test.author")
			expect(result).toContain("Test with r prefix input")
		})

		it("should return error message for invalid revision", async () => {
			// Mock checkSvnInstalled to fail
			mockExecAsync.mockRejectedValue(new Error("Command not found"))

			const result = await getSvnCommitInfoForMentions("invalid", "/test/workspace")
			expect(result).toBe("Error: SVN not available or not an SVN repository")
		})

		it("should handle diff output with UTF-8 encoding", async () => {
			// Mock checkSvnInstalled and checkSvnRepo to return true
			mockFsAccess.mockResolvedValue(undefined)

			// Create a buffer with UTF-8 encoded Chinese characters
			const utf8Buffer = Buffer.from("测试文件内容", "utf8")

			// Mock the svn log and diff commands
			mockExecAsync
				.mockResolvedValueOnce({ stdout: "svn, version 1.14.0\n", stderr: "" })
				.mockResolvedValueOnce({
					stdout: `------------------------------------------------------------------------
r123 | john.doe | 2023-01-15 10:30:00 +0000 (Sun, 15 Jan 2023) | 1 line
Changed paths:
   M /test.txt

Test commit message
------------------------------------------------------------------------`,
					stderr: "",
				})
				.mockResolvedValueOnce({ stdout: utf8Buffer, stderr: "" })

			const result = await getSvnCommitInfoForMentions("123", "/test/workspace")
			expect(result).toContain("r123")
			expect(result).toContain("john.doe")
			expect(result).toContain("Test commit message")
			expect(result).toContain("测试文件内容")
		})

		it("should handle diff output with problematic encoding", async () => {
			// Mock checkSvnInstalled and checkSvnRepo to return true
			mockFsAccess.mockResolvedValue(undefined)

			// Create a buffer with problematic encoding (contains replacement characters)
			const problematicBuffer = Buffer.from("Test file with � characters", "utf8")

			// Mock the svn log and diff commands
			mockExecAsync
				.mockResolvedValueOnce({ stdout: "svn, version 1.14.0\n", stderr: "" })
				.mockResolvedValueOnce({
					stdout: `------------------------------------------------------------------------
r123 | john.doe | 2023-01-15 10:30:00 +0000 (Sun, 15 Jan 2023) | 1 line
Changed paths:
   M /test.txt

Test commit message
------------------------------------------------------------------------`,
					stderr: "",
				})
				.mockResolvedValueOnce({ stdout: problematicBuffer, stderr: "" })

			const result = await getSvnCommitInfoForMentions("123", "/test/workspace")
			expect(result).toContain("r123")
			expect(result).toContain("john.doe")
			expect(result).toContain("Test commit message")
			// Should handle the problematic encoding gracefully
			expect(result).toContain("Test file with")
		})

		it("should handle string output from svn diff command", async () => {
			// Mock checkSvnInstalled and checkSvnRepo to return true
			mockFsAccess.mockResolvedValue(undefined)

			// Mock the svn log command with string output instead of Buffer
			mockExecAsync
				.mockResolvedValueOnce({ stdout: "svn, version 1.14.0\n", stderr: "" })
				.mockResolvedValueOnce({
					stdout: `------------------------------------------------------------------------
r123 | john.doe | 2023-01-15 10:30:00 +0000 (Sun, 15 Jan 2023) | 1 line
Changed paths:
   M /test.txt

Test commit message
------------------------------------------------------------------------`,
					stderr: "",
				})
				.mockResolvedValueOnce({
					stdout: "Index: test.txt\n===================================================================\n--- test.txt\t(revision 122)\n+++ test.txt\t(revision 123)\n@@ -1 +1 @@\n-old content\n+new content",
					stderr: "",
				})

			const result = await getSvnCommitInfoForMentions("123", "/test/workspace")
			expect(result).toContain("r123")
			expect(result).toContain("john.doe")
			expect(result).toContain("Test commit message")
			expect(result).toContain("new content")
		})

		it("should handle diff command failure gracefully", async () => {
			// Mock checkSvnInstalled and checkSvnRepo to return true
			mockFsAccess.mockResolvedValue(undefined)

			// Mock the svn log command to succeed but diff to fail
			mockExecAsync
				.mockResolvedValueOnce({ stdout: "svn, version 1.14.0\n", stderr: "" })
				.mockResolvedValueOnce({
					stdout: `------------------------------------------------------------------------
r123 | john.doe | 2023-01-15 10:30:00 +0000 (Sun, 15 Jan 2023) | 1 line
Changed paths:
   M /test.txt

Test commit message
------------------------------------------------------------------------`,
					stderr: "",
				})
				.mockRejectedValueOnce(new Error("svn: E160013: File not found"))

			const result = await getSvnCommitInfoForMentions("123", "/test/workspace")
			expect(result).toContain("r123")
			expect(result).toContain("john.doe")
			expect(result).toContain("Test commit message")
			// Should not contain diff section when diff fails
			expect(result).not.toContain("Diff:")
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
