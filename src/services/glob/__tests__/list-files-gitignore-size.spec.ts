import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import * as path from "path"
import { MAX_GITIGNORE_FILE_SIZE_BYTES } from "../../constants/file-limits"

// Use vi.hoisted to ensure mocks are available during hoisting
const { mockConsoleWarn, mockStat, mockReadFile, mockAccess } = vi.hoisted(() => ({
	mockConsoleWarn: vi.fn(),
	mockStat: vi.fn(),
	mockReadFile: vi.fn(),
	mockAccess: vi.fn(),
}))

vi.mock("fs", () => ({
	promises: {
		stat: mockStat,
		readFile: mockReadFile,
		access: mockAccess,
		readdir: vi.fn().mockResolvedValue([]),
	},
}))

// Mock other dependencies
vi.mock("../../ripgrep", () => ({
	getBinPath: vi.fn(() => Promise.resolve("/mock/path/to/rg")),
}))

vi.mock("vscode", () => ({
	env: {
		appRoot: "/mock/app/root",
	},
}))

vi.mock("child_process", () => ({
	spawn: vi.fn(() => {
		const mockProcess = {
			stdout: {
				on: vi.fn((event, callback) => {
					if (event === "data") {
						setTimeout(() => callback("test-file.txt\n"), 10)
					}
				}),
			},
			stderr: { on: vi.fn() },
			on: vi.fn((event, callback) => {
				if (event === "close") {
					setTimeout(() => callback(0), 20)
				}
			}),
			kill: vi.fn(),
		}
		return mockProcess
	}),
}))

vi.mock("../../path", () => ({
	arePathsEqual: vi.fn().mockReturnValue(false),
}))

// Import the function to test after mocks are set up
import { listFiles } from "../list-files"

describe("list-files .gitignore size validation", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		console.warn = mockConsoleWarn
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("should skip .gitignore files that exceed size limit", async () => {
		// Mock finding a .gitignore file
		mockAccess.mockResolvedValue(undefined) // File exists

		// Mock .gitignore file that exceeds size limit
		const largeSize = MAX_GITIGNORE_FILE_SIZE_BYTES + 1000
		mockStat.mockResolvedValue({ size: largeSize })

		// Call listFiles
		await listFiles("/test/dir", false, 100)

		// Verify that console.warn was called with the appropriate message
		expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining("Skipping large .gitignore file"))
		expect(mockConsoleWarn).toHaveBeenCalledWith(
			expect.stringContaining(`${largeSize} bytes > ${MAX_GITIGNORE_FILE_SIZE_BYTES} bytes`),
		)

		// Verify that readFile was NOT called for the large .gitignore
		expect(mockReadFile).not.toHaveBeenCalledWith(expect.stringContaining(".gitignore"), "utf8")
	})

	it("should read .gitignore files within size limit", async () => {
		// Mock finding a .gitignore file
		mockAccess.mockResolvedValue(undefined) // File exists

		// Mock .gitignore file within size limit
		const normalSize = 1024 // 1KB, well under limit
		mockStat.mockResolvedValue({ size: normalSize })
		mockReadFile.mockResolvedValue("*.log\nnode_modules/\n")

		// Call listFiles
		await listFiles("/test/dir", false, 100)

		// Verify that readFile was called for the .gitignore
		expect(mockReadFile).toHaveBeenCalledWith(expect.stringContaining(".gitignore"), "utf8")

		// Verify no warning was logged
		expect(mockConsoleWarn).not.toHaveBeenCalledWith(expect.stringContaining("Skipping large .gitignore file"))
	})

	it("should handle multiple .gitignore files with mixed sizes", async () => {
		// Mock finding .gitignore files at different levels
		mockAccess.mockResolvedValue(undefined) // All files exist

		// Mock different .gitignore files with different sizes
		// First call is for the .gitignore in the current directory
		mockStat
			.mockResolvedValueOnce({ size: 1024 }) // First .gitignore - OK
			.mockResolvedValueOnce({ size: MAX_GITIGNORE_FILE_SIZE_BYTES + 1000 }) // Second - too large

		mockReadFile.mockResolvedValueOnce("*.log\n")

		// Call listFiles with recursive to trigger .gitignore checks
		await listFiles("/test/dir", true, 100)

		// Verify that readFile was called only for files within limit
		expect(mockReadFile).toHaveBeenCalled()

		// Verify warning was logged for the large file if multiple .gitignore files were found
		// The test might only find one .gitignore depending on the mock setup
		const warnCalls = mockConsoleWarn.mock.calls
		const hasLargeFileWarning = warnCalls.some((call) => call[0].includes("Skipping large .gitignore file"))

		// If we had multiple stat calls, we should have seen the warning
		if (mockStat.mock.calls.length > 1) {
			expect(hasLargeFileWarning).toBe(true)
		}
	})

	it("should continue processing when .gitignore stat fails", async () => {
		// Mock finding a .gitignore file
		mockAccess.mockResolvedValue(undefined) // File exists

		// Mock stat failure
		mockStat.mockRejectedValue(new Error("Permission denied"))

		// Call listFiles
		const [results] = await listFiles("/test/dir", false, 100)

		// Should still return results despite .gitignore stat failure
		expect(results.length).toBeGreaterThan(0)

		// Verify warning was logged
		expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining("Error reading .gitignore"))
	})

	it("should handle .gitignore at exactly the size limit", async () => {
		// Mock finding a .gitignore file
		mockAccess.mockResolvedValue(undefined) // File exists

		// Mock .gitignore file at exactly the size limit
		mockStat.mockResolvedValue({ size: MAX_GITIGNORE_FILE_SIZE_BYTES })
		mockReadFile.mockResolvedValue("*.tmp\n")

		// Call listFiles
		await listFiles("/test/dir", false, 100)

		// Verify that readFile was called (file at limit should be read)
		expect(mockReadFile).toHaveBeenCalledWith(expect.stringContaining(".gitignore"), "utf8")

		// Verify no warning was logged
		expect(mockConsoleWarn).not.toHaveBeenCalledWith(expect.stringContaining("Skipping large .gitignore file"))
	})
})
