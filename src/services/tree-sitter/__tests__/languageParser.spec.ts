import type { MockedClass } from "vitest"

// Mock web-tree-sitter - must come before imports
const mockSetLanguage = vi.fn()
vi.mock("web-tree-sitter", () => {
	return {
		__esModule: true,
		default: vi.fn().mockImplementation(() => ({
			setLanguage: mockSetLanguage,
		})),
	}
})

import { loadRequiredLanguageParsers } from "../languageParser"
import Parser from "web-tree-sitter"

// Add static methods to Parser mock
const ParserMock = Parser as MockedClass<typeof Parser>
ParserMock.init = vi.fn().mockResolvedValue(undefined)
ParserMock.Language = {
	load: vi.fn().mockResolvedValue({
		query: vi.fn().mockReturnValue("mockQuery"),
	}),
	prototype: {}, // Add required prototype property
} as unknown as typeof Parser.Language

describe("Language Parser", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("loadRequiredLanguageParsers", () => {
		it("should initialize parser only once", async () => {
			const files = ["test.js", "test2.js"]
			await loadRequiredLanguageParsers(files)
			await loadRequiredLanguageParsers(files)

			expect(ParserMock.init).toHaveBeenCalledTimes(1)
		})

		it("should load JavaScript parser for .js and .jsx files", async () => {
			const files = ["test.js", "test.jsx"]
			const parsers = await loadRequiredLanguageParsers(files)

			expect(ParserMock.Language.load).toHaveBeenCalledWith(
				expect.stringContaining("tree-sitter-javascript.wasm"),
			)
			expect(parsers.js).toBeDefined()
			expect(parsers.jsx).toBeDefined()
			expect(parsers.js.query).toBeDefined()
			expect(parsers.jsx.query).toBeDefined()
		})

		it("should load TypeScript parser for .ts and .tsx files", async () => {
			const files = ["test.ts", "test.tsx"]
			const parsers = await loadRequiredLanguageParsers(files)

			expect(ParserMock.Language.load).toHaveBeenCalledWith(
				expect.stringContaining("tree-sitter-typescript.wasm"),
			)
			expect(ParserMock.Language.load).toHaveBeenCalledWith(expect.stringContaining("tree-sitter-tsx.wasm"))
			expect(parsers.ts).toBeDefined()
			expect(parsers.tsx).toBeDefined()
		})

		it("should load Python parser for .py files", async () => {
			const files = ["test.py"]
			const parsers = await loadRequiredLanguageParsers(files)

			expect(ParserMock.Language.load).toHaveBeenCalledWith(expect.stringContaining("tree-sitter-python.wasm"))
			expect(parsers.py).toBeDefined()
		})

		it("should load multiple language parsers as needed", async () => {
			const files = ["test.js", "test.py", "test.rs", "test.go"]
			const parsers = await loadRequiredLanguageParsers(files)

			expect(ParserMock.Language.load).toHaveBeenCalledTimes(4)
			expect(parsers.js).toBeDefined()
			expect(parsers.py).toBeDefined()
			expect(parsers.rs).toBeDefined()
			expect(parsers.go).toBeDefined()
		})

		it("should handle C/C++ files correctly", async () => {
			const files = ["test.c", "test.h", "test.cpp", "test.hpp"]
			const parsers = await loadRequiredLanguageParsers(files)

			expect(ParserMock.Language.load).toHaveBeenCalledWith(expect.stringContaining("tree-sitter-c.wasm"))
			expect(ParserMock.Language.load).toHaveBeenCalledWith(expect.stringContaining("tree-sitter-cpp.wasm"))
			expect(parsers.c).toBeDefined()
			expect(parsers.h).toBeDefined()
			expect(parsers.cpp).toBeDefined()
			expect(parsers.hpp).toBeDefined()
		})

		it("should handle Kotlin files correctly", async () => {
			const files = ["test.kt", "test.kts"]
			const parsers = await loadRequiredLanguageParsers(files)

			expect(ParserMock.Language.load).toHaveBeenCalledWith(expect.stringContaining("tree-sitter-kotlin.wasm"))
			expect(parsers.kt).toBeDefined()
			expect(parsers.kts).toBeDefined()
			expect(parsers.kt.query).toBeDefined()
			expect(parsers.kts.query).toBeDefined()
		})

		it("should throw error for unsupported file extensions", async () => {
			const files = ["test.unsupported"]

			await expect(loadRequiredLanguageParsers(files)).rejects.toThrow("Unsupported language: unsupported")
		})

		it("should load each language only once for multiple files", async () => {
			const files = ["test1.js", "test2.js", "test3.js"]
			await loadRequiredLanguageParsers(files)

			expect(ParserMock.Language.load).toHaveBeenCalledTimes(1)
			expect(ParserMock.Language.load).toHaveBeenCalledWith(
				expect.stringContaining("tree-sitter-javascript.wasm"),
			)
		})

		it("should set language for each parser instance", async () => {
			const files = ["test.js", "test.py"]
			await loadRequiredLanguageParsers(files)

			expect(mockSetLanguage).toHaveBeenCalledTimes(2)
		})
	})
})
