import * as vscode from "vscode"

/**
 * Interface for code file parser
 */
export interface ICodeParser {
	/**
	 * Parses a code file into code blocks
	 * @param filePath Path to the file to parse
	 * @param options Optional parsing options
	 * @returns Promise resolving to array of code blocks
	 */
	parseFile(
		filePath: string,
		options?: {
			minBlockLines?: number
			maxBlockLines?: number
			content?: string
			fileHash?: string
		},
	): Promise<CodeBlock[]>
}

/**
 * Interface for directory scanner
 */
export interface IDirectoryScanner {
	/**
	 * Scans a directory for code blocks
	 * @param directoryPath Path to the directory to scan
	 * @param options Optional scanning options
	 * @returns Promise resolving to scan results
	 */
	scanDirectory(
		directory: string,
		context?: vscode.ExtensionContext,
		onError?: (error: Error) => void,
	): Promise<{
		codeBlocks: CodeBlock[]
		stats: {
			processed: number
			skipped: number
		}
	}>
}

/**
 * Interface for file watcher
 */
export interface IFileWatcher {
	/**
	 * Initializes the file watcher
	 */
	initialize(): Promise<void>

	/**
	 * Disposes the file watcher
	 */
	dispose(): void

	/**
	 * Event emitted when a file starts processing
	 */
	onDidStartProcessing: vscode.Event<string>

	/**
	 * Event emitted when a file finishes processing
	 */
	onDidFinishProcessing: vscode.Event<FileProcessingResult>

	/**
	 * Processes a file
	 * @param filePath Path to the file to process
	 * @returns Promise resolving to processing result
	 */
	processFile(filePath: string): Promise<FileProcessingResult>
}

export interface FileProcessingResult {
	path: string
	status: "success" | "skipped" | "error"
	error?: Error
	reason?: string
}

/**
 * Common types used across the code-index service
 */

export interface CodeBlock {
	file_path: string
	identifier: string | null
	type: string
	start_line: number
	end_line: number
	content: string
	fileHash: string
	segmentHash: string
}
