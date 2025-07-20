import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"

import { EditingProviderFactory } from "../EditingProviderFactory"
import { DiffViewProvider } from "../DiffViewProvider"
import { FileWriter } from "../FileWriter"

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
			const provider = EditingProviderFactory.createEditingProvider(mockCwd, { fileBasedEditing: true })

			expect(FileWriter).toHaveBeenCalledWith(mockCwd)
			expect(DiffViewProvider).not.toHaveBeenCalled()
		})

		it("should create DiffViewProvider when fileBasedEditing is disabled", () => {
			const provider = EditingProviderFactory.createEditingProvider(mockCwd, { fileBasedEditing: false })

			expect(DiffViewProvider).toHaveBeenCalledWith(mockCwd)
			expect(FileWriter).not.toHaveBeenCalled()
		})

		it("should create DiffViewProvider when fileBasedEditing is undefined", () => {
			const provider = EditingProviderFactory.createEditingProvider(mockCwd)

			expect(DiffViewProvider).toHaveBeenCalledWith(mockCwd)
			expect(FileWriter).not.toHaveBeenCalled()
		})
	})
})
