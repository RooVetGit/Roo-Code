import { listFiles } from "../glob/list-files"
import { RooIgnoreController } from "../../core/ignore/RooIgnoreController"
import { parseCodeFileByQueries, CodeBlock } from "./parser"
import { stat } from "fs/promises"
import * as path from "path"
import { getWorkspacePath } from "../../utils/path"
import { extensions } from "../tree-sitter"
import { CodeIndexOpenAiEmbedder } from "./openai-embedder"
import { CodeIndexQdrantClient } from "./qdrant-client"
import { ApiHandlerOptions } from "../../shared/api"
import * as vscode from "vscode"
import { createHash } from "crypto"
import { v5 as uuidv5 } from "uuid"

const QDRANT_CODE_BLOCK_NAMESPACE = "f47ac10b-58cc-4372-a567-0e02b2c3d479"

const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024 // 1MB
const MAX_LIST_FILES_LIMIT = 1_000
const BATCH_SEGMENT_THRESHOLD = 20 // Number of code segments to batch for embeddings/upserts
const MAX_BATCH_RETRIES = 3
const INITIAL_RETRY_DELAY_MS = 500

async function loadHashCache(cachePath: vscode.Uri): Promise<Record<string, string>> {
	try {
		const fileData = await vscode.workspace.fs.readFile(cachePath)
		return JSON.parse(Buffer.from(fileData).toString("utf-8"))
	} catch (error) {
		if (error instanceof vscode.FileSystemError && error.code === "FileNotFound") {
			return {}
		}
		console.error("Error loading hash cache:", error)
		return {}
	}
}

async function saveHashCache(cachePath: vscode.Uri, hashes: Record<string, string>): Promise<void> {
	try {
		await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(cachePath.fsPath)))
		await vscode.workspace.fs.writeFile(cachePath, Buffer.from(JSON.stringify(hashes, null, 2), "utf-8"))
	} catch (error) {
		console.error("Error saving hash cache:", error)
		throw error
	}
}

/**
 * Recursively scans a directory for code blocks in supported files.
 * @param directoryPath The directory to scan (defaults to process.cwd())
 * @param rooIgnoreController Optional RooIgnoreController instance for filtering
 * @param context VS Code ExtensionContext for cache storage
 * @returns Promise<{codeBlocks: CodeBlock[], stats: {processed: number, skipped: number}}> Array of parsed code blocks and processing stats
 */
export async function scanDirectoryForCodeBlocks(
	directoryPath: string = process.cwd(),
	rooIgnoreController?: RooIgnoreController,
	openAiOptions?: ApiHandlerOptions,
	qdrantUrl?: string,
	context?: vscode.ExtensionContext,
	onError?: (error: Error) => void,
): Promise<{ codeBlocks: CodeBlock[]; stats: { processed: number; skipped: number } }> {
	// Get all files recursively (handles .gitignore automatically)
	const [allPaths, _] = await listFiles(directoryPath, true, MAX_LIST_FILES_LIMIT)

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

	// Initialize cache
	const cachePath = context?.globalStorageUri
		? vscode.Uri.joinPath(
				context.globalStorageUri,
				`roo-index-cache-${createHash("sha256").update(directoryPath).digest("hex")}.json`,
			)
		: undefined
	const oldHashes = cachePath ? await loadHashCache(cachePath) : {}
	const newHashes: Record<string, string> = {}
	const processedFiles = new Set<string>()
	const codeBlocks: CodeBlock[] = []
	let processedCount = 0
	let skippedCount = 0

	// Batch processing accumulators
	let batchBlocks: CodeBlock[] = []
	let batchTexts: string[] = []
	let batchFileInfos: { filePath: string; fileHash: string }[] = []

	// Initialize clients if needed
	const embedder = openAiOptions && qdrantUrl ? new CodeIndexOpenAiEmbedder(openAiOptions) : undefined
	const qdrantClient = openAiOptions && qdrantUrl ? new CodeIndexQdrantClient(directoryPath, qdrantUrl) : undefined
	if (qdrantClient) {
		await qdrantClient.initialize()
	}

	for (const filePath of supportedPaths) {
		try {
			// Check file size
			const stats = await stat(filePath)
			if (stats.size > MAX_FILE_SIZE_BYTES) {
				continue
			}

			// Read file content
			const content = await vscode.workspace.fs
				.readFile(vscode.Uri.file(filePath))
				.then((buffer) => Buffer.from(buffer).toString("utf-8"))

			// Calculate current hash
			const currentFileHash = createHash("sha256").update(content).digest("hex")
			processedFiles.add(filePath)

			// Check against cache
			const cachedFileHash = oldHashes[filePath]
			if (cachedFileHash === currentFileHash) {
				// File is unchanged
				newHashes[filePath] = currentFileHash
				skippedCount++
				continue
			}

			// File is new or changed - parse it
			const blocks = await parseCodeFileByQueries(filePath, { content, fileHash: currentFileHash })
			codeBlocks.push(...blocks)
			processedCount++

			// Process embeddings if configured
			if (embedder && qdrantClient && blocks.length > 0) {
				// Add to batch accumulators
				batchBlocks.push(...blocks)
				batchTexts.push(...blocks.map((block) => block.content))
				batchFileInfos.push({ filePath, fileHash: currentFileHash })

				// Process batch if threshold reached
				if (batchBlocks.length >= BATCH_SEGMENT_THRESHOLD) {
					await processBatch(
						batchBlocks,
						batchTexts,
						batchFileInfos,
						embedder!,
						qdrantClient!,
						newHashes,
						onError,
					)
					batchBlocks = []
					batchTexts = []
					batchFileInfos = []
				}
			} else {
				// Only update hash if not being processed in a batch
				newHashes[filePath] = currentFileHash
			}
		} catch (error) {
			console.error(`Error processing file ${filePath}:`, error)
		}
	}

	// Process any remaining items in batch
	if (batchBlocks.length > 0) {
		await processBatch(batchBlocks, batchTexts, batchFileInfos, embedder!, qdrantClient!, newHashes, onError)
	}

	// Handle deleted files (don't add them to newHashes)
	if (cachePath) {
		for (const cachedFilePath of Object.keys(oldHashes)) {
			if (!processedFiles.has(cachedFilePath)) {
				// File was deleted or is no longer supported/indexed
				if (qdrantClient) {
					try {
						console.log(`[CodeIndexScanner] Deleting points for deleted file: ${cachedFilePath}`)
						await qdrantClient.deletePointsByFilePath(cachedFilePath)
					} catch (error) {
						console.error(`[CodeIndexScanner] Failed to delete points for ${cachedFilePath}:`, error)
						// Decide if we should re-throw or just log
					}
				}
				// The file is implicitly removed from the cache because it's not added to newHashes
			}
		}

		// Save the updated cache
		await saveHashCache(cachePath, newHashes)
	}

	async function processBatch(
		batchBlocks: CodeBlock[],
		batchTexts: string[],
		batchFileInfos: { filePath: string; fileHash: string }[],
		embedder: CodeIndexOpenAiEmbedder,
		qdrantClient: CodeIndexQdrantClient,
		newHashes: Record<string, string>,
		onError?: (error: Error) => void,
	) {
		if (batchBlocks.length === 0) return

		let attempts = 0
		let success = false
		let lastError: Error | null = null

		while (attempts < MAX_BATCH_RETRIES && !success) {
			attempts++
			try {
				// --- Deletion Step ---
				const uniqueFilePaths = [...new Set(batchFileInfos.map((info) => info.filePath))]
				console.log(
					`[CodeIndexScanner] Deleting existing points for ${uniqueFilePaths.length} file(s) in batch...`,
				)
				for (const filePath of uniqueFilePaths) {
					try {
						await qdrantClient.deletePointsByFilePath(filePath)
						// Optional: Add more detailed logging if needed
					} catch (deleteError) {
						console.error(
							`[CodeIndexScanner] Failed to delete points for ${filePath} before upsert:`,
							deleteError,
						)
						// Re-throw the error to stop processing this batch attempt
						throw deleteError
					}
				}
				// --- End Deletion Step ---
				// Create embeddings for batch
				const { embeddings } = await embedder.createEmbeddings(batchTexts)

				// Prepare points for Qdrant
				const points = batchBlocks.map((block, index) => {
					const workspaceRoot = getWorkspacePath()
					const absolutePath = path.resolve(workspaceRoot, block.file_path)
					const normalizedAbsolutePath = path.normalize(absolutePath)

					const stableName = `${normalizedAbsolutePath}:${block.start_line}`
					const pointId = uuidv5(stableName, QDRANT_CODE_BLOCK_NAMESPACE)

					return {
						id: pointId,
						vector: embeddings[index],
						payload: {
							filePath: normalizedAbsolutePath,
							codeChunk: block.content,
							startLine: block.start_line,
							endLine: block.end_line,
						},
					}
				})

				// Upsert points to Qdrant
				await qdrantClient.upsertPoints(points)

				// Update hashes for successfully processed files
				for (const fileInfo of batchFileInfos) {
					newHashes[fileInfo.filePath] = fileInfo.fileHash
				}
				success = true
			} catch (error) {
				lastError = error as Error
				console.error(`Error processing batch (attempt ${attempts}):`, error)

				if (attempts < MAX_BATCH_RETRIES) {
					const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempts - 1)
					console.log(`Retrying in ${delay}ms...`)
					await new Promise((resolve) => setTimeout(resolve, delay))
				}
			}
		}

		if (!success && lastError && onError) {
			console.error(`Failed to process batch after ${MAX_BATCH_RETRIES} attempts`)
			onError(new Error(`Failed to process batch after ${MAX_BATCH_RETRIES} attempts: ${lastError.message}`))
		}
	}

	return {
		codeBlocks,
		stats: {
			processed: processedCount,
			skipped: skippedCount,
		},
	}
}
