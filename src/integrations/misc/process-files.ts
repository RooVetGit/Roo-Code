import * as vscode from "vscode"
import fs from "fs/promises"
import * as path from "path"

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg", "ico"]
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

export async function selectFiles(): Promise<{
	images: string[]
	files: Array<{ path: string; content: string; type: string }>
}> {
	const options: vscode.OpenDialogOptions = {
		canSelectMany: true,
		openLabel: "Select",
		filters: {
			"All Files": ["*"],
			Images: IMAGE_EXTENSIONS,
		},
	}

	const fileUris = await vscode.window.showOpenDialog(options)

	if (!fileUris || fileUris.length === 0) {
		return { images: [], files: [] }
	}

	const images: string[] = []
	const files: Array<{ path: string; content: string; type: string }> = []

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

			if (IMAGE_EXTENSIONS.includes(ext)) {
				// Process as image
				const buffer = await fs.readFile(filePath)
				const base64 = buffer.toString("base64")
				const mimeType = getMimeType(filePath)
				const dataUrl = `data:${mimeType};base64,${base64}`
				images.push(dataUrl)
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

// Keep the original selectImages function for backward compatibility
export async function selectImages(): Promise<string[]> {
	const result = await selectFiles()
	return result.images
}

function getMimeType(filePath: string): string {
	const ext = path.extname(filePath).toLowerCase()
	switch (ext) {
		case ".png":
			return "image/png"
		case ".jpeg":
		case ".jpg":
			return "image/jpeg"
		case ".webp":
			return "image/webp"
		default:
			throw new Error(`Unsupported image type: ${ext}`)
	}
}
