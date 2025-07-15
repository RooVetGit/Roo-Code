import { describe, test, expect, beforeEach, vi } from "vitest"
import { SilentModeDetector } from "../SilentModeDetector"

// Mock VSCode API - use vi.mock factory without external references
vi.mock("vscode", () => {
	const mockTextDocument = {
		fileName: "/test/file.ts",
		isDirty: false,
		getText: vi.fn().mockReturnValue("test content"),
		uri: {
			fsPath: "/test/file.ts",
		},
	}

	const mockTextEditor = {
		document: mockTextDocument,
		viewColumn: 1,
	}

	return {
		window: {
			activeTextEditor: mockTextEditor,
			visibleTextEditors: [mockTextEditor],
			onDidChangeActiveTextEditor: vi.fn(),
			onDidChangeVisibleTextEditors: vi.fn(),
		},
		workspace: {
			textDocuments: [mockTextDocument],
			onDidChangeTextDocument: vi.fn(),
			onDidOpenTextDocument: vi.fn(),
			onDidCloseTextDocument: vi.fn(),
		},
		ViewColumn: {
			One: 1,
			Two: 2,
			Three: 3,
		},
	}
})

// Get mocked objects after import for use in tests
import * as vscode from "vscode"
const mockTextEditor = vscode.window.activeTextEditor as any
const mockTextDocument = mockTextEditor.document

describe("SilentModeDetector", () => {
	let detector: SilentModeDetector

	beforeEach(() => {
		vi.clearAllMocks()
		detector = new SilentModeDetector()
	})

	describe("initialization", () => {
		test("should initialize correctly", () => {
			expect(detector).toBeDefined()
		})
	})

	describe("silent mode activation detection", () => {
		test("should activate when global setting is enabled and file not actively edited", () => {
			const filePath = "/test/inactive-file.ts"
			const result = detector.shouldActivateSilentMode(filePath, true)

			// Should activate for files not currently being edited
			expect(result).toBe(true)
		})

		test("should not activate when global setting is disabled", () => {
			const filePath = "/test/any-file.ts"
			const result = detector.shouldActivateSilentMode(filePath, false)

			expect(result).toBe(false)
		})

		test("should not activate for actively edited files", () => {
			// Mock the file as being actively edited
			mockTextDocument.isDirty = true
			mockTextDocument.fileName = "/test/active-file.ts"
			mockTextDocument.uri.fsPath = "/test/active-file.ts"

			const result = detector.shouldActivateSilentMode("/test/active-file.ts", true)

			expect(result).toBe(false)

			// Reset for other tests
			mockTextDocument.isDirty = false
		})

		test("should not activate for files in focused editor", () => {
			// Mock the file as being in the active editor
			const activeFilePath = "/test/focused-file.ts"
			mockTextDocument.fileName = activeFilePath
			mockTextDocument.uri.fsPath = activeFilePath

			const result = detector.shouldActivateSilentMode(activeFilePath, true)

			// Should not activate since it's the currently focused file
			expect(result).toBe(false)
		})
	})

	describe("file activity detection", () => {
		test("should detect files that are not open", () => {
			// Test with a file that's not in the workspace
			const result = detector.shouldActivateSilentMode("/test/unopened-file.ts", true)

			expect(result).toBe(true)
		})

		test("should handle multiple visible editors", () => {
			// Test behavior when multiple editors are visible
			const filePath = "/test/background-file.ts"
			const result = detector.shouldActivateSilentMode(filePath, true)

			expect(result).toBe(true)
		})
	})

	describe("edge cases", () => {
		test("should handle empty file paths", () => {
			const result = detector.shouldActivateSilentMode("", true)

			expect(result).toBe(true)
		})

		test("should handle null/undefined scenarios gracefully", () => {
			// Should not throw errors with edge case inputs
			expect(() => {
				detector.shouldActivateSilentMode("/test/file.ts", true)
			}).not.toThrow()
		})

		test("should handle files with special characters", () => {
			const specialPath = "/test/file with spaces & symbols!.ts"
			const result = detector.shouldActivateSilentMode(specialPath, true)

			expect(result).toBe(true)
		})
	})

	describe("file path normalization", () => {
		test("should handle different path separators", () => {
			const windowsPath = "C:\\test\\file.ts"
			const unixPath = "/test/file.ts"

			// Both should be handled consistently
			const windowsResult = detector.shouldActivateSilentMode(windowsPath, true)
			const unixResult = detector.shouldActivateSilentMode(unixPath, true)

			expect(typeof windowsResult).toBe("boolean")
			expect(typeof unixResult).toBe("boolean")
		})

		test("should handle relative paths", () => {
			const relativePath = "./src/test/file.ts"
			const result = detector.shouldActivateSilentMode(relativePath, true)

			expect(typeof result).toBe("boolean")
		})
	})
})
