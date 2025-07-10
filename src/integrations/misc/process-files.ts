import * as vscode from "vscode"
import fs from "fs/promises"
import * as path from "path"
import { getMimeType, isImageExtension } from "../../utils/mimeTypes"
import { FileAttachment, FileReference, ProcessedFiles } from "../../shared/FileTypes"

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

// Known binary file extensions to skip upfront
const BINARY_EXTENSIONS = [
	// Executables & Libraries
	"exe",
	"dll",
	"so",
	"dylib",
	"app",
	"deb",
	"rpm",
	"dmg",
	"pkg",
	"msi",
	// Archives
	"zip",
	"tar",
	"gz",
	"bz2",
	"7z",
	"rar",
	"jar",
	"war",
	"ear",
	// Media
	"mp3",
	"mp4",
	"avi",
	"mov",
	"wmv",
	"flv",
	"mkv",
	"webm",
	"ogg",
	"wav",
	"flac",
	// Documents (binary formats)
	"pdf",
	"doc",
	"docx",
	"xls",
	"xlsx",
	"ppt",
	"pptx",
	"odt",
	"ods",
	"odp",
	// Databases
	"db",
	"sqlite",
	"mdb",
	// Other binary formats
	"pyc",
	"pyo",
	"class",
	"o",
	"a",
	"lib",
	"node",
	"wasm",
]

export async function selectFiles(): Promise<ProcessedFiles> {
	const options: vscode.OpenDialogOptions = {
		canSelectMany: true,
		openLabel: "Select",
		filters: {
			"All Files": ["*"],
			Images: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg", "ico"],
		},
	}

	const fileUris = await vscode.window.showOpenDialog(options)

	if (!fileUris || fileUris.length === 0) {
		return { images: [], files: [] }
	}

	const images: FileReference[] = []
	const files: FileAttachment[] = []

	await Promise.all(
		fileUris.map(async (uri) => {
			const filePath = uri.fsPath
			const ext = path.extname(filePath).toLowerCase().substring(1)
			const fileName = path.basename(filePath)

			// Check file size
			const stats = await fs.stat(filePath)
			if (stats.size > MAX_FILE_SIZE) {
				vscode.window.showWarningMessage(`File too large: ${fileName} (max 20MB)`)
				return
			}

			if (isImageExtension(ext)) {
				// Store image reference instead of loading into memory
				const mimeType = getMimeType(filePath)
				images.push({
					path: fileName,
					uri: uri.toString(),
					size: stats.size,
					mimeType: mimeType,
				})
			} else if (BINARY_EXTENSIONS.includes(ext)) {
				// Skip known binary files
				vscode.window.showWarningMessage(`Cannot attach binary file: ${fileName}`)
			} else {
				// Try to read as text file
				try {
					const content = await fs.readFile(filePath, "utf-8")
					// Additional check: if the content has null bytes, it's likely binary
					if (content.includes("\0")) {
						vscode.window.showWarningMessage(`File appears to be binary: ${fileName}`)
					} else {
						files.push({
							path: fileName,
							content: content,
							type: ext || "txt", // Default to 'txt' if no extension
						})
					}
				} catch (error) {
					// File couldn't be read as UTF-8, likely binary
					vscode.window.showWarningMessage(`Cannot read file as text: ${fileName}`)
				}
			}
		}),
	)

	return { images, files }
}

/**
 * Convert file references to data URLs when needed
 * This should be called only when actually sending the images
 */
export async function convertImageReferencesToDataUrls(images: FileReference[]): Promise<string[]> {
	const dataUrls: string[] = []

	for (const image of images) {
		try {
			const uri = vscode.Uri.parse(image.uri)
			const buffer = await fs.readFile(uri.fsPath)
			const base64 = buffer.toString("base64")
			const dataUrl = `data:${image.mimeType};base64,${base64}`
			dataUrls.push(dataUrl)
		} catch (error) {
			vscode.window.showWarningMessage(`Failed to read image: ${image.path}`)
		}
	}

	return dataUrls
}

// Keep the original selectImages function for backward compatibility
export async function selectImages(): Promise<string[]> {
	const result = await selectFiles()
	// Convert references to data URLs for backward compatibility
	return convertImageReferencesToDataUrls(result.images)
}
