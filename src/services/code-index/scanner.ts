import { listFiles } from "../glob/list-files"
import { RooIgnoreController } from "../../core/ignore/RooIgnoreController"
import { parseCodeFileBySize, CodeBlock } from "./parser"
import { stat } from "fs/promises"
import * as path from "path"
import { extensions } from "../tree-sitter"

const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024 // 1MB

/**
 * Recursively scans a directory for code blocks in supported files.
 * @param directoryPath The directory to scan (defaults to process.cwd())
 * @param rooIgnoreController Optional RooIgnoreController instance for filtering
 * @returns Promise<CodeBlock[]> Array of parsed code blocks
 */
export async function scanDirectoryForCodeBlocks(
	directoryPath: string = process.cwd(),
	rooIgnoreController?: RooIgnoreController,
): Promise<CodeBlock[]> {
	// Get all files recursively (handles .gitignore automatically)
	const [allPaths, _] = await listFiles(directoryPath, true, Infinity)

	// Filter out directories (marked with trailing '/')
	const filePaths = allPaths.filter((p) => !p.endsWith("/"))

	// Initialize RooIgnoreController if not provided
	const ignoreController = rooIgnoreController ?? new RooIgnoreController(directoryPath)
	if (!rooIgnoreController) {
		await ignoreController.initialize()
	}

	// Filter paths using .rooignore
	const allowedPaths = ignoreController.filterPaths(filePaths)

	// Filter by supported extensions
	const supportedPaths = allowedPaths.filter((filePath) => {
		const ext = path.extname(filePath).toLowerCase()
		return extensions.includes(ext)
	})

	// Process files in parallel
	const processingPromises = supportedPaths.map(async (filePath) => {
		try {
			// Check file size
			const stats = await stat(filePath)
			if (stats.size > MAX_FILE_SIZE_BYTES) {
				return []
			}

			// Parse the file
			return await parseCodeFileBySize(filePath)
		} catch (error) {
			console.error(`Error processing file ${filePath}:`, error)
			return []
		}
	})

	// Wait for all files to be processed
	const results = await Promise.all(processingPromises)

	// Flatten the array of arrays into a single array
	return results.flat()
}
