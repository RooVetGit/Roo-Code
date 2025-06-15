import * as fs from "fs"
import * as path from "path"

export const isDockerContainer = () => {
	try {
		return fs.existsSync("/.dockerenv")
	} catch (_error) {
		return false
	}
}

/**
 * Traverses up the directory tree to find an ancestor directory that contains a .git directory
 * @param startPath The starting directory path
 * @returns The path to the git repository root
 * @throws Error if no .git directory is found
 */
export const findGitRoot = (startPath: string): string => {
	let currentPath = path.resolve(startPath)
	const root = path.parse(currentPath).root

	while (currentPath !== root) {
		const gitPath = path.join(currentPath, ".git")
		if (fs.existsSync(gitPath) && fs.statSync(gitPath).isDirectory()) {
			return currentPath
		}
		currentPath = path.dirname(currentPath)
	}

	const gitPath = path.join(root, ".git")

	if (fs.existsSync(gitPath) && fs.statSync(gitPath).isDirectory()) {
		return root
	}

	throw new Error("No .git directory found in any ancestor directory")
}
