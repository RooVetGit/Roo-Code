import * as fs from "fs/promises"
import * as path from "path"
import { TreeSitterParser } from "../tree-sitter"
import { CodeSegmentType } from "../types"
import * as fsSync from "fs"
import { promisify } from "util"
const copyFile = promisify(fsSync.copyFile)

describe("Python Parser", () => {
	let parser: TreeSitterParser
	const tempDir = path.join(__dirname, "temp-python-tests")
	const wasmTempDir = path.join(tempDir, "wasm")

	beforeAll(async () => {
		// Create temp directories
		await fs.mkdir(tempDir, { recursive: true })
		await fs.mkdir(wasmTempDir, { recursive: true })

		// Copy all tree-sitter language WASM files
		const wasmSourceDir = path.join(__dirname, "../../../../../node_modules/tree-sitter-wasms/out")
		const wasmFiles = await fs.readdir(wasmSourceDir)

		for (const wasmFile of wasmFiles) {
			if (wasmFile.startsWith("tree-sitter-") && wasmFile.endsWith(".wasm")) {
				const sourceWasm = path.join(wasmSourceDir, wasmFile)
				const destWasm = path.join(wasmTempDir, wasmFile)
				await copyFile(sourceWasm, destWasm)
			}
		}

		// Create parser with test configuration
		parser = new TreeSitterParser(__dirname, wasmTempDir)
	})

	afterAll(async () => {
		// Cleanup test files
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	async function createTestFile(content: string): Promise<string> {
		const filePath = path.join(tempDir, `test-${Date.now()}.py`)
		await fs.writeFile(filePath, content)
		return filePath
	}

	test("should parse import statements", async () => {
		const code = `
# Sample import
from sklearn.ensemble import RandomForestClassifier as RFC
import numpy as np
`
		const filePath = await createTestFile(code)
		const result = await parser.parseFile(filePath)
		console.log(result?.segments)

		expect(result?.segments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: CodeSegmentType.IMPORT,
					name: "numpy",
					content: "import numpy as np",
				}),
				expect.objectContaining({
					type: CodeSegmentType.IMPORT,
					name: "sklearn.ensemble",
					content: "from sklearn.ensemble import RandomForestClassifier as RFC",
				}),
			]),
		)
	})

	test("should parse class definitions", async () => {
		const code = `
class MyClass:
    """Class documentation"""
    def __init__(self):
        pass
`
		const filePath = await createTestFile(code)
		const result = await parser.parseFile(filePath)

		expect(result?.segments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: CodeSegmentType.CLASS,
					name: "MyClass",
					content: expect.stringContaining("class MyClass:"),
				}),
			]),
		)
	})

	test("should parse function definitions", async () => {
		const code = `
def calculate_total(a: int, b: int) -> int:
    """Adds two numbers"""
    return a + b
`
		const filePath = await createTestFile(code)
		const result = await parser.parseFile(filePath)

		expect(result?.segments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: CodeSegmentType.FUNCTION,
					name: "calculate_total",
					content: expect.stringContaining("def calculate_total"),
				}),
			]),
		)
	})

	test("should parse variable assignments", async () => {
		const code = `
# Configuration settings
MAX_RETRIES = 3
`
		const filePath = await createTestFile(code)
		const result = await parser.parseFile(filePath)

		expect(result?.segments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: CodeSegmentType.VARIABLE,
					name: "MAX_RETRIES",
					content: "MAX_RETRIES = 3",
				}),
			]),
		)
	})

	test("should capture docstrings", async () => {
		const code = `
def example():
    """This is a docstring"""
    pass
`
		const filePath = await createTestFile(code)
		const result = await parser.parseFile(filePath)

		const docstringSegment = result?.segments.find((s) => s.content.includes('"""This is a docstring"""'))
		expect(docstringSegment).toBeDefined()
	})
})
