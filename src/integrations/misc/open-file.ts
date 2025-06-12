import * as path from "path"
import * as os from "os"
import * as vscode from "vscode"
import { arePathsEqual, getWorkspacePath } from "../../utils/path"
import { t } from "../../i18n"

export async function openImage(dataUri: string, options?: { values?: { action?: string } }) {
	const matches = dataUri.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/)
	if (!matches) {
		vscode.window.showErrorMessage(t("common:errors.invalid_data_uri"))
		return
	}
	const [, format, base64Data] = matches
	const imageBuffer = Buffer.from(base64Data, "base64")

	// Default behavior: open the image
	const tempFilePath = path.join(os.tmpdir(), `temp_image_${Date.now()}.${format}`)
	try {
		await vscode.workspace.fs.writeFile(vscode.Uri.file(tempFilePath), imageBuffer)
		// Check if this is a copy action
		if (options?.values?.action === "copy") {
			try {
				// Read the image file
				const imageData = await vscode.workspace.fs.readFile(vscode.Uri.file(tempFilePath))

				// Convert to base64 for clipboard
				const base64Image = Buffer.from(imageData).toString("base64")
				const dataUri = `data:image/${format};base64,${base64Image}`

				// Use vscode.env.clipboard to copy the data URI
				// Note: VSCode doesn't support copying binary image data directly to clipboard
				// So we copy the data URI which can be pasted in many applications
				await vscode.env.clipboard.writeText(dataUri)

				vscode.window.showInformationMessage(t("common:info.image_copied_to_clipboard"))
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				vscode.window.showErrorMessage(t("common:errors.error_copying_image", { errorMessage }))
			} finally {
				// Clean up temp file
				try {
					await vscode.workspace.fs.delete(vscode.Uri.file(tempFilePath))
				} catch {
					// Ignore cleanup errors
				}
			}
			return
		}
		await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(tempFilePath))
	} catch (error) {
		vscode.window.showErrorMessage(t("common:errors.error_opening_image", { error }))
	}
}

interface OpenFileOptions {
	create?: boolean
	content?: string
	line?: number
}

export async function openFile(filePath: string, options: OpenFileOptions = {}) {
	try {
		const workspaceRoot = getWorkspacePath()
		const homeDir = os.homedir()
		const originalFilePathForError = filePath // Keep original for error messages

		const attemptPaths: string[] = []

		if (filePath.startsWith("./")) {
			const relativePart = filePath.slice(2)
			if (workspaceRoot) {
				attemptPaths.push(path.join(workspaceRoot, relativePart))
			}
			if (homeDir) {
				const homePath = path.join(homeDir, relativePart)
				// Add home path if it's different from what might have been added via workspaceRoot
				// (e.g. if workspaceRoot itself is the home directory)
				if (!attemptPaths.includes(homePath)) {
					attemptPaths.push(homePath)
				}
			}
			// If no workspace and no home, or if paths were identical.
			if (attemptPaths.length === 0) {
				attemptPaths.push(filePath) // Try the original relative path as a last resort
			}
		} else {
			attemptPaths.push(filePath) // Assumed absolute or directly resolvable
		}

		let fileStat: vscode.FileStat | undefined
		let successfulUri: vscode.Uri | undefined

		for (const p of attemptPaths) {
			try {
				const tempUri = vscode.Uri.file(p)
				fileStat = await vscode.workspace.fs.stat(tempUri)
				successfulUri = tempUri // Path found
				break // Exit loop once a path is successfully stated
			} catch (e) {
				// Stat failed for this path, continue to the next one
			}
		}

		let uriToProcess: vscode.Uri

		if (fileStat && successfulUri) {
			// Path was found
			if (fileStat.type === vscode.FileType.Directory) {
				await vscode.commands.executeCommand("revealInExplorer", successfulUri)
				// Attempt to expand the revealed directory in the explorer.
				// This requires the explorer to have focus and the item to be selected.
				// A slight delay might sometimes be needed for focus to shift,
				// but often it works immediately after revealInExplorer.
				try {
					await vscode.commands.executeCommand("list.expand")
				} catch (expandError) {
					// Log or handle if expansion specifically fails, though often not critical
					console.warn("Could not expand directory in explorer:", expandError)
				}
				return // Done for directories
			}
			uriToProcess = successfulUri // It's an existing file
		} else {
			// Path was not found in any attempted locations. Consider creation.
			if (
				options.create &&
				!(originalFilePathForError.endsWith("/") || originalFilePathForError.endsWith("\\"))
			) {
				let pathToCreateAt: string
				if (originalFilePathForError.startsWith("./")) {
					const relativePart = originalFilePathForError.slice(2)
					if (workspaceRoot) {
						pathToCreateAt = path.join(workspaceRoot, relativePart)
					} else if (homeDir) {
						pathToCreateAt = path.join(homeDir, relativePart)
					} else {
						pathToCreateAt = originalFilePathForError // Fallback: use original relative path
					}
				} else {
					pathToCreateAt = originalFilePathForError // Absolute path
				}

				uriToProcess = vscode.Uri.file(pathToCreateAt)
				const contentToCreate = options.content || ""
				await vscode.workspace.fs.writeFile(uriToProcess, Buffer.from(contentToCreate, "utf8"))
				// File is now created, uriToProcess points to it.
			} else {
				// Not creating, or it's a directory-like path that doesn't exist.
				throw new Error(`Path does not exist: ${originalFilePathForError}`)
			}
		}

		// At this point, uriToProcess points to an existing file or a newly created file.
		// Check if the document is already open in a tab group that's not in the active editor's column
		try {
			for (const group of vscode.window.tabGroups.all) {
				const existingTab = group.tabs.find(
					(tab) =>
						tab.input instanceof vscode.TabInputText &&
						arePathsEqual(tab.input.uri.fsPath, uriToProcess.fsPath),
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

		const document = await vscode.workspace.openTextDocument(uriToProcess)
		const selection =
			options.line !== undefined
				? new vscode.Selection(Math.max(options.line - 1, 0), 0, Math.max(options.line - 1, 0), 0)
				: undefined
		await vscode.window.showTextDocument(document, {
			preview: false,
			selection,
		})
	} catch (error) {
		if (error instanceof Error) {
			vscode.window.showErrorMessage(t("common:errors.could_not_open_file", { errorMessage: error.message }))
		} else {
			vscode.window.showErrorMessage(t("common:errors.could_not_open_file_generic"))
		}
	}
}
