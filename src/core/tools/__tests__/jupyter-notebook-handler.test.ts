import { describe, it, expect, beforeEach, afterEach } from "vitest"
import fs from "fs/promises"
import path from "path"
import {
	isJupyterNotebook,
	parseJupyterNotebook,
	applyChangesToNotebook,
	writeJupyterNotebook,
	validateJupyterNotebookJson,
} from "../jupyter-notebook-handler"

describe("Jupyter Notebook Handler", () => {
	const testDir = path.join(__dirname, "test-notebooks")
	const testNotebookPath = path.join(testDir, "test.ipynb")
	const testTextPath = path.join(testDir, "test.txt")

	beforeEach(async () => {
		await fs.mkdir(testDir, { recursive: true })
	})

	afterEach(async () => {
		try {
			await fs.rm(testDir, { recursive: true, force: true })
		} catch (error) {
			// Ignore cleanup errors
		}
	})

	describe("isJupyterNotebook", () => {
		it("should return true for .ipynb files", () => {
			expect(isJupyterNotebook("test.ipynb")).toBe(true)
			expect(isJupyterNotebook("/path/to/notebook.ipynb")).toBe(true)
			expect(isJupyterNotebook("NOTEBOOK.IPYNB")).toBe(true)
		})

		it("should return false for non-.ipynb files", () => {
			expect(isJupyterNotebook("test.py")).toBe(false)
			expect(isJupyterNotebook("test.txt")).toBe(false)
			expect(isJupyterNotebook("test")).toBe(false)
			expect(isJupyterNotebook("test.ipynb.backup")).toBe(false)
		})
	})

	describe("validateJupyterNotebookJson", () => {
		it("should validate correct notebook JSON", () => {
			const validNotebook = JSON.stringify({
				cells: [],
				metadata: {},
				nbformat: 4,
				nbformat_minor: 2,
			})

			const result = validateJupyterNotebookJson(validNotebook)
			expect(result.valid).toBe(true)
			expect(result.error).toBeUndefined()
		})

		it("should reject invalid JSON", () => {
			const result = validateJupyterNotebookJson("invalid json")
			expect(result.valid).toBe(false)
			expect(result.error).toContain("Invalid JSON")
		})

		it("should reject JSON without cells", () => {
			const invalidNotebook = JSON.stringify({
				metadata: {},
				nbformat: 4,
				nbformat_minor: 2,
			})

			const result = validateJupyterNotebookJson(invalidNotebook)
			expect(result.valid).toBe(false)
			expect(result.error).toContain("Missing or invalid 'cells' array")
		})

		it("should reject JSON without nbformat", () => {
			const invalidNotebook = JSON.stringify({
				cells: [],
				metadata: {},
				nbformat_minor: 2,
			})

			const result = validateJupyterNotebookJson(invalidNotebook)
			expect(result.valid).toBe(false)
			expect(result.error).toContain("Missing or invalid 'nbformat'")
		})
	})

	describe("parseJupyterNotebook", () => {
		it("should return isNotebook false for non-notebook files", async () => {
			await fs.writeFile(testTextPath, "Hello world")
			const result = await parseJupyterNotebook(testTextPath)
			expect(result.isNotebook).toBe(false)
		})

		it("should parse a simple notebook with code and markdown cells", async () => {
			const notebook = {
				cells: [
					{
						cell_type: "markdown",
						source: ["# Hello World\n", "This is a markdown cell."],
					},
					{
						cell_type: "code",
						source: ["print('Hello, World!')\n", "x = 42"],
					},
					{
						cell_type: "raw",
						source: ["This is raw text"],
					},
				],
				metadata: {},
				nbformat: 4,
				nbformat_minor: 2,
			}

			await fs.writeFile(testNotebookPath, JSON.stringify(notebook, null, 2))
			const result = await parseJupyterNotebook(testNotebookPath)

			expect(result.isNotebook).toBe(true)
			expect(result.originalJson).toEqual(notebook)
			expect(result.extractedContent).toBe(
				"# Hello World\nThis is a markdown cell.\nprint('Hello, World!')\nx = 42",
			)
			expect(result.cellBoundaries).toHaveLength(2)
			expect(result.cellBoundaries![0]).toEqual({
				cellIndex: 0,
				startLine: 1,
				endLine: 2,
				cellType: "markdown",
			})
			expect(result.cellBoundaries![1]).toEqual({
				cellIndex: 1,
				startLine: 3,
				endLine: 4,
				cellType: "code",
			})
		})

		it("should handle empty cells", async () => {
			const notebook = {
				cells: [
					{
						cell_type: "code",
						source: [],
					},
					{
						cell_type: "markdown",
						source: ["# Title"],
					},
				],
				metadata: {},
				nbformat: 4,
				nbformat_minor: 2,
			}

			await fs.writeFile(testNotebookPath, JSON.stringify(notebook, null, 2))
			const result = await parseJupyterNotebook(testNotebookPath)

			expect(result.isNotebook).toBe(true)
			expect(result.extractedContent).toBe("# Title")
			expect(result.cellBoundaries).toHaveLength(1)
			expect(result.cellBoundaries![0]).toEqual({
				cellIndex: 1,
				startLine: 1,
				endLine: 1,
				cellType: "markdown",
			})
		})

		it("should throw error for invalid JSON", async () => {
			await fs.writeFile(testNotebookPath, "invalid json")
			await expect(parseJupyterNotebook(testNotebookPath)).rejects.toThrow("Failed to parse Jupyter notebook")
		})
	})

	describe("applyChangesToNotebook", () => {
		it("should apply changes to notebook cells", () => {
			const originalNotebook = {
				cells: [
					{
						cell_type: "markdown" as const,
						source: ["# Old Title\n", "Old content."],
					},
					{
						cell_type: "code" as const,
						source: ["print('old')\n", "x = 1"],
					},
				],
				metadata: {},
				nbformat: 4,
				nbformat_minor: 2,
			}

			const cellBoundaries = [
				{
					cellIndex: 0,
					startLine: 1,
					endLine: 2,
					cellType: "markdown",
				},
				{
					cellIndex: 1,
					startLine: 3,
					endLine: 4,
					cellType: "code",
				},
			]

			const newExtractedContent = "# New Title\nNew content.\nprint('new')\nx = 2"

			const result = applyChangesToNotebook(originalNotebook, newExtractedContent, cellBoundaries)

			expect(result.cells[0].source).toEqual(["# New Title\n", "New content."])
			expect(result.cells[1].source).toEqual(["print('new')\n", "x = 2"])
		})

		it("should handle single-line cells", () => {
			const originalNotebook = {
				cells: [
					{
						cell_type: "code" as const,
						source: ["print('hello')"],
					},
				],
				metadata: {},
				nbformat: 4,
				nbformat_minor: 2,
			}

			const cellBoundaries = [
				{
					cellIndex: 0,
					startLine: 1,
					endLine: 1,
					cellType: "code",
				},
			]

			const newExtractedContent = "print('world')"

			const result = applyChangesToNotebook(originalNotebook, newExtractedContent, cellBoundaries)

			expect(result.cells[0].source).toEqual(["print('world')"])
		})

		it("should preserve cells not in boundaries", () => {
			const originalNotebook = {
				cells: [
					{
						cell_type: "markdown" as const,
						source: ["# Title"],
					},
					{
						cell_type: "raw" as const,
						source: ["Raw content"],
					},
					{
						cell_type: "code" as const,
						source: ["print('code')"],
					},
				],
				metadata: {},
				nbformat: 4,
				nbformat_minor: 2,
			}

			const cellBoundaries = [
				{
					cellIndex: 0,
					startLine: 1,
					endLine: 1,
					cellType: "markdown",
				},
				{
					cellIndex: 2,
					startLine: 2,
					endLine: 2,
					cellType: "code",
				},
			]

			const newExtractedContent = "# New Title\nprint('new code')"

			const result = applyChangesToNotebook(originalNotebook, newExtractedContent, cellBoundaries)

			expect(result.cells[0].source).toEqual(["# New Title"])
			expect(result.cells[1].source).toEqual(["Raw content"]) // Unchanged
			expect(result.cells[2].source).toEqual(["print('new code')"])
		})
	})

	describe("writeJupyterNotebook", () => {
		it("should write notebook with proper formatting", async () => {
			const notebook = {
				cells: [
					{
						cell_type: "code" as const,
						source: ["print('test')"],
					},
				],
				metadata: {},
				nbformat: 4,
				nbformat_minor: 2,
			}

			await writeJupyterNotebook(testNotebookPath, notebook)

			const writtenContent = await fs.readFile(testNotebookPath, "utf8")
			const parsedContent = JSON.parse(writtenContent)

			expect(parsedContent).toEqual(notebook)
			// Check that it's properly formatted (indented)
			expect(writtenContent).toContain('  "cells":')
		})
	})

	describe("integration test", () => {
		it("should handle full parse -> modify -> apply cycle", async () => {
			const originalNotebook = {
				cells: [
					{
						cell_type: "markdown" as const,
						source: ["# Data Analysis\n", "Let's analyze some data."],
					},
					{
						cell_type: "code" as const,
						source: ["import pandas as pd\n", "df = pd.read_csv('data.csv')\n", "print(df.head())"],
					},
				],
				metadata: {},
				nbformat: 4,
				nbformat_minor: 2,
			}

			// Write original notebook
			await fs.writeFile(testNotebookPath, JSON.stringify(originalNotebook, null, 2))

			// Parse it
			const parseResult = await parseJupyterNotebook(testNotebookPath)
			expect(parseResult.isNotebook).toBe(true)

			// Modify the extracted content
			const modifiedContent =
				"# Advanced Data Analysis\nLet's do advanced analysis.\nimport pandas as pd\nimport numpy as np\ndf = pd.read_csv('data.csv')\nprint(df.describe())"

			// Apply changes back
			const updatedNotebook = applyChangesToNotebook(
				parseResult.originalJson!,
				modifiedContent,
				parseResult.cellBoundaries!,
			)

			// Write it back
			await writeJupyterNotebook(testNotebookPath, updatedNotebook)

			// Verify the result
			const finalContent = await fs.readFile(testNotebookPath, "utf8")
			const finalNotebook = JSON.parse(finalContent)

			expect(finalNotebook.cells[0].source).toEqual(["# Advanced Data Analysis\n", "Let's do advanced analysis."])
			expect(finalNotebook.cells[1].source).toEqual([
				"import pandas as pd\n",
				"import numpy as np\n",
				"df = pd.read_csv('data.csv')\n",
				"print(df.describe())",
			])
		})
	})
})
