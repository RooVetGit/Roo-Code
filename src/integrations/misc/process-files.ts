import * as vscode from "vscode"
import fs from "fs/promises"
import * as path from "path"

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"]
const TEXT_FILE_EXTENSIONS = ["xml", "json", "txt", "log", "md", "csv", "tsv", "yaml", "yml", "ini", "cfg", "conf"]
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

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
			"Text Files": TEXT_FILE_EXTENSIONS,
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
				// Process as image (existing logic)
				const buffer = await fs.readFile(filePath)
				const base64 = buffer.toString("base64")
				const mimeType = getMimeType(filePath)
				const dataUrl = `data:${mimeType};base64,${base64}`
				images.push(dataUrl)
			} else {
				// Process as text file
				try {
					const content = await fs.readFile(filePath, "utf-8")
					files.push({
						path: fileName,
						content: content,
						type: ext,
					})
				} catch (error) {
					// Binary file or read error
					vscode.window.showWarningMessage(`Could not read file: ${fileName}`)
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
