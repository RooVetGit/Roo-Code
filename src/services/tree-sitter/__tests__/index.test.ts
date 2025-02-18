// npx jest src/services/tree-sitter/__tests__/index.test.ts

import { parseSourceCodeForDefinitionsTopLevel } from "../index"
import { listFiles } from "../../glob/list-files"
import { fileExistsAtPath, readFile } from "../../../utils/fs"

jest.mock("../../glob/list-files")
jest.mock("../../../utils/fs")

describe("Tree-sitter Service", () => {
	beforeEach(() => {
		jest.clearAllMocks()
		;(fileExistsAtPath as jest.Mock).mockResolvedValue(true)
	})

	describe("parseSourceCodeForDefinitionsTopLevel", () => {
		it("should handle non-existent directory", async () => {
			;(fileExistsAtPath as jest.Mock).mockResolvedValue(false)

			const result = await parseSourceCodeForDefinitionsTopLevel("/non/existent/path")
			expect(result).toBe("This directory does not exist or you do not have permission to access it.")
		})

		it("should handle empty directory", async () => {
			;(listFiles as jest.Mock).mockResolvedValue([[], new Set()])

			const result = await parseSourceCodeForDefinitionsTopLevel("/test/path")
			expect(result).toBe("No source code definitions found.")
		})

		it("should parse TypeScript files correctly", async () => {
			const mockFiles = ["/test/path/file1.ts", "/test/path/file2.tsx", "/test/path/readme.md"]
			;(listFiles as jest.Mock).mockResolvedValue([mockFiles, new Set()])
			;(readFile as jest.Mock).mockResolvedValue("export class TestClass {\n  constructor() {}\n}")

			const result = await parseSourceCodeForDefinitionsTopLevel("/test/path")

			expect(result).toContain("file1.ts")
			expect(result).toContain("file2.tsx")
			expect(result).not.toContain("readme.md")
			expect(result).toContain("export class TestClass")
		})

		it("should handle multiple definition types", async () => {
			const mockFiles = ["/test/path/file.ts"]
			;(listFiles as jest.Mock).mockResolvedValue([mockFiles, new Set()])
			const fileContent = "class TestClass {\n" + "  constructor() {}\n" + "  testMethod() {}\n" + "}"
			;(readFile as jest.Mock).mockResolvedValue(fileContent)

			const result = await parseSourceCodeForDefinitionsTopLevel("/test/path")

			expect(result).toContain("class TestClass")
			expect(result).toContain("testMethod()")
			expect(result).toContain("|----")
		})

		it("should handle parsing errors gracefully", async () => {
			const mockFiles = ["/test/path/file.ts"]
			;(listFiles as jest.Mock).mockResolvedValue([mockFiles, new Set()])
			;(readFile as jest.Mock).mockResolvedValue("invalid code")

			const result = await parseSourceCodeForDefinitionsTopLevel("/test/path")
			expect(result).toBe("No source code definitions found.")
		})

		it("should respect file limit", async () => {
			const mockFiles = Array(100)
				.fill(0)
				.map((_, i) => `/test/path/file${i}.ts`)
			;(listFiles as jest.Mock).mockResolvedValue([mockFiles, new Set()])
			;(readFile as jest.Mock).mockResolvedValue("")

			await parseSourceCodeForDefinitionsTopLevel("/test/path")

			// Should only process first 50 files.
			expect(readFile).toHaveBeenCalledTimes(50)
		})

		it("should handle various supported file extensions", async () => {
			const mockFiles = [
				"/test/path/script.js",
				"/test/path/app.py",
				"/test/path/main.rs",
				"/test/path/program.cpp",
				"/test/path/code.go",
			]

			;(listFiles as jest.Mock).mockResolvedValue([mockFiles, new Set()])
			;(readFile as jest.Mock).mockImplementation((path: string) => {
				if (path.endsWith(".js")) return Promise.resolve("function jsTest() { return true; }")
				if (path.endsWith(".py")) return Promise.resolve("def py_test():\n    return True")
				if (path.endsWith(".rs")) return Promise.resolve("fn rust_test() -> bool {\n    true\n}")
				if (path.endsWith(".cpp")) return Promise.resolve("bool cppTest() {\n    return true;\n}")
				if (path.endsWith(".go")) return Promise.resolve("func goTest() bool {\n    return true\n}")
				return Promise.resolve("")
			})

			const result = await parseSourceCodeForDefinitionsTopLevel("/test/path")
			console.log("result", result)

			expect(result).toContain("script.js")
			expect(result).toContain("jsTest()")

			expect(result).toContain("app.py")
			expect(result).toContain("py_test()")

			expect(result).toContain("main.rs")
			expect(result).toContain("rust_test()")

			expect(result).toContain("program.cpp")
			expect(result).toContain("cppTest()")

			expect(result).toContain("code.go")
			expect(result).toContain("goTest()")
		})

		it("should normalize paths in output", async () => {
			const mockFiles = ["/test/path/dir\\file.ts"]
			;(listFiles as jest.Mock).mockResolvedValue([mockFiles, new Set()])
			;(readFile as jest.Mock).mockResolvedValue("class Test {}")

			const result = await parseSourceCodeForDefinitionsTopLevel("/test/path")

			// Should use forward slashes regardless of platform.
			expect(result).toContain("dir/file.ts")
			expect(result).not.toContain("dir\\file.ts")
		})
	})
})
