import * as vscode from "vscode"
import { TextDocument, TextDocumentShowOptions, ViewColumn } from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import * as diff from "diff"
import stripBom from "strip-bom"
import { XMLBuilder } from "fast-xml-parser"

import { createDirectoriesForFile } from "../../utils/fs"
import { arePathsEqual, getReadablePath } from "../../utils/path"
import { formatResponse } from "../../core/prompts/responses"
import { diagnosticsToProblemsString, getNewDiagnostics } from "../diagnostics"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { Task } from "../../core/task/Task"

import { DecorationController } from "./DecorationController"
import { ClineProvider } from "../../core/webview/ClineProvider"
import { UserInteractionProvider } from "./UserInteractionProvider"
import { PostDiffViewBehaviorUtils } from "./PostDiffViewBehaviorUtils"

export const DIFF_VIEW_URI_SCHEME = "cline-diff"

interface DiffSettings {
	autoFocus: boolean
	autoCloseRooTabs: boolean
	autoCloseAllRooTabs: boolean
}

// TODO: https://github.com/cline/cline/pull/3354
export class DiffViewProvider {
	// Properties to store the results of saveChanges
	newProblemsMessage?: string
	userEdits?: string
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
	private autoApproval: boolean | undefined = undefined
	private autoFocus: boolean | undefined = undefined
	private autoCloseAllRooTabs: boolean = false // Added new setting
	// have to set the default view column to -1 since we need to set it in the initialize method and during initialization the enum ViewColumn is undefined
	private viewColumn: ViewColumn = -1 // ViewColumn.Active
	private userInteractionProvider: UserInteractionProvider
	private suppressInteractionFlag: boolean = false
	private preDiffActiveEditor?: vscode.TextEditor // Store active editor before diff operation
	private postDiffBehaviorUtils: PostDiffViewBehaviorUtils

	constructor(private cwd: string) {
		this.userInteractionProvider = new UserInteractionProvider({
			onUserInteraction: () => {
				this.autoFocus = false
			},
			getSuppressFlag: () => this.suppressInteractionFlag,
			autoApproval: false,
			autoFocus: true,
		})

		// Initialize PostDiffviewBehaviorUtils with initial context
		this.postDiffBehaviorUtils = new PostDiffViewBehaviorUtils({
			relPath: this.relPath,
			editType: this.editType,
			documentWasOpen: this.documentWasOpen,
			cwd: this.cwd,
			rooOpenedTabs: this.rooOpenedTabs,
			preDiffActiveEditor: this.preDiffActiveEditor,
			autoCloseAllRooTabs: this.autoCloseAllRooTabs,
		})
	}

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
		const settings = await this._readDiffSettings()
		this.autoFocus = settings.autoFocus
		this.autoCloseAllRooTabs = settings.autoCloseAllRooTabs
		// Track currently visible editors and active editor for focus restoration and tab cleanup
		this.rooOpenedTabs.clear()

		// Update PostDiffviewBehaviorUtils context with latest values
		this.postDiffBehaviorUtils.updateContext({
			autoCloseAllRooTabs: this.autoCloseAllRooTabs,
		})
	}

	private async _readDiffSettings(): Promise<DiffSettings> {
		const config = vscode.workspace.getConfiguration("roo-cline")
		const autoFocus = config.get<boolean>("diffViewAutoFocus", true)
		const autoCloseRooTabs = config.get<boolean>("autoCloseRooTabs", false)
		const autoCloseAllRooTabs = config.get<boolean>("autoCloseAllRooTabs", false)
		return { autoFocus, autoCloseRooTabs, autoCloseAllRooTabs }
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
	 * Disables auto-focus on the diff editor after user interaction.
	 * This is to prevent the diff editor from stealing focus when the user interacts with other editors or tabs.
	 */
	public disableAutoFocusAfterUserInteraction() {
		this.userInteractionProvider.updateOptions({
			autoApproval: this.autoApproval ?? false,
			autoFocus: this.autoFocus ?? true,
		})
		this.userInteractionProvider.enable()
	}

	/**
	 * Opens a diff editor for the given relative path, optionally in a specific viewColumn.
	 * @param relPath The relative file path to open.
	 * @param viewColumn (Optional) The VSCode editor group to open the diff in.
	 */
	async open(relPath: string, viewColumn: ViewColumn): Promise<void> {
		// Store the pre-diff active editor for potential focus restoration
		this.preDiffActiveEditor = vscode.window.activeTextEditor

		this.viewColumn = viewColumn

		// Update PostDiffviewBehaviorUtils context with current state
		this.postDiffBehaviorUtils.updateContext({
			relPath: relPath,
			editType: this.editType,
			documentWasOpen: this.documentWasOpen,
			preDiffActiveEditor: this.preDiffActiveEditor,
		})
		// Update the user interaction provider with current settings
		this.userInteractionProvider.updateOptions({
			autoApproval: this.autoApproval ?? false,
			autoFocus: this.autoFocus ?? true,
		})
		this.disableAutoFocusAfterUserInteraction()
		// Set the edit type based on the file existence
		this.relPath = relPath
		const fileExists = this.editType === "modify"
		const absolutePath = path.resolve(this.cwd, relPath)
		this.isEditing = true

		// Track the URI of the actual file that will be part of the diff.
		// This ensures that if VS Code opens a tab for it during vscode.diff,
		// we can identify it as a "Roo-opened" tab for cleanup.
		const fileUriForDiff = vscode.Uri.file(absolutePath)
		this.rooOpenedTabs.add(fileUriForDiff.toString())

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

		this.postDiffBehaviorUtils.updateContext({
			documentWasOpen: this.documentWasOpen,
		})

		this.activeDiffEditor = await this.openDiffEditor()
		this.fadedOverlayController = new DecorationController("fadedOverlay", this.activeDiffEditor)
		this.activeLineController = new DecorationController("activeLine", this.activeDiffEditor)
		// Apply faded overlay to all lines initially.
		this.fadedOverlayController.addLines(0, this.activeDiffEditor.document.lineCount)
		// Scroll to the beginning of the diff editor only if autoFocus is enabled.
		if (this.autoFocus) {
			this.scrollEditorToLine(0) // Will this crash for new files?
		}
		this.streamedLines = []
	}

	/**
	 * Prepares the optimal view column and placement for the diff view.
	 * For existing open files: Places diff beside the original tab in the same group.
	 * For new/unopened files: Places at the end of the currently active editor group.
	 */
	private async prepareDiffViewPlacement(absolutePath: string): Promise<void> {
		if (!this.documentWasOpen) {
			// focus the last tab in the active group
			const activeGroup = vscode.window.tabGroups.activeTabGroup
			if (!(activeGroup && activeGroup.tabs.length > 0)) {
				return // No active group or no tabs in the active group, nothing to focus
			}
			const lastTab = activeGroup.tabs[activeGroup.tabs.length - 1]
			if (!lastTab.input) {
				return // No input for the last tab, nothing to focus
			}
			// TabInputText | TabInputCustom | TabInputWebview | TabInputNotebook have an URI, so we can focus it
			if (
				!(
					lastTab.input instanceof vscode.TabInputText ||
					lastTab.input instanceof vscode.TabInputCustom ||
					lastTab.input instanceof vscode.TabInputNotebook
				)
			) {
				return // Last tab is not a text input, nothing to focus
			}
			await this.showTextDocumentSafe({
				uri: lastTab.input.uri,
				options: {
					viewColumn: activeGroup.viewColumn,
					preserveFocus: true,
					preview: false,
				},
			})
			this.viewColumn = activeGroup.viewColumn // Set viewColumn to the active group
			return
		}
		// For existing files that are currently open, find the original tab
		const originalTab = this.findTabForFile(absolutePath)
		if (originalTab) {
			// Find the tab group containing the original tab
			const tabGroup = vscode.window.tabGroups.all.find((group) => group.tabs.some((tab) => tab === originalTab))

			if (tabGroup) {
				const viewColumn = this.viewColumn !== ViewColumn.Active ? tabGroup.viewColumn : this.viewColumn
				// Ensure the original tab is active within its group to place diff beside it
				await this.showTextDocumentSafe({
					uri: vscode.Uri.file(absolutePath),
					options: {
						viewColumn: viewColumn,
						preserveFocus: true,
						preview: false,
					},
				})
				// Update viewColumn to match the original file's group
				this.viewColumn = viewColumn
			}
		}
		// For new files or unopened files, keep the original viewColumn (active group)
		// No additional preparation needed as it will default to end of active group
	}

	/**
	 * Finds the VS Code tab for a given file path.
	 */
	private findTabForFile(absolutePath: string): vscode.Tab | undefined {
		return vscode.window.tabGroups.all
			.flatMap((group) => group.tabs)
			.find(
				(tab) => tab.input instanceof vscode.TabInputText && arePathsEqual(tab.input.uri.fsPath, absolutePath),
			)
	}

	/**
	 * Opens a file editor and tracks it as opened by Roo if not already open.
	 */
	private async showAndTrackEditor(uri: vscode.Uri, options: vscode.TextDocumentShowOptions = {}) {
		const editor = await this.showTextDocumentSafe({ uri, options })
		// Always track tabs opened by Roo, regardless of autoCloseTabs setting or if the document was already open.
		// The decision to close will be made in closeAllRooOpenedViews based on settings.
		this.rooOpenedTabs.add(uri.toString())
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
		// the way of the stream animation, only if autoFocus is enabled.
		if (this.autoFocus) {
			const beginningOfDocument = new vscode.Position(0, 0)
			diffEditor.selection = new vscode.Selection(beginningOfDocument, beginningOfDocument)
		}

		const endLine = accumulatedLines.length
		// Replace all content up to the current line with accumulated lines.
		const edit = new vscode.WorkspaceEdit()
		const rangeToReplace = new vscode.Range(0, 0, endLine + 1, 0)
		const contentToReplace = accumulatedLines.slice(0, endLine + 1).join("\n") + "\n"
		edit.replace(document.uri, rangeToReplace, this.stripAllBOMs(contentToReplace))
		await vscode.workspace.applyEdit(edit)
		// If autoFocus is disabled, explicitly clear the selection after applying edits
		// to prevent the right pane from gaining cursor focus.
		if (!this.autoFocus) {
			const beginningOfDocument = new vscode.Position(0, 0)
			diffEditor.selection = new vscode.Selection(beginningOfDocument, beginningOfDocument)
		}
		// Update decorations.
		this.activeLineController.setActiveLine(endLine)
		this.fadedOverlayController.updateOverlayAfterLine(endLine, document.lineCount)
		// Scroll to the current line.
		this.scrollEditorToLine(endLine)

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

		// Add a small delay to allow the isDirty status to update after saving.
		await new Promise((resolve) => setTimeout(resolve, 100))

		// Explicitly save the document in VS Code's model if it's open and dirty,
		// especially for newly created files, to ensure VS Code's internal state is synchronized
		// before attempting to close tabs.
		if (this.editType === "create" && this.relPath) {
			try {
				const absolutePath = path.resolve(this.cwd, this.relPath)
				for (const doc of vscode.workspace.textDocuments) {
					if (doc.uri.scheme === "file" && arePathsEqual(doc.uri.fsPath, absolutePath) && doc.isDirty) {
						await doc.save()
						// Add another small delay after explicit save for newly created file
						await new Promise((resolve) => setTimeout(resolve, 100))
					}
				}
			} catch (saveError) {
				console.error("Roo Debug: Error during explicit doc.save() for new file in saveChanges:", saveError)
				// Continue execution even if explicit save fails.
			}
		}

		await this.postDiffBehaviorUtils.closeAllRooOpenedViews(await this._readDiffSettings())

		// Implement post-diff focus behavior
		await this.postDiffBehaviorUtils.handlePostDiffFocus()

		// If no auto-close settings are enabled and the document was not open before,
		// open the file after the diff is complete.

		const settings = await this._readDiffSettings() // Dynamically read settings

		// If no auto-close settings are enabled and the document was not open before OR it's a new file,
		// open the file after the diff is complete.
		if (
			!settings.autoCloseRooTabs &&
			!settings.autoCloseAllRooTabs &&
			(this.editType === "create" || !this.documentWasOpen)
		) {
			const absolutePath = path.resolve(this.cwd, this.relPath!)
			await this.showAndTrackEditor(vscode.Uri.file(absolutePath), { preview: false, preserveFocus: true })
		}
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

			// Store the results as class properties for formatFileWriteResponse to use
			this.newProblemsMessage = newProblemsMessage
			this.userEdits = userEdits

			return { newProblemsMessage, userEdits, finalContent: normalizedEditedContent }
		} else {
			// No changes to Roo's edits.
			// Store the results as class properties for formatFileWriteResponse to use
			this.newProblemsMessage = newProblemsMessage
			this.userEdits = undefined

			return { newProblemsMessage, userEdits: undefined, finalContent: normalizedEditedContent }
		}
	}

	/**
	 * Formats a standardized XML response for file write operations
	 *
	 * @param cwd Current working directory for path resolution
	 * @param isNewFile Whether this is a new file or an existing file being modified
	 * @returns Formatted message and say object for UI feedback
	 */
	async pushToolWriteResult(task: Task, cwd: string, isNewFile: boolean): Promise<string> {
		if (!this.relPath) {
			throw new Error("No file path available in DiffViewProvider")
		}

		// Only send user_feedback_diff if userEdits exists
		if (this.userEdits) {
			// Create say object for UI feedback
			const say: ClineSayTool = {
				tool: isNewFile ? "newFileCreated" : "editedExistingFile",
				path: getReadablePath(cwd, this.relPath),
				diff: this.userEdits,
			}

			// Send the user feedback
			await task.say("user_feedback_diff", JSON.stringify(say))
		}

		// Build XML response
		const xmlObj = {
			file_write_result: {
				path: this.relPath,
				operation: isNewFile ? "created" : "modified",
				user_edits: this.userEdits ? this.userEdits : undefined,
				problems: this.newProblemsMessage || undefined,
				notice: {
					i: [
						"You do not need to re-read the file, as you have seen all changes",
						"Proceed with the task using these changes as the new baseline.",
						...(this.userEdits
							? [
									"If the user's edits have addressed part of the task or changed the requirements, adjust your approach accordingly.",
								]
							: []),
					],
				},
			},
		}

		const builder = new XMLBuilder({
			format: true,
			indentBy: "",
			suppressEmptyNode: true,
			processEntities: false,
			tagValueProcessor: (name, value) => {
				if (typeof value === "string") {
					// Only escape <, >, and & characters
					return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
				}
				return value
			},
			attributeValueProcessor: (name, value) => {
				if (typeof value === "string") {
					// Only escape <, >, and & characters
					return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
				}
				return value
			},
		})

		return builder.build(xmlObj)
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

			await this.postDiffBehaviorUtils.closeAllRooOpenedViews(await this._readDiffSettings())
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

			edit.replace(updatedDocument.uri, fullRange, this.stripAllBOMs(this.originalContent ?? ""))

			// Apply the edit and save, since contents shouldnt have changed
			// this won't show in local history unless of course the user made
			// changes and saved during the edit.
			await vscode.workspace.applyEdit(edit)
			await updatedDocument.save()
			console.log(`File ${absolutePath} has been reverted to its original content.`)

			if (this.documentWasOpen) {
				await this.showTextDocumentSafe({ uri: vscode.Uri.file(absolutePath), options: { preview: false } })
			}

			await this.postDiffBehaviorUtils.closeAllRooOpenedViews(await this._readDiffSettings())
		}

		// Implement post-diff focus behavior
		await this.postDiffBehaviorUtils.handlePostDiffFocus()

		// Edit is done.
		this.resetWithListeners()
	}

	/**
	 * Opens the diff editor, optionally in a specific viewColumn.
	 */
	private async openDiffEditor(): Promise<vscode.TextEditor> {
		if (!this.relPath) {
			throw new Error("No file path set")
		}

		const settings = await this._readDiffSettings() // Dynamically read settings

		// right uri = the file path
		const rightUri = vscode.Uri.file(path.resolve(this.cwd, this.relPath))
		// Open new diff editor.
		return new Promise<vscode.TextEditor>((resolve, reject) => {
			const fileName = path.basename(rightUri.fsPath)
			const fileExists = this.editType === "modify"

			const leftUri = vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME}:${fileName}`).with({
				query: Buffer.from(this.originalContent ?? "").toString("base64"),
			})
			const title = `${fileName}: ${fileExists ? "Original ↔ Roo's Changes" : "New File"} (Editable)`
			const textDocumentShowOptions: TextDocumentShowOptions = {
				preview: false,
				preserveFocus: !settings.autoFocus, // Use dynamically read autoFocus
				viewColumn: this.viewColumn,
			}
			// set interaction flag to true to prevent autoFocus from being triggered
			this.suppressInteractionFlag = true
			// Implement improved diff view placement logic
			const previousEditor = vscode.window.activeTextEditor
			this.prepareDiffViewPlacement(rightUri.fsPath).then(() => {
				vscode.commands
					.executeCommand("vscode.diff", leftUri, rightUri, title, textDocumentShowOptions)
					.then(async () => {
						// set interaction flag to false to allow autoFocus to be triggered
						this.suppressInteractionFlag = false

						// Get the active text editor, which should be the diff editor opened by vscode.diff
						const diffEditor = vscode.window.activeTextEditor

						// Ensure we have a valid editor and it's the one we expect (the right side of the diff)
						if (!diffEditor || !arePathsEqual(diffEditor.document.uri.fsPath, rightUri.fsPath)) {
							reject(new Error("Failed to get diff editor after opening."))
							return
						}

						this.activeDiffEditor = diffEditor // Assign to activeDiffEditor

						// Ensure rightUri is tracked even if not explicitly shown again
						this.rooOpenedTabs.add(rightUri.toString())

						// If autoFocus is disabled, explicitly clear the selection to prevent cursor focus.
						if (!settings.autoFocus) {
							// Use dynamically read autoFocus
							// Add a small delay to allow VS Code to potentially set focus first,
							// then clear it.
							await new Promise((resolve) => setTimeout(resolve, 50))
							const beginningOfDocument = new vscode.Position(0, 0)
							diffEditor.selection = new vscode.Selection(beginningOfDocument, beginningOfDocument)
						}

						// if this happens in a window different from the active one, we need to show the document
						if (previousEditor) {
							await this.showTextDocumentSafe({
								textDocument: previousEditor.document,
								options: {
									preview: false,
									preserveFocus: false,
									selection: previousEditor.selection,
									viewColumn: previousEditor.viewColumn,
								},
							})
						}

						// Resolve the promise with the diff editor
						resolve(diffEditor)
					})
				// Removed the second .then block that called getEditorFromDiffTab
				// This may happen on very slow machines ie project idx
				setTimeout(() => {
					reject(new Error("Failed to open diff editor, please try again..."))
				}, 10_000)
			})
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
		// Scroll to the first diff.
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

	async reset(): Promise<void> {
		// Ensure any diff views opened by this provider are closed to release
		// memory.
		try {
			await this.postDiffBehaviorUtils.closeAllRooOpenedViews(await this._readDiffSettings())
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
		this.preDiffActiveEditor = undefined
	}

	resetWithListeners() {
		this.reset()
		this.userInteractionProvider.dispose()
	}
}
