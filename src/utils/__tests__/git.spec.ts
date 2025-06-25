// npx vitest utils/__tests__/git.spec.ts

// Use hoisted to ensure the mock is available during module loading
const mockExecAsync = vi.hoisted(() => vi.fn())

// Mock fs promises before any imports
vi.mock("fs", () => ({
	promises: {
		access: vi.fn(),
		readFile: vi.fn(),
	},
}))

// Mock child_process before any imports
vi.mock("child_process", () => ({
	exec: vi.fn(),
}))

// Mock util before any imports - return our hoisted mock
vi.mock("util", () => ({
	promisify: vi.fn(() => mockExecAsync),
}))

// Now import the modules we're testing
import { searchCommits, getCommitInfo, getWorkingState } from "../git"
import { promises as fs } from "fs"

describe("git utils", () => {
	const workspaceRoot = "/test/path"

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("searchCommits", () => {
		it("should return commits when git repo exists and has matching commits", async () => {
			// Mock .git directory exists
			vi.mocked(fs.access).mockResolvedValue(undefined)

			// Mock git log output
			const mockOutput =
				"abc123|John Doe|2024-01-06|fix: test commit\ndef456|Jane Smith|2024-01-05|feat: new feature"
			mockExecAsync.mockResolvedValue({ stdout: mockOutput, stderr: "" })

			const result = await searchCommits("test", workspaceRoot)

			expect(result).toHaveLength(2)
			expect(result[0]).toEqual({
				hash: "abc123",
				author: "John Doe",
				date: "2024-01-06",
				message: "fix: test commit",
			})
			expect(result[1]).toEqual({
				hash: "def456",
				author: "Jane Smith",
				date: "2024-01-05",
				message: "feat: new feature",
			})

			expect(mockExecAsync).toHaveBeenCalledWith(
				'git -C "/test/path" log --pretty=format:%H|%an|%ad|%s -n 20 --grep="test" -i',
			)
		})

		it("should return empty array when not in a git repository", async () => {
			// Mock .git directory doesn't exist
			vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"))

			const result = await searchCommits("test", workspaceRoot)
			expect(result).toEqual([])
			expect(mockExecAsync).not.toHaveBeenCalled()
		})

		it("should return empty array when git command fails", async () => {
			// Mock .git directory exists
			vi.mocked(fs.access).mockResolvedValue(undefined)

			// Mock git command failure
			mockExecAsync.mockRejectedValue(new Error("git command failed"))

			const result = await searchCommits("test", workspaceRoot)
			expect(result).toEqual([])
		})

		it("should handle empty git log output", async () => {
			// Mock .git directory exists
			vi.mocked(fs.access).mockResolvedValue(undefined)

			// Mock empty git log output
			mockExecAsync.mockResolvedValue({ stdout: "", stderr: "" })

			const result = await searchCommits("nonexistent", workspaceRoot)
			expect(result).toEqual([])
		})
	})

	describe("getCommitInfo", () => {
		it("should return formatted commit info when git repo exists", async () => {
			// Mock .git directory exists
			vi.mocked(fs.access).mockResolvedValue(undefined)

			// Mock git show output
			const mockOutput = "abc123def456 fix: test commit\n\nAuthor: John Doe\nDate: 2024-01-06"
			mockExecAsync.mockResolvedValue({ stdout: mockOutput, stderr: "" })

			const result = await getCommitInfo("abc123", workspaceRoot)
			expect(result).toBe(mockOutput)

			expect(mockExecAsync).toHaveBeenCalledWith(
				'git -C "/test/path" show --no-patch --format="%H %s%n%nAuthor: %an%nDate: %ad" abc123',
			)
		})

		it("should return empty string when not in a git repository", async () => {
			// Mock .git directory doesn't exist
			vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"))

			const result = await getCommitInfo("abc123", workspaceRoot)
			expect(result).toBe("")
			expect(mockExecAsync).not.toHaveBeenCalled()
		})

		it("should return empty string when git command fails", async () => {
			// Mock .git directory exists
			vi.mocked(fs.access).mockResolvedValue(undefined)

			// Mock git command failure
			mockExecAsync.mockRejectedValue(new Error("git command failed"))

			const result = await getCommitInfo("abc123", workspaceRoot)
			expect(result).toBe("")
		})
	})

	describe("getWorkingState", () => {
		it("should return hasChanges: true when there are uncommitted changes", async () => {
			// Mock .git directory exists
			vi.mocked(fs.access).mockResolvedValue(undefined)

			// Mock git status output with changes
			const mockOutput = " M src/file1.ts\n?? src/file2.ts"
			mockExecAsync.mockResolvedValue({ stdout: mockOutput, stderr: "" })

			const result = await getWorkingState(workspaceRoot)
			expect(result).toEqual({ hasChanges: true })

			expect(mockExecAsync).toHaveBeenCalledWith('git -C "/test/path" status --porcelain')
		})

		it("should return hasChanges: false when working directory is clean", async () => {
			// Mock .git directory exists
			vi.mocked(fs.access).mockResolvedValue(undefined)

			// Mock empty git status output
			mockExecAsync.mockResolvedValue({ stdout: "", stderr: "" })

			const result = await getWorkingState(workspaceRoot)
			expect(result).toEqual({ hasChanges: false })
		})

		it("should return hasChanges: false when not in a git repository", async () => {
			// Mock .git directory doesn't exist
			vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"))

			const result = await getWorkingState(workspaceRoot)
			expect(result).toEqual({ hasChanges: false })
			expect(mockExecAsync).not.toHaveBeenCalled()
		})

		it("should return hasChanges: false when git command fails", async () => {
			// Mock .git directory exists
			vi.mocked(fs.access).mockResolvedValue(undefined)

			// Mock git command failure
			mockExecAsync.mockRejectedValue(new Error("git command failed"))

			const result = await getWorkingState(workspaceRoot)
			expect(result).toEqual({ hasChanges: false })
		})
	})
})
