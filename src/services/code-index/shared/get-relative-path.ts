import path from "path"
import { getWorkspacePath } from "../../../utils/path"

/**
 * Generates a normalized absolute path from a given file path and workspace root.
 * Handles path resolution and normalization to ensure consistent absolute paths.
 *
 * @param filePath - The file path to normalize (can be relative or absolute)
 * @param workspaceRoot - The root directory of the workspace
 * @returns The normalized absolute path
 */
export function generateNormalizedAbsolutePath(filePath: string, workspaceRoot?: string): string {
	const workspace = workspaceRoot || getWorkspacePath()
	// Resolve the path to make it absolute if it's relative
	const resolvedPath = path.resolve(workspace, filePath)
	// Normalize to handle any . or .. segments and duplicate slashes
	return path.normalize(resolvedPath)
}

/**
 * Generates a relative file path from a normalized absolute path and workspace root.
 * Ensures consistent relative path generation across different platforms.
 *
 * @param normalizedAbsolutePath - The normalized absolute path to convert
 * @param workspaceRoot - The root directory of the workspace
 * @returns The relative path from workspaceRoot to the file
 */
export function generateRelativeFilePath(normalizedAbsolutePath: string, workspaceRoot?: string): string {
	const workspace = workspaceRoot || getWorkspacePath()
	// Generate the relative path
	const relativePath = path.relative(workspace, normalizedAbsolutePath)
	// Normalize to ensure consistent path separators
	return path.normalize(relativePath)
}
