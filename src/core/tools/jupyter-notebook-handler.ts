import fs from "fs/promises"
import path from "path"

/**
 * Jupyter notebook cell interface
 */
interface JupyterCell {
	cell_type: "code" | "markdown" | "raw"
	source: string[]
	metadata?: any
	outputs?: any[]
	execution_count?: number | null
}

/**
 * Jupyter notebook interface
 */
interface JupyterNotebook {
	cells: JupyterCell[]
	metadata: any
	nbformat: number
	nbformat_minor: number
}

/**
 * Result of parsing a Jupyter notebook for editing
 */
interface NotebookParseResult {
	isNotebook: boolean
	originalJson?: JupyterNotebook
	extractedContent?: string
	cellBoundaries?: Array<{
		cellIndex: number
		startLine: number
		endLine: number
		cellType: string
	}>
}

/**
 * Checks if a file is a Jupyter notebook based on its extension
 */
export function isJupyterNotebook(filePath: string): boolean {
	return path.extname(filePath).toLowerCase() === ".ipynb"
}

/**
 * Parses a Jupyter notebook file and extracts content in a format suitable for editing
 */
export async function parseJupyterNotebook(filePath: string): Promise<NotebookParseResult> {
	if (!isJupyterNotebook(filePath)) {
		return { isNotebook: false }
	}

	try {
		const data = await fs.readFile(filePath, "utf8")
		const notebook: JupyterNotebook = JSON.parse(data)

		let extractedContent = ""
		const cellBoundaries: Array<{
			cellIndex: number
			startLine: number
			endLine: number
			cellType: string
		}> = []

		let currentLine = 1

		for (let i = 0; i < notebook.cells.length; i++) {
			const cell = notebook.cells[i]
			if ((cell.cell_type === "markdown" || cell.cell_type === "code") && cell.source) {
				const cellContent = cell.source.join("\n")
				const startLine = currentLine
				const lines = cellContent.split("\n")
				const endLine = currentLine + lines.length - 1

				cellBoundaries.push({
					cellIndex: i,
					startLine,
					endLine,
					cellType: cell.cell_type,
				})

				extractedContent += cellContent + "\n"
				currentLine = endLine + 1
			}
		}

		return {
			isNotebook: true,
			originalJson: notebook,
			extractedContent: extractedContent.trimEnd(),
			cellBoundaries,
		}
	} catch (error) {
		throw new Error(`Failed to parse Jupyter notebook: ${error instanceof Error ? error.message : String(error)}`)
	}
}

/**
 * Applies changes to extracted content back to the original notebook structure
 */
export function applyChangesToNotebook(
	originalNotebook: JupyterNotebook,
	newExtractedContent: string,
	cellBoundaries: Array<{
		cellIndex: number
		startLine: number
		endLine: number
		cellType: string
	}>,
): JupyterNotebook {
	const newNotebook: JupyterNotebook = JSON.parse(JSON.stringify(originalNotebook))
	const newLines = newExtractedContent.split("\n")

	// Clear all existing cell sources for cells that were in the boundaries
	const processedCellIndices = new Set<number>()

	for (const boundary of cellBoundaries) {
		processedCellIndices.add(boundary.cellIndex)
		// Extract the lines for this cell (1-based to 0-based conversion)
		const cellLines = newLines.slice(boundary.startLine - 1, boundary.endLine)

		// Update the cell source
		if (newNotebook.cells[boundary.cellIndex]) {
			newNotebook.cells[boundary.cellIndex].source = cellLines.map((line, index) => {
				// Add newline to all lines except the last one in the cell
				return index === cellLines.length - 1 ? line : line + "\n"
			})
		}
	}

	return newNotebook
}

/**
 * Writes a Jupyter notebook back to disk with proper formatting
 */
export async function writeJupyterNotebook(filePath: string, notebook: JupyterNotebook): Promise<void> {
	const jsonContent = JSON.stringify(notebook, null, 2)
	await fs.writeFile(filePath, jsonContent, "utf8")
}

/**
 * Validates that a string is valid JSON for a Jupyter notebook
 */
export function validateJupyterNotebookJson(content: string): { valid: boolean; error?: string } {
	try {
		const parsed = JSON.parse(content)

		// Basic validation for Jupyter notebook structure
		if (!parsed.cells || !Array.isArray(parsed.cells)) {
			return { valid: false, error: "Missing or invalid 'cells' array" }
		}

		if (typeof parsed.nbformat !== "number") {
			return { valid: false, error: "Missing or invalid 'nbformat'" }
		}

		if (typeof parsed.nbformat_minor !== "number") {
			return { valid: false, error: "Missing or invalid 'nbformat_minor'" }
		}

		return { valid: true }
	} catch (error) {
		return {
			valid: false,
			error: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
		}
	}
}
