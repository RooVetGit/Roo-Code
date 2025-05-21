import * as vscode from "vscode"
import { TextDocument, TextDocumentShowOptions, ViewColumn } from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import * as diff from "diff"
import stripBom from "strip-bom"

import { createDirectoriesForFile } from "../../utils/fs"
import { arePathsEqual } from "../../utils/path"
import { formatResponse } from "../../core/prompts/responses"
import { diagnosticsToProblemsString, getNewDiagnostics } from "../diagnostics"

import { DecorationController } from "./DecorationController"
import { ClineProvider } from "../../core/webview/ClineProvider"

export const DIFF_VIEW_URI_SCHEME = "cline-diff"

// TODO: https://github.com/cline/cline/pull/3354
export class DiffViewProvider {
	editType?: "create" | "modify"
	isEditing = false
	originalContent: string | undefined
	private createdDirs: string[] = []
	private documentWasOpen = false
	private relPath?: string
	private newContent?: string
	private activeDiffEditor?: vscode.TextEditor
	private fadedOverlayController?: DecorationController
	private activeLineController?: DecorationController
	private streamedLines: string[] = []
	private preDiagnostics: [vscode.Uri, vscode.Diagnostic[]][] = []
	private rooOpenedTabs: Set<string> = new Set()
	private preserveFocus: boolean | undefined = undefined
	private autoApproval: boolean | undefined = undefined
	private autoFocus: boolean | undefined = undefined
	private autoCloseTabs: boolean = false
	// have to set the default view column to -1 since we need to set it in the initialize method and during initialization the enum ViewColumn is undefined
	private viewColumn: ViewColumn = -1 // ViewColumn.Active
	private userInteractionListeners: vscode.Disposable[] = []
	private suppressInteractionFlag: boolean = false

	constructor(private cwd: string) {}

	public async initialize() {
		const provider = ClineProvider.getVisibleInstance()
		// If autoApproval is enabled, we want to preserve focus if autoFocus is disabled
		// AutoApproval is enabled when the user has set "alwaysAllowWrite" and "autoApprovalEnabled" to true
		// AutoFocus is enabled when the user has set "diffView.autoFocus" to true, this is the default.
		// If autoFocus is disabled, we want to preserve focus on the diff editor we are working on.
		// we have to check for null values for the first initialization
		if (this.autoApproval === undefined) {
			this.autoApproval =
				(provider?.getValue("autoApprovalEnabled") && provider?.getValue("alwaysAllowWrite")) ?? false
		}
		if (this.autoFocus === undefined) {
			this.autoFocus = vscode.workspace.getConfiguration("roo-cline").get<boolean>("diffViewAutoFocus", true)
		}
		this.preserveFocus = this.autoApproval && !this.autoFocus
		this.autoCloseTabs = vscode.workspace.getConfiguration("roo-cline").get<boolean>("autoCloseRooTabs", false)
		// Track currently visible editors and active editor for focus restoration and tab cleanup
		this.rooOpenedTabs.clear()
	}

	private async showTextDocumentSafe({
		uri,
		textDocument,
		options,
	}: {
		uri?: vscode.Uri
		textDocument?: TextDocument
		options?: TextDocumentShowOptions
	}) {
		this.suppressInteractionFlag = true
		// If the uri is already open, we want to focus it
		if (uri) {
			const editor = await vscode.window.showTextDocument(uri, options)
			this.suppressInteractionFlag = false
			return editor
		}
		// If the textDocument is already open, we want to focus it
		if (textDocument) {
			const editor = await vscode.window.showTextDocument(textDocument, options)
			this.suppressInteractionFlag = false
			return editor
		}
		// If the textDocument is not open and not able to be opened, we just reset the suppressInteractionFlag
		this.suppressInteractionFlag = false
		return null
	}

	/**
	 * Resets the auto-focus listeners to prevent memory leaks.
	 * This is called when the diff editor is closed or when the user interacts with other editors.
	 */
	private resetAutoFocusListeners() {
		this.userInteractionListeners.forEach((listener) => listener.dispose())
		this.userInteractionListeners = []
	}

	/**
	 * Disables auto-focus on the diff editor after user interaction.
	 * This is to prevent the diff editor from stealing focus when the user interacts with other editors or tabs.
	 */
	public disableAutoFocusAfterUserInteraction() {
		this.resetAutoFocusListeners()
		// if auto approval is disabled or auto focus is disabled, we don't need to add listeners
		if (!this.autoApproval || !this.autoFocus) {
			return
		}
		// then add new listeners
		const changeTextEditorSelectionListener = vscode.window.onDidChangeTextEditorSelection((_e) => {
			// If the change was done programmatically, or if there is actually no editor or the user did not allow auto approval, we don't want to suppress focus
			if (this.suppressInteractionFlag) {
				// If the user is interacting with the diff editor, we don't want to suppress focus
				// If the user is interacting with another editor, we want to suppress focus
				return
			}
			// Consider this a "user interaction"
			this.preserveFocus = true
			this.autoFocus = false
			// remove the listeners since we don't need them anymore
			this.resetAutoFocusListeners()
		}, this)
		const changeActiveTextEditorListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
			// If the change was done programmatically, or if there is actually no editor or the user did not allow auto approval, we don't want to suppress focus
			if (this.suppressInteractionFlag || !editor) {
				// If the user is interacting with the diff editor, we don't want to suppress focus
				// If the user is interacting with another editor, we want to suppress focus
				return
			}
			// Consider this a "user interaction"
			this.preserveFocus = true
			this.autoFocus = false
			// remove the listeners since we don't need them anymore
			this.resetAutoFocusListeners()
		}, this)
		const changeTabListener = vscode.window.tabGroups.onDidChangeTabs((_e) => {
			// Some tab was added/removed/changed
			// If the change was done programmatically, or the user did not allow auto approval, we don't want to suppress focus
			if (this.suppressInteractionFlag) {
				return
			}
			this.preserveFocus = true
			this.autoFocus = false
			// remove the listeners since we don't need them anymore
			this.resetAutoFocusListeners()
		}, this)
		const changeTabGroupListener = vscode.window.tabGroups.onDidChangeTabGroups((_e) => {
			// Tab group layout changed (e.g., split view)
			// If the change was done programmatically, or the user did not allow auto approval, we don't want to suppress focus
			if (this.suppressInteractionFlag) {
				return
			}
			this.preserveFocus = true
			this.autoFocus = false
			// remove the listeners since we don't need them anymore
			this.resetAutoFocusListeners()
		}, this)
		this.userInteractionListeners.push(
			changeTextEditorSelectionListener,
			changeActiveTextEditorListener,
			changeTabListener,
			changeTabGroupListener,
		)
	}

	/**
	 * Opens a diff editor for the given relative path, optionally in a specific viewColumn.
	 * @param relPath The relative file path to open.
	 * @param viewColumn (Optional) The VSCode editor group to open the diff in.
	 */
	async open(relPath: string, viewColumn: ViewColumn): Promise<void> {
		this.viewColumn = viewColumn
		this.disableAutoFocusAfterUserInteraction()
		// Set the edit type based on the file existence
		this.relPath = relPath
		const fileExists = this.editType === "modify"
		const absolutePath = path.resolve(this.cwd, relPath)
		this.isEditing = true

		// If the file is already open, ensure it's not dirty before getting its
		// contents.
		if (fileExists) {
			const existingDocument = vscode.workspace.textDocuments.find((doc) =>
				arePathsEqual(doc.uri.fsPath, absolutePath),
			)

			if (existingDocument && existingDocument.isDirty) {
				await existingDocument.save()
			}
		}

		// Get diagnostics before editing the file, we'll compare to diagnostics
		// after editing to see if cline needs to fix anything.
		this.preDiagnostics = vscode.languages.getDiagnostics()

		if (fileExists) {
			this.originalContent = await fs.readFile(absolutePath, "utf-8")
		} else {
			this.originalContent = ""
		}

		// For new files, create any necessary directories and keep track of new
		// directories to delete if the user denies the operation.
		this.createdDirs = await createDirectoriesForFile(absolutePath)

		// Make sure the file exists before we open it.
		if (!fileExists) {
			await fs.writeFile(absolutePath, "")
		}

		// If the file was already open, close it (must happen after showing the
		// diff view since if it's the only tab the column will close).
		this.documentWasOpen =
			vscode.window.tabGroups.all
				.map((tg) => tg.tabs)
				.flat()
				.filter(
					(tab) =>
						tab.input instanceof vscode.TabInputText && arePathsEqual(tab.input.uri.fsPath, absolutePath),
				).length > 0

		this.activeDiffEditor = await this.openDiffEditor()
		this.fadedOverlayController = new DecorationController("fadedOverlay", this.activeDiffEditor)
		this.activeLineController = new DecorationController("activeLine", this.activeDiffEditor)
		// Apply faded overlay to all lines initially.
		this.fadedOverlayController.addLines(0, this.activeDiffEditor.document.lineCount)
		this.scrollEditorToLine(0) // Will this crash for new files?
		this.streamedLines = []
	}

	/**
	 * Opens a file editor and tracks it as opened by Roo if not already open.
	 */
	private async showAndTrackEditor(uri: vscode.Uri, options: vscode.TextDocumentShowOptions = {}) {
		const editor = await this.showTextDocumentSafe({ uri, options })
		if (this.autoCloseTabs && !this.documentWasOpen) {
			this.rooOpenedTabs.add(uri.toString())
		}
		return editor
	}

	async update(accumulatedContent: string, isFinal: boolean) {
		if (!this.relPath || !this.activeLineController || !this.fadedOverlayController) {
			throw new Error("Required values not set")
		}

		this.newContent = accumulatedContent
		const accumulatedLines = accumulatedContent.split("\n")

		if (!isFinal) {
			accumulatedLines.pop() // Remove the last partial line only if it's not the final update.
		}

		const diffEditor = this.activeDiffEditor
		const document = diffEditor?.document

		if (!diffEditor || !document) {
			throw new Error("User closed text editor, unable to edit file...")
		}

		// Place cursor at the beginning of the diff editor to keep it out of
		// the way of the stream animation.
		const beginningOfDocument = new vscode.Position(0, 0)
		diffEditor.selection = new vscode.Selection(beginningOfDocument, beginningOfDocument)

		const endLine = accumulatedLines.length
		// Replace all content up to the current line with accumulated lines.
		const edit = new vscode.WorkspaceEdit()
		const rangeToReplace = new vscode.Range(0, 0, endLine, 0)
		const contentToReplace = accumulatedLines.slice(0, endLine + 1).join("\n") + "\n"
		edit.replace(document.uri, rangeToReplace, this.stripAllBOMs(contentToReplace))
		await vscode.workspace.applyEdit(edit)
		// Update decorations.
		this.activeLineController.setActiveLine(endLine)
		this.fadedOverlayController.updateOverlayAfterLine(endLine, document.lineCount)
		// Scroll to the current line.
		const ranges = this.activeDiffEditor?.visibleRanges
		if (ranges && ranges.length > 0 && ranges[0].start.line < endLine && ranges[0].end.line > endLine) {
			this.scrollEditorToLine(endLine)
		}

		// Update the streamedLines with the new accumulated content.
		this.streamedLines = accumulatedLines

		if (isFinal) {
			// Handle any remaining lines if the new content is shorter than the
			// original.
			if (this.streamedLines.length < document.lineCount) {
				const edit = new vscode.WorkspaceEdit()
				edit.delete(document.uri, new vscode.Range(this.streamedLines.length, 0, document.lineCount, 0))
				await vscode.workspace.applyEdit(edit)
			}

			// Preserve empty last line if original content had one.
			const hasEmptyLastLine = this.originalContent?.endsWith("\n")

			if (hasEmptyLastLine && !accumulatedContent.endsWith("\n")) {
				accumulatedContent += "\n"
			}

			// Apply the final content.
			const finalEdit = new vscode.WorkspaceEdit()

			finalEdit.replace(
				document.uri,
				new vscode.Range(0, 0, document.lineCount, 0),
				this.stripAllBOMs(accumulatedContent),
			)

			await vscode.workspace.applyEdit(finalEdit)

			// Clear all decorations at the end (after applying final edit).
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
		const updatedDocument = this.activeDiffEditor.document
		const editedContent = updatedDocument.getText()

		if (updatedDocument.isDirty) {
			await updatedDocument.save()
		}

		await this.closeAllRooOpenedViews()

		// Getting diagnostics before and after the file edit is a better approach than
		// automatically tracking problems in real-time. This method ensures we only
		// report new problems that are a direct result of this specific edit.
		// Since these are new problems resulting from Roo's edit, we know they're
		// directly related to the work he's doing. This eliminates the risk of Roo
		// going off-task or getting distracted by unrelated issues, which was a problem
		// with the previous auto-debug approach. Some users' machines may be slow to
		// update diagnostics, so this approach provides a good balance between automation
		// and avoiding potential issues where Roo might get stuck in loops due to
		// outdated problem information. If no new problems show up by the time the user
		// accepts the changes, they can always debug later using the '@problems' mention.
		// This way, Roo only becomes aware of new problems resulting from his edits
		// and can address them accordingly. If problems don't change immediately after
		// applying a fix, won't be notified, which is generally fine since the
		// initial fix is usually correct and it may just take time for linters to catch up.
		const postDiagnostics = vscode.languages.getDiagnostics()

		const newProblems = await diagnosticsToProblemsString(
			getNewDiagnostics(this.preDiagnostics, postDiagnostics),
			[
				vscode.DiagnosticSeverity.Error, // only including errors since warnings can be distracting (if user wants to fix warnings they can use the @problems mention)
			],
			this.cwd,
		) // Will be empty string if no errors.

		const newProblemsMessage =
			newProblems.length > 0 ? `\n\nNew problems detected after saving the file:\n${newProblems}` : ""

		// If the edited content has different EOL characters, we don't want to
		// show a diff with all the EOL differences.
		const newContentEOL = this.newContent.includes("\r\n") ? "\r\n" : "\n"

		// `trimEnd` to fix issue where editor adds in extra new line
		// automatically.
		const normalizedEditedContent = editedContent.replace(/\r\n|\n/g, newContentEOL).trimEnd() + newContentEOL

		// Just in case the new content has a mix of varying EOL characters.
		const normalizedNewContent = this.newContent.replace(/\r\n|\n/g, newContentEOL).trimEnd() + newContentEOL

		if (normalizedEditedContent !== normalizedNewContent) {
			// User made changes before approving edit.
			const userEdits = formatResponse.createPrettyPatch(
				this.relPath.toPosix(),
				normalizedNewContent,
				normalizedEditedContent,
			)

			return { newProblemsMessage, userEdits, finalContent: normalizedEditedContent }
		} else {
			// No changes to Roo's edits.
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

			await this.closeAllRooOpenedViews()
			await fs.unlink(absolutePath)

			// Remove only the directories we created, in reverse order.
			for (let i = this.createdDirs.length - 1; i >= 0; i--) {
				await fs.rmdir(this.createdDirs[i])
				console.log(`Directory ${this.createdDirs[i]} has been deleted.`)
			}

			console.log(`File ${absolutePath} has been deleted.`)
		} else {
			// Revert document.
			const edit = new vscode.WorkspaceEdit()

			const fullRange = new vscode.Range(
				updatedDocument.positionAt(0),
				updatedDocument.positionAt(updatedDocument.getText().length),
			)

			edit.replace(updatedDocument.uri, fullRange, this.originalContent ?? "")

			// Apply the edit and save, since contents shouldnt have changed
			// this won't show in local history unless of course the user made
			// changes and saved during the edit.
			await vscode.workspace.applyEdit(edit)
			await updatedDocument.save()
			console.log(`File ${absolutePath} has been reverted to its original content.`)

			if (this.documentWasOpen) {
				await this.showTextDocumentSafe({ uri: vscode.Uri.file(absolutePath), options: { preview: false } })
			}

			await this.closeAllRooOpenedViews()
		}

		// Edit is done.
		this.resetWithListeners()
	}

  private async closeAllRooOpenedViews() {
		const tabs = vscode.window.tabGroups.all
			.flatMap((tg) => tg.tabs)
			.filter(
				(tab) =>
					(tab.input instanceof vscode.TabInputTextDiff &&
						tab.input?.original?.scheme === DIFF_VIEW_URI_SCHEME) ||
					// close if in rooOpenedTabs and autoCloseTabs is enabled
					(this.autoCloseTabs &&
						tab.input instanceof vscode.TabInputText &&
						this.rooOpenedTabs.has(tab.input.uri.toString())),
			)

		const closeOps = tabs.map((tab) => vscode.window.tabGroups.close(tab, true).then(
			() => undefined,
			err => {
				console.error(`Failed to close diff tab ${tab.label}`, err);
			}
		));

		await Promise.all(closeOps)
	}

	private async getEditorFromDiffTab(uri: vscode.Uri): Promise<vscode.TextEditor | null> {
		// If this diff editor is already open (ie if a previous write file was interrupted) then we should activate that instead of opening a new diff
		const diffTab = vscode.window.tabGroups.all
			.flatMap((group) => group.tabs)
			.find(
				(tab) =>
					tab.input instanceof vscode.TabInputTextDiff &&
					tab.input?.original?.scheme === DIFF_VIEW_URI_SCHEME &&
					arePathsEqual(tab.input.modified.fsPath, uri.fsPath),
			)
		// If this diff editor is already open (ie if a previous write file was
		// interrupted) then we should activate that instead of opening a new
		// diff.
		if (!(diffTab && diffTab.input instanceof vscode.TabInputTextDiff)) {
			return null
		}
		// Only focus if autoFocus is true
		if (this.autoFocus) {
			const editor = await this.showAndTrackEditor(diffTab.input.modified)
			return editor
		}
		// Try to find the editor without focusing
		const editor = vscode.window.visibleTextEditors.find((ed) => arePathsEqual(ed.document.uri.fsPath, uri.fsPath))
		if (editor) return editor
		// Otherwise, open without focusing
		await this.showAndTrackEditor(diffTab.input.modified, {
			preview: false,
			preserveFocus: this.preserveFocus,
			viewColumn: this.viewColumn,
		})
		const newEditor = vscode.window.visibleTextEditors.find((ed) =>
			arePathsEqual(ed.document.uri.fsPath, uri.fsPath),
		)
		if (newEditor) return newEditor
		return null
	}

	/**
	 * Opens the diff editor, optionally in a specific viewColumn.
	 */
	private async openDiffEditor(): Promise<vscode.TextEditor> {
		if (!this.relPath) {
			throw new Error("No file path set")
		}
		// right uri = the file path
		const rightUri = vscode.Uri.file(path.resolve(this.cwd, this.relPath))
		const editor = await this.getEditorFromDiffTab(rightUri)
		if (editor) {
			return editor
		}

		// Open new diff editor.
		return new Promise<vscode.TextEditor>((resolve, reject) => {
			const fileName = path.basename(rightUri.fsPath)
			const fileExists = this.editType === "modify"

			const leftUri = vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME}:${fileName}`).with({
				query: Buffer.from(this.originalContent ?? "").toString("base64"),
			})
			const title = `${fileName}: ${fileExists ? "Original ↔ Roo's Changes" : "New File"} (Editable)`
			const previousEditor = vscode.window.activeTextEditor
			const textDocumentShowOptions: TextDocumentShowOptions = {
				preview: false,
				preserveFocus: this.preserveFocus,
				viewColumn: this.viewColumn,
			}
			// set interaction flag to true to prevent autoFocus from being triggered
			this.suppressInteractionFlag = true
			vscode.commands
				.executeCommand("vscode.diff", leftUri, rightUri, title, textDocumentShowOptions)
				.then(() => {
					// set interaction flag to false to allow autoFocus to be triggered
					this.suppressInteractionFlag = false
					if (this.autoCloseTabs && !this.documentWasOpen) {
						// If the diff tab is not already open, add it to the set
						this.rooOpenedTabs.add(rightUri.toString())
					}
					// If autoFocus is true, we don't need to do anything
					if (this.autoFocus) {
						return
					}
					// if there is no previous editor, we don't need to do anything
					if (!previousEditor) {
						return
					}
					// if this happens in a window different from the active one, we need to show the document
					if (this.viewColumn !== ViewColumn.Active) {
						this.showTextDocumentSafe({
							textDocument: previousEditor.document,
							options: {
								preview: false,
								preserveFocus: false,
								selection: previousEditor.selection,
								viewColumn: previousEditor.viewColumn,
							},
						})
					}
				})
				.then(() => {
					this.getEditorFromDiffTab(rightUri).then((editor) => {
						if (editor) {
							resolve(editor)
						} else {
							reject(new Error("Failed to open diff editor, please try again..."))
						}
					})
				})
			// This may happen on very slow machines ie project idx
			setTimeout(() => {
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
				// Found the first diff, scroll to it.
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

	async reset() {
		// Ensure any diff views opened by this provider are closed to release
		// memory.
		try {
			await this.closeAllRooOpenedViews()
		} catch (error) {
			console.error("Error closing diff views", error)
		}
		this.editType = undefined
		this.isEditing = false
		this.originalContent = undefined
		this.createdDirs = []
		this.documentWasOpen = false
		this.activeDiffEditor = undefined
		this.fadedOverlayController = undefined
		this.activeLineController = undefined
		this.streamedLines = []
		this.preDiagnostics = []
		this.rooOpenedTabs.clear()
		this.autoCloseTabs = false
	}

	resetWithListeners() {
		this.reset()
		this.resetAutoFocusListeners()
	}
}
