import * as vscode from "vscode"
import * as path from "path"
import { arePathsEqual } from "../../utils/path"
import { DIFF_VIEW_URI_SCHEME } from "./DiffViewProvider"

/**
 * Interface for diff settings used by PostDiffviewBehaviorUtils
 */
interface DiffSettings {
	autoFocus: boolean
	autoCloseRooTabs: boolean
	autoCloseAllRooTabs: boolean
}

/**
 * Context object containing the state needed for post-diff behavior
 */
interface PostDiffContext {
	relPath?: string
	editType?: "create" | "modify"
	documentWasOpen: boolean
	cwd: string
	rooOpenedTabs: Set<string>
	preDiffActiveEditor?: vscode.TextEditor
	autoCloseAllRooTabs: boolean
}

/**
 * Utility class for handling post-diff behavior including tab management and focus restoration.
 * This class encapsulates all logic related to what happens after a diff operation is completed.
 */
export class PostDiffViewBehaviorUtils {
	private context: PostDiffContext

	constructor(context: PostDiffContext) {
		this.context = context
	}

	/**
	 * Updates the context with new values
	 * @param updates Partial context updates
	 */
	public updateContext(updates: Partial<PostDiffContext>): void {
		this.context = { ...this.context, ...updates }
	}

	/**
	 * Handles post-diff focus behavior.
	 * Currently defaults to focusing the edited file (Behavior A).
	 * Future implementation will support configurable focus behavior.
	 */
	public async handlePostDiffFocus(): Promise<void> {
		if (!this.context.relPath) {
			return
		}

		if (this.context.autoCloseAllRooTabs) {
			// Focus on the pre-diff active tab
			await this.focusOnPreDiffActiveTab()
			return
		}
		// Focus on the edited file (temporary default)
		await this.focusOnEditedFile()
	}

	/**
	 * Focuses on the tab of the file that was just edited.
	 */
	public async focusOnEditedFile(): Promise<void> {
		if (!this.context.relPath) {
			return
		}

		try {
			const absolutePath = path.resolve(this.context.cwd, this.context.relPath)
			const fileUri = vscode.Uri.file(absolutePath)

			// Check if the file still exists as a tab
			const editedFileTab = this.findTabForFile(absolutePath)
			if (editedFileTab) {
				// Find the tab group containing the edited file
				const tabGroup = vscode.window.tabGroups.all.find((group) =>
					group.tabs.some((tab) => tab === editedFileTab),
				)

				if (tabGroup) {
					// Make the edited file's tab active
					await this.showTextDocumentSafe({
						uri: fileUri,
						options: {
							viewColumn: tabGroup.viewColumn,
							preserveFocus: false,
							preview: false,
						},
					})
				}
			}
		} catch (error) {
			console.error("Roo Debug: Error focusing on edited file:", error)
		}
	}

	/**
	 * Restores focus to the tab that was active before the diff operation.
	 * This method is prepared for future use when configurable focus behavior is implemented.
	 */
	public async focusOnPreDiffActiveTab(): Promise<void> {
		if (!this.context.preDiffActiveEditor || !this.context.preDiffActiveEditor.document) {
			return
		}

		try {
			// Check if the pre-diff active editor is still valid and its document is still open
			const isDocumentStillOpen = vscode.workspace.textDocuments.some(
				(doc) => doc === this.context.preDiffActiveEditor!.document,
			)

			if (isDocumentStillOpen) {
				// Restore focus to the pre-diff active editor
				await vscode.window.showTextDocument(this.context.preDiffActiveEditor.document.uri, {
					viewColumn: this.context.preDiffActiveEditor.viewColumn,
					preserveFocus: false,
					preview: false,
				})
			}
		} catch (error) {
			console.error("Roo Debug: Error restoring focus to pre-diff active tab:", error)
		}
	}

	/**
	 * Determines whether a tab should be closed based on the diff settings and tab characteristics.
	 * @param tab The VSCode tab to evaluate
	 * @param settings The diff settings containing auto-close preferences
	 * @returns True if the tab should be closed, false otherwise
	 */
	public tabToCloseFilter(tab: vscode.Tab, settings: DiffSettings): boolean {
		// Always close DiffView tabs opened by Roo
		if (tab.input instanceof vscode.TabInputTextDiff && tab.input?.original?.scheme === DIFF_VIEW_URI_SCHEME) {
			return true
		}

		let isRooOpenedTextTab = false
		if (tab.input instanceof vscode.TabInputText) {
			const currentTabUri = (tab.input as vscode.TabInputText).uri
			for (const openedUriString of this.context.rooOpenedTabs) {
				try {
					const previouslyOpenedUri = vscode.Uri.parse(openedUriString, true) // true for strict parsing
					if (currentTabUri.scheme === "file" && previouslyOpenedUri.scheme === "file") {
						if (arePathsEqual(currentTabUri.fsPath, previouslyOpenedUri.fsPath)) {
							isRooOpenedTextTab = true
							break
						}
					} else {
						if (currentTabUri.toString() === previouslyOpenedUri.toString()) {
							isRooOpenedTextTab = true
							break
						}
					}
				} catch (e) {
					// Log parsing error if necessary, or ignore if a URI in rooOpenedTabs is malformed
					console.error(`Roo Debug: Error parsing URI from rooOpenedTabs: ${openedUriString}`, e)
				}
			}
		}

		if (!isRooOpenedTextTab) {
			return false // Not a text tab or not identified as opened by Roo
		}

		// Haken 2 (settings.autoCloseAllRooTabs) - takes precedence
		if (settings.autoCloseAllRooTabs) {
			// This implies Haken 1 is also effectively on
			return true // Close all Roo-opened text tabs
		}

		// Only Haken 1 (settings.autoCloseRooTabs) is on, Haken 2 is off
		if (settings.autoCloseRooTabs) {
			const tabUriFsPath = (tab.input as vscode.TabInputText).uri.fsPath
			const absolutePathDiffedFile = this.context.relPath
				? path.resolve(this.context.cwd, this.context.relPath)
				: null

			// Guard against null absolutePathDiffedFile if relPath is somehow not set
			if (!absolutePathDiffedFile) {
				// If we don't know the main diffed file, but Haken 1 is on,
				// it's safer to close any tab Roo opened to avoid leaving extras.
				return true
			}

			const isMainDiffedFileTab = arePathsEqual(tabUriFsPath, absolutePathDiffedFile)

			if (this.context.editType === "create" && isMainDiffedFileTab) {
				return true // Case: New file, Haken 1 is on -> Close its tab.
			}

			if (this.context.editType === "modify" && isMainDiffedFileTab) {
				return !this.context.documentWasOpen
			}

			// If the tab is for a file OTHER than the main diffedFile, but was opened by Roo
			if (!isMainDiffedFileTab) {
				// This covers scenarios where Roo might open auxiliary files (though less common for single diff).
				// If Haken 1 is on, these should also be closed.
				return true
			}
		}
		return false // Default: do not close if no above condition met
	}

	/**
	 * Closes a single tab with error handling and fresh reference lookup.
	 * @param tab The tab to close
	 */
	public async closeTab(tab: vscode.Tab): Promise<void> {
		// If a tab has made it through the filter, it means one of the auto-close settings
		// (autoCloseTabs or autoCloseAllRooTabs) is active and the conditions for closing
		// this specific tab are met. Therefore, we should always bypass the dirty check.
		// const bypassDirtyCheck = true; // This is implicitly true now.

		// Attempt to find the freshest reference to the tab before closing,
		// as the original 'tab' object from the initial flatMap might be stale.
		const tabInputToClose = tab.input
		const freshTabToClose = vscode.window.tabGroups.all
			.flatMap((group) => group.tabs)
			.find((t) => t.input === tabInputToClose)

		if (freshTabToClose) {
			try {
				await vscode.window.tabGroups.close(freshTabToClose, true) // true to bypass dirty check implicitly
			} catch (closeError) {
				console.error(`Roo Debug CloseLoop: Error closing tab "${freshTabToClose.label}":`, closeError)
			}
		} else {
			// This case should ideally not happen if the tab was in the filtered list.
			// It might indicate the tab was closed by another means or its input changed.
			console.warn(
				`Roo Debug CloseLoop: Tab "${tab.label}" (input: ${JSON.stringify(tab.input)}) intended for closure was not found in the current tab list.`,
			)
			// Fallback: Try to close the original tab reference if the fresh one isn't found,
			// though this is less likely to succeed if it's genuinely stale.
			try {
				console.log(`Roo Debug CloseLoop: Attempting to close original (stale?) tab "${tab.label}"`)
				await vscode.window.tabGroups.close(tab, true)
			} catch (fallbackCloseError) {
				console.error(
					`Roo Debug CloseLoop: Error closing original tab reference for "${tab.label}":`,
					fallbackCloseError,
				)
			}
		}
	}

	/**
	 * Closes all tabs that were opened by Roo based on the current settings.
	 * @param settings The diff settings to use for determining which tabs to close
	 */
	public async closeAllRooOpenedViews(settings: DiffSettings): Promise<void> {
		const closeOps = vscode.window.tabGroups.all
			.flatMap((tg) => tg.tabs)
			.filter((tab) => this.tabToCloseFilter(tab, settings))
			.map((tab) => this.closeTab(tab))

		await Promise.all(closeOps)
	}

	/**
	 * Finds the VS Code tab for a given file path.
	 * @param absolutePath The absolute path to the file
	 * @returns The tab if found, undefined otherwise
	 */
	private findTabForFile(absolutePath: string): vscode.Tab | undefined {
		return vscode.window.tabGroups.all
			.flatMap((group) => group.tabs)
			.find(
				(tab) => tab.input instanceof vscode.TabInputText && arePathsEqual(tab.input.uri.fsPath, absolutePath),
			)
	}

	/**
	 * Safely shows a text document with error handling.
	 * @param params Parameters for showing the document
	 * @returns The text editor or null if failed
	 */
	private async showTextDocumentSafe({
		uri,
		textDocument,
		options,
	}: {
		uri?: vscode.Uri
		textDocument?: vscode.TextDocument
		options?: vscode.TextDocumentShowOptions
	}): Promise<vscode.TextEditor | null> {
		// If the uri is already open, we want to focus it
		if (uri) {
			const editor = await vscode.window.showTextDocument(uri, options)
			return editor
		}
		// If the textDocument is already open, we want to focus it
		if (textDocument) {
			const editor = await vscode.window.showTextDocument(textDocument, options)
			return editor
		}
		// If the textDocument is not open and not able to be opened, we just return null
		return null
	}
}
