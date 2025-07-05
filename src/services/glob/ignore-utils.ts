import * as path from "path"
import { DIRS_TO_IGNORE, GITIGNORE_WHITELIST } from "./constants"

/**
 * Checks if a file path should be ignored based on the DIRS_TO_IGNORE patterns.
 * This function handles special patterns like ".*" for hidden directories.
 *
 * @param filePath The file path to check
 * @returns true if the path should be ignored, false otherwise
 */
export function isPathInIgnoredDirectory(filePath: string): boolean {
	// Normalize path separators
	const normalizedPath = filePath.replace(/\\/g, "/")
	const pathParts = normalizedPath.split("/")

	// Check each directory in the path against DIRS_TO_IGNORE
	for (const part of pathParts) {
		// Skip empty parts (from leading or trailing slashes)
		if (!part) continue

		// Handle the ".*" pattern for hidden directories
		if (DIRS_TO_IGNORE.includes(".*") && part.startsWith(".") && part !== ".") {
			return true
		}

		// Check for exact matches
		if (DIRS_TO_IGNORE.includes(part)) {
			return true
		}
	}

	// Check if path contains any ignored directory pattern
	for (const dir of DIRS_TO_IGNORE) {
		if (dir === ".*") {
			// Already handled above
			continue
		}

		// Check if the directory appears in the path
		if (normalizedPath.includes(`/${dir}/`)) {
			return true
		}
	}

	return false
}

/**
 * Check if a path is whitelisted or is a parent of a whitelisted path
 */
export function isPathWhitelisted(absolutePath: string): boolean {
	const normalizedPath = path.normalize(absolutePath)

	for (const whitelistedDir of GITIGNORE_WHITELIST) {
		const whitelistedPath = path.normalize(whitelistedDir)

		// Check if this is the whitelisted path or a parent of it
		if (normalizedPath === whitelistedPath || whitelistedPath.startsWith(path.join(normalizedPath, path.sep))) {
			return true
		}
	}

	return false
}

/**
 * Check if a directory might contain whitelisted paths
 */
export function mightContainWhitelistedPaths(dirPath: string): boolean {
	const normalizedDirPath = path.normalize(dirPath)

	for (const whitelistedDir of GITIGNORE_WHITELIST) {
		const whitelistedPath = path.normalize(whitelistedDir)

		// Check if the whitelisted path is under this directory
		if (
			whitelistedPath.startsWith(path.join(normalizedDirPath, path.sep)) ||
			whitelistedPath === normalizedDirPath
		) {
			return true
		}

		// Also check if this directory is under the whitelisted path
		if (normalizedDirPath.startsWith(path.join(whitelistedPath, path.sep))) {
			return true
		}
	}

	return false
}

/**
 * Check if a directory is in our explicit ignore list
 */
export function isDirectoryExplicitlyIgnored(dirName: string): boolean {
	for (const pattern of DIRS_TO_IGNORE) {
		// Exact name matching
		if (pattern === dirName) {
			return true
		}

		// Path patterns that contain /
		if (pattern.includes("/")) {
			const pathParts = pattern.split("/")
			if (pathParts[0] === dirName) {
				return true
			}
		}
	}

	return false
}
