// npx jest src/core/ignore/__tests__/SeawolfIgnoreController.test.ts

import { SeawolfIgnoreController, LOCK_TEXT_SYMBOL } from "../SeawolfIgnoreController"
import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { fileExistsAtPath } from "../../../utils/fs"

// Mock dependencies
jest.mock("fs/promises")
jest.mock("../../../utils/fs")

// Mock vscode
jest.mock("vscode", () => {
	const mockDisposable = { dispose: jest.fn() }
	const mockEventEmitter = {
		event: jest.fn(),
		fire: jest.fn(),
	}

	return {
		workspace: {
			createFileSystemWatcher: jest.fn(() => ({
				onDidCreate: jest.fn(() => mockDisposable),
				onDidChange: jest.fn(() => mockDisposable),
				onDidDelete: jest.fn(() => mockDisposable),
				dispose: jest.fn(),
			})),
		},
		RelativePattern: jest.fn().mockImplementation((base, pattern) => ({
			base,
			pattern,
		})),
		EventEmitter: jest.fn().mockImplementation(() => mockEventEmitter),
		Disposable: {
			from: jest.fn(),
		},
	}
})

describe("SeawolfIgnoreController", () => {
	const TEST_CWD = "/test/path"
	let controller: SeawolfIgnoreController
	let mockFileExists: jest.MockedFunction<typeof fileExistsAtPath>
	let mockReadFile: jest.MockedFunction<typeof fs.readFile>
	let mockWatcher: any

	beforeEach(() => {
		// Reset mocks
		jest.clearAllMocks()

		// Setup mock file watcher
		mockWatcher = {
			onDidCreate: jest.fn().mockReturnValue({ dispose: jest.fn() }),
			onDidChange: jest.fn().mockReturnValue({ dispose: jest.fn() }),
			onDidDelete: jest.fn().mockReturnValue({ dispose: jest.fn() }),
			dispose: jest.fn(),
		}

		// @ts-expect-error - Mocking
		vscode.workspace.createFileSystemWatcher.mockReturnValue(mockWatcher)

		// Setup fs mocks
		mockFileExists = fileExistsAtPath as jest.MockedFunction<typeof fileExistsAtPath>
		mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>

		// Create controller
		controller = new SeawolfIgnoreController(TEST_CWD)
	})

	describe("initialization", () => {
		/**
		 * Tests the controller initialization when .seawolfignore exists
		 */
		it("should load .seawolfignore patterns on initialization when file exists", async () => {
			// Setup mocks to simulate existing .seawolfignore file
			mockFileExists.mockResolvedValue(true)
			mockReadFile.mockResolvedValue("node_modules\n.git\nsecrets.json")

			// Initialize controller
			await controller.initialize()

			// Verify file was checked and read
			expect(mockFileExists).toHaveBeenCalledWith(path.join(TEST_CWD, ".seawolfignore"))
			expect(mockReadFile).toHaveBeenCalledWith(path.join(TEST_CWD, ".seawolfignore"), "utf8")

			// Verify content was stored
			expect(controller.seawolfIgnoreContent).toBe("node_modules\n.git\nsecrets.json")

			// Test that ignore patterns were applied
			expect(controller.validateAccess("node_modules/package.json")).toBe(false)
			expect(controller.validateAccess("src/app.ts")).toBe(true)
			expect(controller.validateAccess(".git/config")).toBe(false)
			expect(controller.validateAccess("secrets.json")).toBe(false)
		})

		/**
		 * Tests the controller behavior when .seawolfignore doesn't exist
		 */
		it("should allow all access when .seawolfignore doesn't exist", async () => {
			// Setup mocks to simulate missing .seawolfignore file
			mockFileExists.mockResolvedValue(false)

			// Initialize controller
			await controller.initialize()

			// Verify no content was stored
			expect(controller.seawolfIgnoreContent).toBeUndefined()

			// All files should be accessible
			expect(controller.validateAccess("node_modules/package.json")).toBe(true)
			expect(controller.validateAccess("secrets.json")).toBe(true)
		})

		/**
		 * Tests the file watcher setup
		 */
		it("should set up file watcher for .seawolfignore changes", async () => {
			// Check that watcher was created with correct pattern
			expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith(
				expect.objectContaining({
					base: TEST_CWD,
					pattern: ".seawolfignore",
				}),
			)

			// Verify event handlers were registered
			expect(mockWatcher.onDidCreate).toHaveBeenCalled()
			expect(mockWatcher.onDidChange).toHaveBeenCalled()
			expect(mockWatcher.onDidDelete).toHaveBeenCalled()
		})

		/**
		 * Tests error handling during initialization
		 */
		it("should handle errors when loading .seawolfignore", async () => {
			// Setup mocks to simulate error
			mockFileExists.mockResolvedValue(true)
			mockReadFile.mockRejectedValue(new Error("Test file read error"))

			// Spy on console.error
			const consoleSpy = jest.spyOn(console, "error").mockImplementation()

			// Initialize controller - shouldn't throw
			await controller.initialize()

			// Verify error was logged
			expect(consoleSpy).toHaveBeenCalledWith("Unexpected error loading .seawolfignore:", expect.any(Error))

			// Cleanup
			consoleSpy.mockRestore()
		})
	})
})
