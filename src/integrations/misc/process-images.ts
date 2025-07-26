import * as vscode from "vscode"
import fs from "fs/promises"
import { getMimeType } from "../../shared/utils/media"

export async function selectImages(): Promise<string[]> {
	const options: vscode.OpenDialogOptions = {
		canSelectMany: true,
		openLabel: "Select",
		filters: {
			Images: ["png", "jpg", "jpeg", "webp"], // supported by anthropic and openrouter
		},
	}

	const fileUris = await vscode.window.showOpenDialog(options)

	if (!fileUris || fileUris.length === 0) {
		return []
	}

	return await Promise.all(
		fileUris.map(async (uri) => {
			const imagePath = uri.fsPath
			const buffer = await fs.readFile(imagePath)
			const base64 = buffer.toString("base64")
			const mimeType = getMimeType(imagePath)
			if (!mimeType) {
				throw new Error(`Unsupported file type: ${imagePath}`)
			}
			const dataUrl = `data:${mimeType};base64,${base64}`
			return dataUrl
		}),
	)
}
