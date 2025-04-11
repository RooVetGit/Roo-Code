import * as vscode from "vscode"
import * as path from "path"

/**
 * Checks if a file path is outside all workspace folders
 * @param filePath The file path to check
 * @returns true if the path is outside all workspace folders, false otherwise
 */
export function isPathOutsideWorkspace(filePath: string): boolean {
	// If there are no workspace folders, consider everything outside workspace for safety
	if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
		return true
	}

	// Normalize and resolve the path to handle .. and . components correctly
	const absolutePath = path.resolve(filePath)

	// Check if the path is within any workspace folder
	return !vscode.workspace.workspaceFolders.some((folder) => {
		const folderPath = folder.uri.fsPath
		// Path is inside a workspace if it equals the workspace path or is a subfolder
		return absolutePath === folderPath || absolutePath.startsWith(folderPath + path.sep)
	})
}

/**
 * Converts a file URI to a mention-friendly path relative to the workspace.
 * @param uri The vscode.Uri to convert.
 * @param workspaceFolders The current workspace folders.
 * @returns A mention path string (e.g., "@/src/file.ts") or null if conversion fails.
 */
export function uriToMentionPath(
	uri: vscode.Uri,
	workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined,
): string | null {
	if (!workspaceFolders || workspaceFolders.length === 0) {
		// No workspace, return absolute path prefixed with @
		return "@" + uri.fsPath.replace(/\\/g, "/") // Normalize slashes
	}

	// Try to get the relative path using the first workspace folder as a base
	// Note: For multi-root workspaces, this might need more sophisticated logic
	// to determine the most appropriate relative path.
	const workspaceRoot = workspaceFolders[0].uri
	let relativePath = vscode.workspace.asRelativePath(uri, false) // false: return absolute path if outside workspace

	// Normalize slashes returned by asRelativePath (might be backslashes on Windows)
	relativePath = relativePath.replace(/\\/g, "/")

	// Check if asRelativePath returned an absolute path (meaning it's outside the workspace)
	// A simple check, might need refinement for edge cases.
	if (path.isAbsolute(relativePath) && !relativePath.startsWith(workspaceRoot.fsPath.replace(/\\/g, "/"))) {
		// If absolute and outside workspace, prefix with @
		return "@" + relativePath
	}

	// It's already a relative path, prefix with @/
	return "@/" + relativePath
}
