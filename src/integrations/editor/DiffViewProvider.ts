import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { createDirectoriesForFile } from "../../utils/fs"
import { arePathsEqual } from "../../utils/path"
import { formatResponse } from "../../core/prompts/responses"
import { DecorationController } from "./DecorationController"
import * as diff from "diff"
import { diagnosticsToProblemsString, getNewDiagnostics } from "../diagnostics"
import stripBom from "strip-bom"

export const DIFF_VIEW_URI_SCHEME = "cline-diff"

export class DiffViewProvider {
	editType?: "create" | "modify"
	isEditing = false
	originalContent: string | undefined
	private createdDirs: string[] = []
	private documentWasOpen = false
	private originalViewColumn?: vscode.ViewColumn // Store the original view column
	private userFocusedEditorInfo?: { uri: vscode.Uri; viewColumn: vscode.ViewColumn } // Store user's focus before diff
	private originalTabState?: { uri: vscode.Uri; isPinned: boolean; viewColumn: vscode.ViewColumn; index: number } // Store original tab state if open
	private relPath?: string
	private newContent?: string
	private activeDiffEditor?: vscode.TextEditor
	private fadedOverlayController?: DecorationController
	private activeLineController?: DecorationController
	private streamedLines: string[] = []
	private preDiagnostics: [vscode.Uri, vscode.Diagnostic[]][] = []
	constructor(private cwd: string) {}

	async open(relPath: string): Promise<void> {
		this.relPath = relPath
		const fileExists = this.editType === "modify"
		const absolutePath = path.resolve(this.cwd, relPath)
		this.isEditing = true
		// if the file is already open, ensure it's not dirty before getting its contents
		if (fileExists) {
			const existingDocument = vscode.workspace.textDocuments.find((doc) =>
				arePathsEqual(doc.uri.fsPath, absolutePath),
			)
			if (existingDocument && existingDocument.isDirty) {
				await existingDocument.save()
			}
		}

		// get diagnostics before editing the file, we'll compare to diagnostics after editing to see if cline needs to fix anything
		this.preDiagnostics = vscode.languages.getDiagnostics()

		if (fileExists) {
			this.originalContent = await fs.readFile(absolutePath, "utf-8")
		} else {
			this.originalContent = ""
		}
		// for new files, create any necessary directories and keep track of new directories to delete if the user denies the operation
		this.createdDirs = await createDirectoriesForFile(absolutePath)
		// make sure the file exists before we open it
		if (!fileExists) {
			await fs.writeFile(absolutePath, "")
		}
		// if the file was already open, close it (must happen after showing the diff view since if it's the only tab the column will close)
		this.documentWasOpen = false
		// close the tab if it's open (it's already saved above)
		const tabs = vscode.window.tabGroups.all
			.map((tg) => tg.tabs)
			.flat()
			.filter(
				(tab) => tab.input instanceof vscode.TabInputText && arePathsEqual(tab.input.uri.fsPath, absolutePath),
			)
		for (const tab of tabs) {
			// Store state BEFORE closing
			if (tab.input instanceof vscode.TabInputText) {
				// Ensure it's a text tab to access URI safely
				this.originalTabState = {
					uri: tab.input.uri,
					isPinned: tab.isPinned,
					viewColumn: tab.group.viewColumn,
					index: tab.group.tabs.indexOf(tab), // Correct way to get the index
				}
				this.documentWasOpen = true // Set flag indicating we found an open tab state
				console.log("Original tab state saved:", this.originalTabState) // Optional: for debugging
			}

			if (!tab.isDirty) {
				await vscode.window.tabGroups.close(tab)
			}
			// Removed this.documentWasOpen = true from here as it's set when state is saved
		}

		// Store the currently focused editor before opening the diff
		const activeEditor = vscode.window.activeTextEditor
		if (activeEditor && activeEditor.viewColumn !== undefined) {
			// Check if viewColumn is defined
			this.userFocusedEditorInfo = {
				uri: activeEditor.document.uri,
				viewColumn: activeEditor.viewColumn, // Now guaranteed to be defined
			}
		} else {
			// If no active editor or viewColumn is undefined, reset the info
			this.userFocusedEditorInfo = undefined
		}

		this.activeDiffEditor = await this.openDiffEditor()
		this.fadedOverlayController = new DecorationController("fadedOverlay", this.activeDiffEditor)
		this.activeLineController = new DecorationController("activeLine", this.activeDiffEditor)
		// Apply faded overlay to all lines initially
		this.fadedOverlayController.addLines(0, this.activeDiffEditor.document.lineCount)
		this.scrollEditorToLine(0) // will this crash for new files?
		this.streamedLines = []
	}

	async update(accumulatedContent: string, isFinal: boolean) {
		if (!this.relPath || !this.activeLineController || !this.fadedOverlayController) {
			throw new Error("Required values not set")
		}
		this.newContent = accumulatedContent
		const accumulatedLines = accumulatedContent.split("\n")
		if (!isFinal) {
			accumulatedLines.pop() // remove the last partial line only if it's not the final update
		}

		const diffEditor = this.activeDiffEditor
		const document = diffEditor?.document
		if (!diffEditor || !document) {
			throw new Error("User closed text editor, unable to edit file...")
		}

		// Place cursor at the beginning of the diff editor to keep it out of the way of the stream animation
		const beginningOfDocument = new vscode.Position(0, 0)
		diffEditor.selection = new vscode.Selection(beginningOfDocument, beginningOfDocument)

		const endLine = accumulatedLines.length
		// Replace all content up to the current line with accumulated lines
		const edit = new vscode.WorkspaceEdit()
		const rangeToReplace = new vscode.Range(0, 0, endLine + 1, 0)
		const contentToReplace = accumulatedLines.slice(0, endLine + 1).join("\n") + "\n"
		edit.replace(document.uri, rangeToReplace, this.stripAllBOMs(contentToReplace))
		await vscode.workspace.applyEdit(edit)
		// Update decorations
		this.activeLineController.setActiveLine(endLine)
		this.fadedOverlayController.updateOverlayAfterLine(endLine, document.lineCount)
		// Scroll to the current line
		this.scrollEditorToLine(endLine)

		// Update the streamedLines with the new accumulated content
		this.streamedLines = accumulatedLines
		if (isFinal) {
			// Handle any remaining lines if the new content is shorter than the original
			if (this.streamedLines.length < document.lineCount) {
				const edit = new vscode.WorkspaceEdit()
				edit.delete(document.uri, new vscode.Range(this.streamedLines.length, 0, document.lineCount, 0))
				await vscode.workspace.applyEdit(edit)
			}
			// Preserve empty last line if original content had one
			const hasEmptyLastLine = this.originalContent?.endsWith("\n")
			if (hasEmptyLastLine && !accumulatedContent.endsWith("\n")) {
				accumulatedContent += "\n"
			}
			// Apply the final content
			const finalEdit = new vscode.WorkspaceEdit()
			finalEdit.replace(
				document.uri,
				new vscode.Range(0, 0, document.lineCount, 0),
				this.stripAllBOMs(accumulatedContent),
			)
			await vscode.workspace.applyEdit(finalEdit)
			// Clear all decorations at the end (after applying final edit)
			this.fadedOverlayController.clear()
			this.activeLineController.clear()
		}
	}

	async saveChanges(): Promise<{
		newProblemsMessage: string | undefined
		userEdits: string | undefined
		finalContent: string | undefined
	}> {
		if (!this.relPath || !this.newContent || !this.activeDiffEditor) {
			return { newProblemsMessage: undefined, userEdits: undefined, finalContent: undefined }
		}
		const absolutePath = path.resolve(this.cwd, this.relPath)
		const updatedDocument = this.activeDiffEditor.document
		const editedContent = updatedDocument.getText()
		if (updatedDocument.isDirty) {
			await updatedDocument.save()
		}

		await vscode.window.showTextDocument(vscode.Uri.file(absolutePath), { preview: false })
		await this.closeAllDiffViews()

		// Restore original tab state if it existed, otherwise handle focus normally
		if (this.originalTabState) {
			await this._restoreOriginalTabState()
		} else {
			// Fallback to old focus logic only if no original tab state was saved (e.g., new file)
			await this._focusOriginalDocument(absolutePath, undefined) // Pass undefined as viewColumn is part of originalTabState now
		}

		/*
		Getting diagnostics before and after the file edit is a better approach than
		automatically tracking problems in real-time. This method ensures we only
		report new problems that are a direct result of this specific edit.
		Since these are new problems resulting from Roo's edit, we know they're
		directly related to the work he's doing. This eliminates the risk of Roo
		going off-task or getting distracted by unrelated issues, which was a problem
		with the previous auto-debug approach. Some users' machines may be slow to
		update diagnostics, so this approach provides a good balance between automation
		and avoiding potential issues where Roo might get stuck in loops due to
		outdated problem information. If no new problems show up by the time the user
		accepts the changes, they can always debug later using the '@problems' mention.
		This way, Roo only becomes aware of new problems resulting from his edits
		and can address them accordingly. If problems don't change immediately after
		applying a fix, won't be notified, which is generally fine since the
		initial fix is usually correct and it may just take time for linters to catch up.
		*/
		const postDiagnostics = vscode.languages.getDiagnostics()
		const newProblems = await diagnosticsToProblemsString(
			getNewDiagnostics(this.preDiagnostics, postDiagnostics),
			[
				vscode.DiagnosticSeverity.Error, // only including errors since warnings can be distracting (if user wants to fix warnings they can use the @problems mention)
			],
			this.cwd,
		) // will be empty string if no errors
		const newProblemsMessage =
			newProblems.length > 0 ? `\n\nNew problems detected after saving the file:\n${newProblems}` : ""

		// If the edited content has different EOL characters, we don't want to show a diff with all the EOL differences.
		const newContentEOL = this.newContent.includes("\r\n") ? "\r\n" : "\n"
		const normalizedEditedContent = editedContent.replace(/\r\n|\n/g, newContentEOL).trimEnd() + newContentEOL // trimEnd to fix issue where editor adds in extra new line automatically
		// just in case the new content has a mix of varying EOL characters
		const normalizedNewContent = this.newContent.replace(/\r\n|\n/g, newContentEOL).trimEnd() + newContentEOL
		if (normalizedEditedContent !== normalizedNewContent) {
			// user made changes before approving edit
			const userEdits = formatResponse.createPrettyPatch(
				this.relPath.toPosix(),
				normalizedNewContent,
				normalizedEditedContent,
			)
			return { newProblemsMessage, userEdits, finalContent: normalizedEditedContent }
		} else {
			// no changes to cline's edits
			return { newProblemsMessage, userEdits: undefined, finalContent: normalizedEditedContent }
		}
	}

	async revertChanges(): Promise<void> {
		if (!this.relPath || !this.activeDiffEditor) {
			return
		}
		const fileExists = this.editType === "modify"
		const updatedDocument = this.activeDiffEditor.document
		const absolutePath = path.resolve(this.cwd, this.relPath)
		if (!fileExists) {
			if (updatedDocument.isDirty) {
				await updatedDocument.save()
			}
			await this.closeAllDiffViews()
			await fs.unlink(absolutePath)
			// Remove only the directories we created, in reverse order
			for (let i = this.createdDirs.length - 1; i >= 0; i--) {
				await fs.rmdir(this.createdDirs[i])
				console.log(`Directory ${this.createdDirs[i]} has been deleted.`)
			}
			console.log(`File ${absolutePath} has been deleted.`)
		} else {
			// revert document
			const edit = new vscode.WorkspaceEdit()
			const fullRange = new vscode.Range(
				updatedDocument.positionAt(0),
				updatedDocument.positionAt(updatedDocument.getText().length),
			)
			edit.replace(updatedDocument.uri, fullRange, this.originalContent ?? "")
			// Apply the edit and save, since contents shouldnt have changed this wont show in local history unless of course the user made changes and saved during the edit
			await vscode.workspace.applyEdit(edit)
			await updatedDocument.save()
			console.log(`File ${absolutePath} has been reverted to its original content.`)

			// Close the diff view first
			await this.closeAllDiffViews()

			// Restore original tab state if it existed, otherwise handle focus normally
			if (this.originalTabState) {
				await this._restoreOriginalTabState()
			} else {
				// Fallback to old focus logic only if no original tab state was saved (e.g., new file)
				await this._focusOriginalDocument(absolutePath, undefined) // Pass undefined as viewColumn is part of originalTabState now
			}
		}
		// edit is done
		await this.reset()
	}

	private async closeAllDiffViews() {
		const tabs = vscode.window.tabGroups.all
			.flatMap((tg) => tg.tabs)
			.filter(
				(tab) =>
					tab.input instanceof vscode.TabInputTextDiff &&
					tab.input?.original?.scheme === DIFF_VIEW_URI_SCHEME,
			)
		for (const tab of tabs) {
			// trying to close dirty views results in save popup
			if (!tab.isDirty) {
				await vscode.window.tabGroups.close(tab)
			}
		}
	}

	private async openDiffEditor(): Promise<vscode.TextEditor> {
		if (!this.relPath) {
			throw new Error("No file path set")
		}
		const uri = vscode.Uri.file(path.resolve(this.cwd, this.relPath))
		// If this diff editor is already open (ie if a previous write file was interrupted) then we should activate that instead of opening a new diff
		const diffTab = vscode.window.tabGroups.all
			.flatMap((group) => group.tabs)
			.find(
				(tab) =>
					tab.input instanceof vscode.TabInputTextDiff &&
					tab.input?.original?.scheme === DIFF_VIEW_URI_SCHEME &&
					arePathsEqual(tab.input.modified.fsPath, uri.fsPath),
			)
		if (diffTab && diffTab.input instanceof vscode.TabInputTextDiff) {
			const editor = await vscode.window.showTextDocument(diffTab.input.modified)
			return editor
		}
		// Open new diff editor
		return new Promise<vscode.TextEditor>((resolve, reject) => {
			const fileName = path.basename(uri.fsPath)
			const fileExists = this.editType === "modify"
			const disposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
				if (editor && arePathsEqual(editor.document.uri.fsPath, uri.fsPath)) {
					disposable.dispose()
					// Diff editor is now active
					// Pin the diff editor if the original tab was pinned
					const pinAndMoveIfNeeded = async () => {
						if (this.originalTabState?.isPinned) {
							try {
								await vscode.commands.executeCommand("workbench.action.pinEditor")
								console.log("Diff editor pinned.")
								// Add a small delay after pinning before moving
								await new Promise((resolve) => setTimeout(resolve, 50))

								// Move the pinned diff editor to the original index
								const targetGroup = vscode.window.tabGroups.all.find(
									(group) => group.viewColumn === this.originalTabState?.viewColumn,
								)
								const index = this.originalTabState.index
								if (targetGroup && index >= 0) {
									// Check if index is still valid after potential async operations
									if (index < targetGroup.tabs.length) {
										await vscode.commands.executeCommand("moveActiveEditor", {
											to: "position",
											value: index + 1, // 1-based index
										})
										console.log(`Diff editor moved to index ${index}.`)
									} else {
										console.warn(
											`Diff editor move skipped: Index ${index} out of bounds after pinning/delay.`,
										)
									}
								} else {
									console.warn(
										`Could not move diff editor: Invalid index (${index}) or target group not found.`,
									)
								}
							} catch (err) {
								console.error("Failed to pin or move diff editor:", err)
							}
						}
						// Resolve the promise regardless of pin/move success
						resolve(editor)
					}
					pinAndMoveIfNeeded() // Execute async pin/move logic
				}
			})
			const options: vscode.TextDocumentShowOptions = {
				// preserveFocus: true, // Removed to prevent focus issues
			}
			// Use viewColumn from originalTabState if available
			if (this.originalTabState?.viewColumn !== undefined) {
				options.viewColumn = this.originalTabState.viewColumn
			} else if (this.originalViewColumn !== undefined) {
				// Fallback to originalViewColumn if originalTabState is not set (e.g., file wasn't open)
				options.viewColumn = this.originalViewColumn
			}

			// Execute the diff command first
			vscode.commands.executeCommand(
				"vscode.diff",
				vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME}:${fileName}`).with({
					query: Buffer.from(this.originalContent ?? "").toString("base64"),
				}),
				uri,
				`${fileName}: ${fileExists ? "Original ↔ Roo's Changes" : "New File"} (Editable)`,
				options, // Add options here
			)
			// This may happen on very slow machines ie project idx
			setTimeout(() => {
				disposable.dispose()
				reject(new Error("Failed to open diff editor, please try again..."))
			}, 10_000)
		})
	}

	private scrollEditorToLine(line: number) {
		if (this.activeDiffEditor) {
			const scrollLine = line + 4
			this.activeDiffEditor.revealRange(
				new vscode.Range(scrollLine, 0, scrollLine, 0),
				vscode.TextEditorRevealType.InCenter,
			)
		}
	}

	scrollToFirstDiff() {
		if (!this.activeDiffEditor) {
			return
		}
		const currentContent = this.activeDiffEditor.document.getText()
		const diffs = diff.diffLines(this.originalContent || "", currentContent)
		let lineCount = 0
		for (const part of diffs) {
			if (part.added || part.removed) {
				// Found the first diff, scroll to it
				this.activeDiffEditor.revealRange(
					new vscode.Range(lineCount, 0, lineCount, 0),
					vscode.TextEditorRevealType.InCenter,
				)
				return
			}
			if (!part.removed) {
				lineCount += part.count || 0
			}
		}
	}

	private stripAllBOMs(input: string): string {
		let result = input
		let previous
		do {
			previous = result
			result = stripBom(result)
		} while (result !== previous)
		return result
	}

	private async _focusOriginalDocument(
		absolutePath: string,
		_viewColumn: vscode.ViewColumn | undefined, // Prefixed as unused now
	): Promise<void> {
		let focusRestoredOrHandled = false

		// Priority 1: Try to restore focus to the editor the user had focused *before* the diff started
		if (this.userFocusedEditorInfo) {
			try {
				await vscode.window.showTextDocument(this.userFocusedEditorInfo.uri, {
					viewColumn: this.userFocusedEditorInfo.viewColumn,
					preserveFocus: false, // Force focus back
				})
				console.log("Focus restored to originally focused editor:", this.userFocusedEditorInfo.uri.fsPath)
				focusRestoredOrHandled = true // Mark as handled
			} catch (error) {
				console.warn("Failed to restore focus to originally focused editor, proceeding with fallbacks:", error)
				// Focus restoration failed, fallbacks might be needed below
			}
		} else {
			// If no editor was focused initially, we still might need to handle new files
			console.log("No initial editor focus detected, checking for new file case.")
			// Let the new file logic below handle it.
		}

		// Handle newly created files *regardless* of initial focus state or restoration success
		if (!this.documentWasOpen) {
			try {
				await vscode.window.showTextDocument(vscode.Uri.file(absolutePath), {
					preview: false, // Ensure it's not a preview tab
					viewColumn: vscode.ViewColumn.Active, // Open in the active column
					preserveFocus: false, // Force focus
				})
				console.log("Opened and focused newly created file:", absolutePath)
				focusRestoredOrHandled = true // Mark as handled
			} catch (error) {
				console.error("Failed to show newly created document:", error)
				// Even if it fails, we consider the attempt 'handled' for new files.
				focusRestoredOrHandled = true
			}
		}

		// Fallback logic for existing documents is now handled by _restoreOriginalTabState
		// Keep the final log message for clarity
		else if (!focusRestoredOrHandled) {
			console.log(
				"No specific focus action taken by _focusOriginalDocument (focus restore might have succeeded, or it was a new file handled above).",
			)
		}
	}

	private async _restoreOriginalTabState(): Promise<void> {
		if (!this.originalTabState) {
			console.log("No original tab state to restore.")
			return
		}

		console.log("Attempting to restore original tab state:", this.originalTabState)
		const { uri, viewColumn, isPinned, index } = this.originalTabState

		try {
			// 1. Show the document in the correct view column
			// Prefix 'editor' as it's not directly used after assignment (focus happens implicitly)
			const _editor = await vscode.window.showTextDocument(uri, {
				viewColumn: viewColumn,
				preview: false, // Ensure it's not a preview tab
				preserveFocus: false, // Ensure this editor gets focus initially for commands
			})
			console.log("Document shown:", uri.fsPath)

			// Small delay to allow VS Code to potentially update tab state after showing
			await new Promise((resolve) => setTimeout(resolve, 100)) // 100ms delay

			// 2. Pin the editor if necessary
			if (isPinned) {
				await vscode.commands.executeCommand("workbench.action.pinEditor")
				console.log("Editor pinned.")
				// Another small delay might be needed after pinning before moving
				await new Promise((resolve) => setTimeout(resolve, 50))
			}

			// 3. Move the editor to the original index
			// Ensure the target index is valid. VS Code's move command is 1-based.
			// We need to find the current group to check tab count.
			const targetGroup = vscode.window.tabGroups.all.find((group) => group.viewColumn === viewColumn)
			if (targetGroup && index >= 0 && index < targetGroup.tabs.length) {
				// The 'moveActiveEditor' command uses 1-based index for 'value'
				await vscode.commands.executeCommand("moveActiveEditor", { to: "position", value: index + 1 })
				console.log(`Editor moved to index ${index}.`)
			} else {
				console.warn(`Could not move editor: Invalid index (${index}) or target group not found.`)
			}

			// 4. Restore original user focus if it was different from the restored tab
			if (this.userFocusedEditorInfo && !arePathsEqual(this.userFocusedEditorInfo.uri.fsPath, uri.fsPath)) {
				try {
					await vscode.window.showTextDocument(this.userFocusedEditorInfo.uri, {
						viewColumn: this.userFocusedEditorInfo.viewColumn,
						preserveFocus: false, // Force focus back
					})
					console.log(
						"Focus restored to originally focused editor (after tab state restore):",
						this.userFocusedEditorInfo.uri.fsPath,
					)
				} catch (focusError) {
					console.warn("Failed to restore original user focus after tab state restore:", focusError)
					// If restoring original focus fails, at least the target tab should be focused.
					await vscode.window.showTextDocument(uri, { viewColumn: viewColumn, preserveFocus: false })
				}
			} else {
				// Ensure the restored tab keeps focus if no other editor was focused or if it was the focused one
				await vscode.window.showTextDocument(uri, { viewColumn: viewColumn, preserveFocus: false })
				console.log("Focus kept on restored tab:", uri.fsPath)
			}
		} catch (error) {
			console.error("Error restoring original tab state:", error)
			// Fallback: Just try to show the document without state restoration
			try {
				await vscode.window.showTextDocument(uri, { viewColumn: viewColumn, preview: false })
			} catch (fallbackError) {
				console.error("Fallback showTextDocument also failed:", fallbackError)
			}
		}
	}

	// close editor if open?
	async reset() {
		this.editType = undefined
		this.isEditing = false
		this.originalContent = undefined
		this.createdDirs = []
		this.documentWasOpen = false
		this.originalViewColumn = undefined // Reset stored view column - Keep for potential fallback? Replaced by originalTabState.viewColumn mostly.
		this.originalTabState = undefined // Reset stored tab state
		this.userFocusedEditorInfo = undefined // Reset stored user focus info
		this.activeDiffEditor = undefined
		this.fadedOverlayController = undefined
		this.activeLineController = undefined
		this.streamedLines = []
		this.preDiagnostics = []
	}
}
