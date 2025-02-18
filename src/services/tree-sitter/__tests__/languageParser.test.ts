// npx jest src/services/tree-sitter/__tests__/languageParser.test.ts

import { Parser, Language } from "web-tree-sitter"

import { loadRequiredLanguageParsers } from "../languageParser"

describe("loadRequiredLanguageParsers", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("should initialize parser only once", async () => {
		const parserSpy = jest.spyOn(Parser, "init")

		const files = ["test.js", "test2.js"]
		await loadRequiredLanguageParsers(files)
		await loadRequiredLanguageParsers(files)

		expect(parserSpy).toHaveBeenCalledTimes(1)
	})

	it("should load JavaScript parser for .js and .jsx files", async () => {
		const languageSpy = jest.spyOn(Language, "load")

		const files = ["test.js", "test.jsx"]
		const parsers = await loadRequiredLanguageParsers(files)

		expect(languageSpy).toHaveBeenCalledWith(expect.stringContaining("tree-sitter-javascript.wasm"))
		expect(parsers.js).toBeDefined()
		expect(parsers.jsx).toBeDefined()
		expect(parsers.js.query).toBeDefined()
		expect(parsers.jsx.query).toBeDefined()
	})

	it("should load TypeScript parser for .ts and .tsx files", async () => {
		const languageSpy = jest.spyOn(Language, "load")

		const files = ["test.ts", "test.tsx"]
		const parsers = await loadRequiredLanguageParsers(files)

		expect(languageSpy).toHaveBeenCalledWith(expect.stringContaining("tree-sitter-typescript.wasm"))
		expect(languageSpy).toHaveBeenCalledWith(expect.stringContaining("tree-sitter-tsx.wasm"))
		expect(parsers.ts).toBeDefined()
		expect(parsers.tsx).toBeDefined()
	})

	it("should load Python parser for .py files", async () => {
		const languageSpy = jest.spyOn(Language, "load")

		const files = ["test.py"]
		const parsers = await loadRequiredLanguageParsers(files)

		expect(languageSpy).toHaveBeenCalledWith(expect.stringContaining("tree-sitter-python.wasm"))
		expect(parsers.py).toBeDefined()
	})

	it("should load multiple language parsers as needed", async () => {
		const languageSpy = jest.spyOn(Language, "load")

		const files = ["test.js", "test.py", "test.rs", "test.go"]
		const parsers = await loadRequiredLanguageParsers(files)

		expect(languageSpy).toHaveBeenCalledTimes(4)
		expect(parsers.js).toBeDefined()
		expect(parsers.py).toBeDefined()
		expect(parsers.rs).toBeDefined()
		expect(parsers.go).toBeDefined()
	})

	it("should handle C/C++ files correctly", async () => {
		const languageSpy = jest.spyOn(Language, "load")

		const files = ["test.c", "test.h", "test.cpp", "test.hpp"]
		const parsers = await loadRequiredLanguageParsers(files)

		expect(languageSpy).toHaveBeenCalledWith(expect.stringContaining("tree-sitter-c.wasm"))
		expect(languageSpy).toHaveBeenCalledWith(expect.stringContaining("tree-sitter-cpp.wasm"))
		expect(parsers.c).toBeDefined()
		expect(parsers.h).toBeDefined()
		expect(parsers.cpp).toBeDefined()
		expect(parsers.hpp).toBeDefined()
	})

	it("should throw error for unsupported file extensions", async () => {
		const files = ["test.unsupported"]

		await expect(loadRequiredLanguageParsers(files)).rejects.toThrow("Unsupported language: unsupported")
	})

	it("should load each language only once for multiple files", async () => {
		const languageSpy = jest.spyOn(Language, "load")

		const files = ["test1.js", "test2.js", "test3.js"]
		await loadRequiredLanguageParsers(files)

		expect(languageSpy).toHaveBeenCalledTimes(1)
		expect(languageSpy).toHaveBeenCalledWith(expect.stringContaining("tree-sitter-javascript.wasm"))
	})

	it("should set language for each parser instance", async () => {
		const files = ["test.js", "test.py"]
		const parsers = await loadRequiredLanguageParsers(files)

		expect(Object.keys(parsers)).toEqual(["js", "py"])
	})
})
