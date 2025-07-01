import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import * as vscode from "vscode"

import { EditingProviderFactory } from "../EditingProviderFactory"
import { DiffViewProvider } from "../DiffViewProvider"
import { FileWriter } from "../FileWriter"

// Mock VSCode API
const mockGet = vi.fn()
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(() => ({
			get: mockGet,
		})),
	},
}))

// Mock the providers
vi.mock("../DiffViewProvider", () => ({
	DiffViewProvider: vi.fn(),
}))

vi.mock("../FileWriter", () => ({
	FileWriter: vi.fn(),
}))

describe("EditingProviderFactory", () => {
	const mockCwd = "/test/cwd"

	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("createEditingProvider", () => {
		it("should create FileWriter when fileBasedEditing is enabled", () => {
			mockGet.mockReturnValue(true)

			const provider = EditingProviderFactory.createEditingProvider(mockCwd)

			expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith("roo-cline")
			expect(mockGet).toHaveBeenCalledWith("fileBasedEditing", false)
			expect(FileWriter).toHaveBeenCalledWith(mockCwd)
			expect(DiffViewProvider).not.toHaveBeenCalled()
		})

		it("should create DiffViewProvider when fileBasedEditing is disabled", () => {
			mockGet.mockReturnValue(false)

			const provider = EditingProviderFactory.createEditingProvider(mockCwd)

			expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith("roo-cline")
			expect(mockGet).toHaveBeenCalledWith("fileBasedEditing", false)
			expect(DiffViewProvider).toHaveBeenCalledWith(mockCwd)
			expect(FileWriter).not.toHaveBeenCalled()
		})

		it("should create DiffViewProvider when fileBasedEditing is undefined", () => {
			mockGet.mockReturnValue(undefined)

			const provider = EditingProviderFactory.createEditingProvider(mockCwd)

			expect(DiffViewProvider).toHaveBeenCalledWith(mockCwd)
			expect(FileWriter).not.toHaveBeenCalled()
		})
	})

	describe("isFileBasedEditingEnabled", () => {
		it("should return true when fileBasedEditing is enabled", () => {
			mockGet.mockReturnValue(true)

			const result = EditingProviderFactory.isFileBasedEditingEnabled()

			expect(result).toBe(true)
			expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith("roo-cline")
			expect(mockGet).toHaveBeenCalledWith("fileBasedEditing", false)
		})

		it("should return false when fileBasedEditing is disabled", () => {
			mockGet.mockReturnValue(false)

			const result = EditingProviderFactory.isFileBasedEditingEnabled()

			expect(result).toBe(false)
		})

		it("should return false when fileBasedEditing is undefined", () => {
			mockGet.mockReturnValue(undefined)

			const result = EditingProviderFactory.isFileBasedEditingEnabled()

			expect(result).toBe(false)
		})
	})
})
