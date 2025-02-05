import * as path from "path"
import * as os from "os"
import * as vscode from "vscode"
import { arePathsEqual } from "../../utils/path"

export async function openImage(dataUri: string) {
	const matches = dataUri.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/)
	if (!matches) {
		vscode.window.showErrorMessage("Invalid data URI format")
		return
	}
	const [, format, base64Data] = matches
	const imageBuffer = Buffer.from(base64Data, "base64")
	const tempFilePath = path.join(os.tmpdir(), `temp_image_${Date.now()}.${format}`)
	try {
		await vscode.workspace.fs.writeFile(vscode.Uri.file(tempFilePath), imageBuffer)
		await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(tempFilePath))
	} catch (error) {
		vscode.window.showErrorMessage(`Error opening image: ${error}`)
	}
}

interface OpenFileOptions {
	create?: boolean
	content?: string
	startLine?: number
	endLine?: number
}

export async function openFile(filePath: string, options: OpenFileOptions = {}) {
	try {
		// Get workspace root
		const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
		if (!workspaceRoot) {
			throw new Error("No workspace root found")
		}

		// If path starts with ./, resolve it relative to workspace root
		const fullPath = filePath.startsWith("./") ? path.join(workspaceRoot, filePath.slice(2)) : filePath

		const uri = vscode.Uri.file(fullPath)

		// Check if file exists
		try {
			await vscode.workspace.fs.stat(uri)
		} catch {
			// File doesn't exist
			if (!options.create) {
				throw new Error("File does not exist")
			}

			// Create with provided content or empty string
			const content = options.content || ""
			await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf8"))
		}

		// Check if the document is already open in a tab group that's not in the active editor's column
		try {
			for (const group of vscode.window.tabGroups.all) {
				const existingTab = group.tabs.find(
					(tab) =>
						tab.input instanceof vscode.TabInputText && arePathsEqual(tab.input.uri.fsPath, uri.fsPath),
				)
				if (existingTab) {
					const activeColumn = vscode.window.activeTextEditor?.viewColumn
					const tabColumn = vscode.window.tabGroups.all.find((group) =>
						group.tabs.includes(existingTab),
					)?.viewColumn
					if (activeColumn && activeColumn !== tabColumn && !existingTab.isDirty) {
						await vscode.window.tabGroups.close(existingTab)
					}
					break
				}
			}
		} catch {} // not essential, sometimes tab operations fail

		const document = await vscode.workspace.openTextDocument(uri)
		const editor = await vscode.window.showTextDocument(document, { preview: false })

		// If startLine and endLine are provided, select and reveal those lines
		if (options.startLine !== undefined && options.endLine !== undefined) {
			// Validate line numbers
			const isValidLineNumber = (line?: number) => line !== undefined && line > 0 && Number.isInteger(line)

			if (isValidLineNumber(options.startLine) && isValidLineNumber(options.endLine)) {
				const startLine = Math.max(0, options.startLine! - 1)
				const endLine = Math.min(document.lineCount - 1, options.endLine! - 1)

				const startPos = new vscode.Position(startLine, 0)
				const endPos = new vscode.Position(endLine, document.lineAt(endLine).text.length)

				const range = new vscode.Range(startPos, endPos)

				// Reveal the range
				editor.revealRange(range, vscode.TextEditorRevealType.InCenter)

				// Select the range
				editor.selection = new vscode.Selection(startPos, endPos)
			} else {
				console.warn(`Invalid line numbers: start=${options.startLine}, end=${options.endLine}`)
			}
		}
	} catch (error) {
		if (error instanceof Error) {
			vscode.window.showErrorMessage(`Could not open file: ${error.message}`)
		} else {
			vscode.window.showErrorMessage(`Could not open file!`)
		}
	}
}
