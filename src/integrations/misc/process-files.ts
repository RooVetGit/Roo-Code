import * as vscode from "vscode"
import fs from "fs/promises"
import * as path from "path"

// File size limit: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024

// Supported file types with their MIME types
const FILE_TYPE_CATEGORIES = {
	images: ["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg"],
	documents: ["pdf", "doc", "docx", "txt", "rtf", "odt", "md"],
	code: ["js", "ts", "py", "java", "cpp", "c", "h", "hpp", "html", "css", "json", "xml", "yaml", "yml", "php", "rb", "go", "rs", "swift", "kt", "scala", "sh", "bat", "ps1"],
	data: ["csv", "xls", "xlsx", "sql", "db", "sqlite"],
	archives: ["zip", "rar", "tar", "gz", "7z"],
	config: ["ini", "conf", "config", "env", "properties"],
}

// Text file extensions that should be read as content
const TEXT_FILE_EXTENSIONS = [
	...FILE_TYPE_CATEGORIES.code,
	...FILE_TYPE_CATEGORIES.documents.filter(ext => ["txt", "md"].includes(ext)),
	...FILE_TYPE_CATEGORIES.config,
	...FILE_TYPE_CATEGORIES.data.filter(ext => ["csv", "sql"].includes(ext)),
]

export interface ProcessedFile {
	name: string
	path: string
	size: number
	type: string
	category: string
	content?: string // For text files
	dataUrl?: string // For images and binary files
	error?: string
}

export async function selectFiles(): Promise<ProcessedFile[]> {
	const options: vscode.OpenDialogOptions = {
		canSelectMany: true,
		openLabel: "Select",
		filters: {
			"All Files": ["*"],
			"Images": FILE_TYPE_CATEGORIES.images,
			"Documents": FILE_TYPE_CATEGORIES.documents,
			"Code Files": FILE_TYPE_CATEGORIES.code,
			"Data Files": FILE_TYPE_CATEGORIES.data,
			"Archives": FILE_TYPE_CATEGORIES.archives,
			"Config Files": FILE_TYPE_CATEGORIES.config,
		},
	}

	const fileUris = await vscode.window.showOpenDialog(options)

	if (!fileUris || fileUris.length === 0) {
		return []
	}

	return await Promise.all(
		fileUris.map(async (uri: vscode.Uri) => {
			try {
				return await processFile(uri.fsPath)
			} catch (error) {
				const fileName = path.basename(uri.fsPath)
				return {
					name: fileName,
					path: uri.fsPath,
					size: 0,
					type: "unknown",
					category: "unknown",
					error: error instanceof Error ? error.message : String(error),
				}
			}
		}),
	)
}

export async function processFile(filePath: string): Promise<ProcessedFile> {
	const fileName = path.basename(filePath)
	const fileExt = path.extname(filePath).toLowerCase().slice(1)
	
	// Check file size
	const stats = await fs.stat(filePath)
	if (stats.size > MAX_FILE_SIZE) {
		throw new Error(`File size (${formatFileSize(stats.size)}) exceeds the 10MB limit`)
	}

	const mimeType = getMimeType(filePath)
	const category = getFileCategory(fileExt)

	const processedFile: ProcessedFile = {
		name: fileName,
		path: filePath,
		size: stats.size,
		type: mimeType,
		category,
	}

	// Handle different file types
	if (category === "images") {
		// Process images as data URLs (existing behavior)
		const buffer = await fs.readFile(filePath)
		const base64 = buffer.toString("base64")
		processedFile.dataUrl = `data:${mimeType};base64,${base64}`
	} else if (isTextFile(fileExt)) {
		// Read text files as content
		try {
			processedFile.content = await fs.readFile(filePath, "utf-8")
		} catch (error) {
			// If UTF-8 reading fails, treat as binary
			const buffer = await fs.readFile(filePath)
			const base64 = buffer.toString("base64")
			processedFile.dataUrl = `data:${mimeType};base64,${base64}`
		}
	} else {
		// Handle binary files as base64
		const buffer = await fs.readFile(filePath)
		const base64 = buffer.toString("base64")
		processedFile.dataUrl = `data:${mimeType};base64,${base64}`
	}

	return processedFile
}

// Backward compatibility function for existing image functionality
export async function selectImages(): Promise<string[]> {
	const options: vscode.OpenDialogOptions = {
		canSelectMany: true,
		openLabel: "Select",
		filters: {
			Images: FILE_TYPE_CATEGORIES.images,
		},
	}

	const fileUris = await vscode.window.showOpenDialog(options)

	if (!fileUris || fileUris.length === 0) {
		return []
	}

	return await Promise.all(
		fileUris.map(async (uri: vscode.Uri) => {
			const filePath = uri.fsPath
			const buffer = await fs.readFile(filePath)
			const base64 = buffer.toString("base64")
			const mimeType = getMimeType(filePath)
			return `data:${mimeType};base64,${base64}`
		}),
	)
}

function getMimeType(filePath: string): string {
	const ext = path.extname(filePath).toLowerCase()
	
	// Image types
	switch (ext) {
		case ".png": return "image/png"
		case ".jpeg":
		case ".jpg": return "image/jpeg"
		case ".gif": return "image/gif"
		case ".bmp": return "image/bmp"
		case ".webp": return "image/webp"
		case ".svg": return "image/svg+xml"
		
		// Document types
		case ".pdf": return "application/pdf"
		case ".doc": return "application/msword"
		case ".docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
		case ".txt": return "text/plain"
		case ".rtf": return "application/rtf"
		case ".odt": return "application/vnd.oasis.opendocument.text"
		case ".md": return "text/markdown"
		
		// Code types
		case ".js": return "text/javascript"
		case ".ts": return "text/typescript"
		case ".py": return "text/x-python"
		case ".java": return "text/x-java-source"
		case ".cpp":
		case ".c": return "text/x-c"
		case ".h":
		case ".hpp": return "text/x-c"
		case ".html": return "text/html"
		case ".css": return "text/css"
		case ".json": return "application/json"
		case ".xml": return "application/xml"
		case ".yaml":
		case ".yml": return "application/x-yaml"
		case ".php": return "text/x-php"
		case ".rb": return "text/x-ruby"
		case ".go": return "text/x-go"
		case ".rs": return "text/x-rust"
		case ".swift": return "text/x-swift"
		case ".kt": return "text/x-kotlin"
		case ".scala": return "text/x-scala"
		case ".sh": return "text/x-shellscript"
		case ".bat": return "text/x-msdos-batch"
		case ".ps1": return "text/x-powershell"
		
		// Data types
		case ".csv": return "text/csv"
		case ".xls": return "application/vnd.ms-excel"
		case ".xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
		case ".sql": return "text/x-sql"
		case ".db":
		case ".sqlite": return "application/x-sqlite3"
		
		// Archive types
		case ".zip": return "application/zip"
		case ".rar": return "application/x-rar-compressed"
		case ".tar": return "application/x-tar"
		case ".gz": return "application/gzip"
		case ".7z": return "application/x-7z-compressed"
		
		// Config types
		case ".ini": return "text/plain"
		case ".conf":
		case ".config": return "text/plain"
		case ".env": return "text/plain"
		case ".properties": return "text/plain"
		
		default: return "application/octet-stream"
	}
}

function getFileCategory(extension: string): string {
	for (const [category, extensions] of Object.entries(FILE_TYPE_CATEGORIES)) {
		if (extensions.includes(extension)) {
			return category
		}
	}
	return "other"
}

function isTextFile(extension: string): boolean {
	return TEXT_FILE_EXTENSIONS.includes(extension)
}

function formatFileSize(bytes: number): string {
	if (bytes === 0) return "0 Bytes"
	
	const k = 1024
	const sizes = ["Bytes", "KB", "MB", "GB"]
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}