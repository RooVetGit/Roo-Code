// npx vitest core/ignore/__tests__/RooIgnoreController.gitignore.spec.ts

import type { Mock } from "vitest"
import { RooIgnoreController } from "../RooIgnoreController"
import * as path from "path"
import * as fs from "fs/promises"
import { fileExistsAtPath } from "../../../utils/fs"
import { GITIGNORE_WHITELIST } from "../../../services/glob/constants"

// Mock dependencies
vi.mock("fs/promises")
vi.mock("../../../utils/fs")

// Mock vscode
vi.mock("vscode", () => {
	const mockDisposable = { dispose: vi.fn() }
	const mockEventEmitter = {
		event: vi.fn(),
		fire: vi.fn(),
	}

	return {
		workspace: {
			createFileSystemWatcher: vi.fn(() => ({
				onDidCreate: vi.fn(() => mockDisposable),
				onDidChange: vi.fn(() => mockDisposable),
				onDidDelete: vi.fn(() => mockDisposable),
				dispose: vi.fn(),
			})),
		},
		RelativePattern: vi.fn().mockImplementation((base, pattern) => ({
			base,
			pattern,
		})),
		EventEmitter: vi.fn().mockImplementation(() => mockEventEmitter),
		Disposable: {
			from: vi.fn(),
		},
	}
})

describe("RooIgnoreController - Gitignore Support", () => {
	const TEST_CWD = "/test/path"
	let controller: RooIgnoreController
	let mockFileExists: Mock<typeof fileExistsAtPath>
	let mockReadFile: Mock<typeof fs.readFile>

	beforeEach(() => {
		// Reset mocks
		vi.clearAllMocks()

		// Setup fs mocks
		mockFileExists = fileExistsAtPath as Mock<typeof fileExistsAtPath>
		mockReadFile = fs.readFile as Mock<typeof fs.readFile>

		// Create controller
		controller = new RooIgnoreController(TEST_CWD)
	})

	describe("loadGitignore", () => {
		it("should load .gitignore patterns on initialization when file exists", async () => {
			// Setup mocks to simulate existing .gitignore file
			mockFileExists.mockImplementation(async (filePath) => {
				const pathStr = filePath.toString()
				if (pathStr.endsWith(".gitignore")) return true
				return false
			})
			mockReadFile.mockResolvedValue("node_modules/\n*.log\nbuild/")

			// Initialize controller
			await controller.initialize()

			// Verify gitignore was loaded
			expect(mockFileExists).toHaveBeenCalledWith(path.join(TEST_CWD, ".gitignore"))
			expect(mockReadFile).toHaveBeenCalledWith(path.join(TEST_CWD, ".gitignore"), "utf8")

			// Test that gitignore patterns are applied
			expect(controller.isGitignored("node_modules/package.json")).toBe(true)
			expect(controller.isGitignored("app.log")).toBe(true)
			expect(controller.isGitignored("build/output.js")).toBe(true)
			expect(controller.isGitignored("src/app.ts")).toBe(false)
		})

		it("should handle missing .gitignore gracefully", async () => {
			// Setup mocks to simulate missing .gitignore file
			mockFileExists.mockResolvedValue(false)

			// Initialize controller
			await controller.initialize()

			// Verify no gitignore patterns are applied
			expect(controller.isGitignored("node_modules/package.json")).toBe(false)
			expect(controller.isGitignored("build/output.js")).toBe(false)
		})

		it("should handle errors when loading .gitignore", async () => {
			// Setup mocks to simulate error
			mockFileExists.mockImplementation(async (filePath) => {
				const pathStr = filePath.toString()
				if (pathStr.endsWith(".gitignore")) return true
				return false
			})
			mockReadFile.mockRejectedValue(new Error("Test file read error"))

			// Spy on console.error
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Initialize controller - shouldn't throw
			await controller.initialize()

			// Verify error was logged
			expect(consoleSpy).toHaveBeenCalledWith("Error loading .gitignore:", expect.any(Error))

			// Cleanup
			consoleSpy.mockRestore()
		})
	})

	describe("isWhitelisted", () => {
		beforeEach(async () => {
			await controller.initialize()
		})

		it("should correctly identify whitelisted paths", () => {
			// Test exact matches
			expect(controller.isWhitelisted(".roo/temp/file.txt")).toBe(true)
			expect(controller.isWhitelisted(".roo/temp/")).toBe(true)
			expect(controller.isWhitelisted(".roo/temp")).toBe(true)

			// Test subdirectories
			expect(controller.isWhitelisted(".roo/temp/subdir/file.txt")).toBe(true)
			expect(controller.isWhitelisted(".roo/temp/deep/nested/path/file.txt")).toBe(true)

			// Test non-whitelisted paths
			expect(controller.isWhitelisted(".roo/other/file.txt")).toBe(false)
			expect(controller.isWhitelisted("src/.roo/temp/file.txt")).toBe(false)
			expect(controller.isWhitelisted("temp/file.txt")).toBe(false)
		})

		it("should handle absolute paths correctly", () => {
			const absolutePath = path.join(TEST_CWD, ".roo/temp/file.txt")
			expect(controller.isWhitelisted(absolutePath)).toBe(true)

			const nonWhitelistedAbsolute = path.join(TEST_CWD, "node_modules/file.txt")
			expect(controller.isWhitelisted(nonWhitelistedAbsolute)).toBe(false)
		})

		it("should handle path normalization", () => {
			// Test with different path separators and formats
			expect(controller.isWhitelisted(".roo\\temp\\file.txt")).toBe(true)
			expect(controller.isWhitelisted("./.roo/temp/file.txt")).toBe(true)
			expect(controller.isWhitelisted(".roo/./temp/file.txt")).toBe(true)
		})
	})

	describe("isGitignored with whitelist", () => {
		beforeEach(async () => {
			// Setup both .gitignore and .rooignore
			mockFileExists.mockImplementation(async (filePath) => {
				const pathStr = filePath.toString()
				if (pathStr.endsWith(".gitignore")) return true
				if (pathStr.endsWith(".rooignore")) return true
				return false
			})
			mockReadFile.mockImplementation(async (filePath) => {
				const pathStr = filePath.toString()
				if (pathStr.endsWith(".gitignore")) {
					return ".roo/\nnode_modules/\n*.log"
				}
				if (pathStr.endsWith(".rooignore")) {
					return "secrets/"
				}
				throw new Error("Unexpected file")
			})
			await controller.initialize()
		})

		it("should respect whitelist even if path is in .gitignore", () => {
			// .roo/temp/ is whitelisted even though .roo/ is in .gitignore
			expect(controller.isGitignored(".roo/temp/file.txt")).toBe(false)

			// .roo/other/ is NOT whitelisted, so it should be gitignored
			expect(controller.isGitignored(".roo/other/file.txt")).toBe(true)

			// Other gitignored paths should still be ignored
			expect(controller.isGitignored("node_modules/package.json")).toBe(true)
			expect(controller.isGitignored("app.log")).toBe(true)
		})

		it("should handle nested whitelisted paths in gitignored directories", () => {
			// Even though .roo/ is gitignored, .roo/temp/ is whitelisted
			expect(controller.isGitignored(".roo/temp/nested/deep/file.txt")).toBe(false)
			expect(controller.isGitignored(".roo/temp/")).toBe(false)
		})

		it("should return false for non-gitignored paths", () => {
			expect(controller.isGitignored("src/app.ts")).toBe(false)
			expect(controller.isGitignored("README.md")).toBe(false)
		})
	})

	describe("integration with validateAccess", () => {
		beforeEach(async () => {
			// Setup both .gitignore and .rooignore
			mockFileExists.mockImplementation(async (filePath) => {
				const pathStr = filePath.toString()
				if (pathStr.endsWith(".gitignore")) return true
				if (pathStr.endsWith(".rooignore")) return true
				return false
			})
			mockReadFile.mockImplementation(async (filePath) => {
				const pathStr = filePath.toString()
				if (pathStr.endsWith(".gitignore")) {
					return ".roo/\nnode_modules/"
				}
				if (pathStr.endsWith(".rooignore")) {
					return "secrets/"
				}
				throw new Error("Unexpected file")
			})
			await controller.initialize()
		})

		it("should allow access to whitelisted paths even if gitignored", () => {
			// Whitelisted paths should be accessible
			expect(controller.validateAccess(".roo/temp/file.txt")).toBe(true)
			expect(controller.validateAccess(".roo/temp/subdir/data.json")).toBe(true)

			// Rooignored paths should be blocked
			expect(controller.validateAccess("secrets/api-key.txt")).toBe(false)

			// Regular paths should be accessible
			expect(controller.validateAccess("src/app.ts")).toBe(true)
		})
	})

	describe("whitelist constants", () => {
		it("should have the correct whitelist entries", () => {
			// Verify the whitelist contains expected entries
			expect(GITIGNORE_WHITELIST).toContain(".roo/temp")
			expect(GITIGNORE_WHITELIST).toBeInstanceOf(Array)
			expect(GITIGNORE_WHITELIST.length).toBeGreaterThan(0)
		})
	})
})
