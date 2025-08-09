import * as vscode from "vscode"
import * as path from "path"

/**
 * Finds the workspace folder that contains a .roo directory
 *
 * @returns The workspace folder containing .roo, or undefined if not found
 *
 * @example
 * ```typescript
 * const workspaceWithRoo = findWorkspaceWithRoo()
 * if (workspaceWithRoo) {
 *   // .roo folder exists as one of the workspace folders
 *   const rooPath = workspaceWithRoo.uri.fsPath
 * }
 * ```
 */
export function findWorkspaceWithRoo(): vscode.WorkspaceFolder | undefined {
	if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
		return undefined
	}

	// Check if any workspace folder is named .roo
	for (const folder of vscode.workspace.workspaceFolders) {
		if (path.basename(folder.uri.fsPath) === ".roo") {
			return folder
		}
	}

	return undefined
}
