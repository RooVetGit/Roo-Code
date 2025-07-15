import * as vscode from "vscode"
import * as path from "path"

/**
 * Determines when to activate silent mode based on file state and user activity
 */
export class SilentModeDetector {
	constructor() {}

	/**
	 * Core detection logic for silent mode activation
	 */
	public shouldActivateSilentMode(filePath: string, globalSetting: boolean): boolean {
		if (!globalSetting) return false

		return !this.isFileActivelyBeingEdited(filePath) && !this.isFileInFocusedEditor(filePath)
	}

	/**
	 * Checks if a file is currently being edited by the user
	 */
	private isFileActivelyBeingEdited(filePath: string): boolean {
		const document = this.findOpenDocument(filePath)
		if (!document) return false

		return document.isDirty || this.isDocumentInActiveEditor(document) || this.hasRecentUserActivity(document)
	}

	/**
	 * Checks if file is in the currently focused editor
	 */
	private isFileInFocusedEditor(filePath: string): boolean {
		const activeEditor = vscode.window.activeTextEditor
		if (!activeEditor) return false

		return this.pathsMatch(activeEditor.document.uri.fsPath, filePath)
	}

	/**
	 * Finds an open document by file path
	 */
	private findOpenDocument(filePath: string): vscode.TextDocument | undefined {
		return vscode.workspace.textDocuments.find((doc) => this.pathsMatch(doc.uri.fsPath, filePath))
	}

	/**
	 * Checks if a document is in the active editor
	 */
	private isDocumentInActiveEditor(document: vscode.TextDocument): boolean {
		const activeEditor = vscode.window.activeTextEditor
		return activeEditor?.document === document
	}

	/**
	 * Detects recent user activity on a document
	 * For now, this is a placeholder - we could implement more sophisticated
	 * activity detection in the future
	 */
	private hasRecentUserActivity(document: vscode.TextDocument): boolean {
		// Could track recent edits, cursor movements, etc.
		// For now, return false as a safe default
		return false
	}

	/**
	 * Compares two file paths, handling case sensitivity and path normalization
	 */
	private pathsMatch(path1: string, path2: string): boolean {
		const normalizedPath1 = path.resolve(path1).toLowerCase()
		const normalizedPath2 = path.resolve(path2).toLowerCase()
		return normalizedPath1 === normalizedPath2
	}
}
