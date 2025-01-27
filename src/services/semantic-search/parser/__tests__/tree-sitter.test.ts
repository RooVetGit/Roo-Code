import { TreeSitterParser } from "../tree-sitter"
import * as path from "path"
import * as fs from "fs/promises"

describe("TreeSitterParser", () => {
	let parser: TreeSitterParser

	beforeAll(async () => {
		const wasmPath = path.resolve(__dirname, "../../../../../node_modules/tree-sitter-wasms/out")
		parser = new TreeSitterParser(wasmPath)
	})

	// Create test files in memory or as fixtures
	const createTestFile = async (filename: string, content: string) => {
		const filePath = path.join(__dirname, filename)
		await fs.writeFile(filePath, content)
		return filePath
	}

	// Add these test file contents
	const TEST_FILES = {
		"test-class.ts": `
      class TestClass {
        constructor() {}
      }
    `,
		"test-function.js": `
      function testFunction() {
        return true;
      }
    `,
		"test-import.ts": `
      import { something } from 'some-module';
    `,
		"test-variable.js": `
      const testVar = 'test';
    `,
		"test-ts-variable.ts": `
      const tsVar: string = 'test';
    `,
		"test-params.ts": `
      function testParams(param1: string) {
        return param1;
      }
    `,
	}

	beforeEach(async () => {
		// Create test files before each test
		for (const [filename, content] of Object.entries(TEST_FILES)) {
			await createTestFile(filename, content.trim())
		}
	})

	afterEach(async () => {
		// Clean up test files
		const testFiles = [
			"test-class.ts",
			"test-function.js",
			"test-import.ts",
			"test-variable.js",
			"test-ts-variable.ts",
			"test-params.ts",
		]
		for (const file of testFiles) {
			try {
				await fs.unlink(path.join(__dirname, file))
			} catch (e) {
				// Ignore errors if file doesn't exist
			}
		}
	})

	it("should parse TypeScript class declarations and methods", async () => {
		const filePath = path.join(__dirname, "test-class.ts")
		const result = await parser.parseFile(filePath)

		const expectedSegments = {
			path: expect.stringContaining("test-class.ts"),
			segments: [
				{
					type: "class",
					name: "TestClass",
					content: "class TestClass {\n        constructor() {}\n      }",
					startLine: 0,
					endLine: 2,
					context: "",
					importance: 1,
					language: "typescript",
				},
				{
					type: "method",
					name: "constructor",
					content: "constructor() {}",
					startLine: 1,
					endLine: 1,
					context: "TestClass",
					importance: 0.7,
					language: "typescript",
				},
			],
			imports: [],
			exports: [],
			summary: "2 code segments found: class, method",
		}

		expect(result.segments).toHaveLength(2)
		expect(result.segments).toEqual(expectedSegments.segments)
	})

	it("should parse JavaScript function declarations", async () => {
		const filePath = path.join(__dirname, "test-function.js")
		const result = await parser.parseFile(filePath)

		const expectedSegments = {
			path: expect.stringContaining("test-function.js"),
			segments: [
				{
					type: "function",
					name: "testFunction",
					content: "function testFunction() {\n        return true;\n      }",
					startLine: 0,
					endLine: 2,
					context: "",
					importance: 0.8,
					language: "javascript",
				},
			],
		}

		expect(result.segments).toHaveLength(1)
		expect(result.segments).toEqual(expectedSegments.segments)
	})

	it("should parse TypeScript imports", async () => {
		const filePath = path.join(__dirname, "test-import.ts")
		const result = await parser.parseFile(filePath)

		const expectedSegments = {
			path: expect.stringContaining("test-import.ts"),
			segments: [
				{
					type: "import",
					name: "some-module",
					context: "",
					importance: 0.5,
					content: "import { something } from 'some-module';",
					startLine: 0,
					endLine: 0,
					language: "typescript",
				},
			],
		}

		expect(result.imports).toHaveLength(1)
		expect(result.segments).toEqual(expectedSegments.segments)
	})

	it("should parse JavaScript variables", async () => {
		const filePath = path.join(__dirname, "test-variable.js")
		const result = await parser.parseFile(filePath)

		const expectedSegments = {
			path: expect.stringContaining("test-variable.js"),
			segments: [
				{
					type: "variable",
					name: "testVar",
					context: "",
					importance: 0.5,
					content: "const testVar = 'test';",
					startLine: 0,
					endLine: 0,
					language: "javascript",
				},
			],
		}

		expect(result.segments).toHaveLength(1)
		expect(result.segments).toEqual(expectedSegments.segments)
	})

	it("should parse TypeScript variables with type annotations", async () => {
		const filePath = path.join(__dirname, "test-ts-variable.ts")
		const result = await parser.parseFile(filePath)

		const expectedSegments = {
			path: expect.stringContaining("test-ts-variable.ts"),
			segments: [
				{
					type: "variable",
					name: "tsVar",
					context: "",
					importance: 0.5,
					content: "const tsVar: string = 'test';",
					startLine: 0,
					endLine: 0,
					language: "typescript",
				},
			],
		}

		expect(result.segments).toHaveLength(1)
		expect(result.segments).toEqual(expectedSegments.segments)
	})
})
