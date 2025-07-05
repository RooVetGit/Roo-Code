// List files in a directory, using simple-git to determine ignored files

import os from "os"
import * as path from "path"
import * as fs from "fs"
import simpleGit from "simple-git"
import { arePathsEqual, getWorkspacePath } from "../../utils/path"
import { isPathInIgnoredDirectory } from "./ignore-utils"

/**
 * List files and directories in a given path, with options for recursion and limits.
 * This function respects .gitignore rules and a hardcoded list of ignored directory names.
 *
 * @param dirPath - Directory path to list files from.
 * @param recursive - Whether to recursively list files in subdirectories.
 * @param limit - Maximum number of files to return.
 * @returns A tuple containing an array of file paths and a boolean indicating if the limit was reached.
 */
export async function listFiles(dirPath: string, recursive: boolean, limit: number): Promise<[string[], boolean]> {
	const specialResult = await handleSpecialDirectories(dirPath)
	if (specialResult) {
		return specialResult
	}

	const workspacePath = getWorkspacePath()
	const git = simpleGit(workspacePath)
	const absoluteDirPath = path.resolve(dirPath)

	let allPaths: string[]
	if (recursive) {
		allPaths = await listAllFilesRecursively(absoluteDirPath, git, workspacePath)
	} else {
		// For non-recursive, we still need to filter
		const topLevelPaths = await listTopLevelFilesAndDirs(absoluteDirPath)
		const relPaths = topLevelPaths.map((p) => path.relative(workspacePath, p))
		const ignored = await git.checkIgnore(relPaths)
		const ignoredSet = new Set(ignored || [])
		allPaths = topLevelPaths.filter((p, i) => !ignoredSet.has(relPaths[i]) && !isPathInIgnoredDirectory(p))
	}

	const trimmed = allPaths.slice(0, limit)
	return [trimmed, allPaths.length > limit]
}

/**
 * Handle special directories (root, home) that should not be fully listed
 */
async function handleSpecialDirectories(dirPath: string): Promise<[string[], boolean] | null> {
	const absolutePath = path.resolve(dirPath)

	// Do not allow listing files in root directory
	if (arePathsEqual(path.dirname(absolutePath), absolutePath)) {
		return [[absolutePath], false]
	}

	// Do not allow listing files in home directory
	const homeDir = os.homedir()
	const isHomeDir = arePathsEqual(absolutePath, homeDir)
	if (isHomeDir) {
		return [[homeDir], false]
	}

	return null
}

/**
 * Recursively list all files and directories under a directory,
 * skipping ignored directories for performance.
 */
import type { SimpleGit } from "simple-git"
async function listAllFilesRecursively(dir: string, git: SimpleGit, workspacePath: string): Promise<string[]> {
	const result: string[] = []
	const queue: string[] = [dir]
	const ignoredSet = new Set<string>()

	while (queue.length > 0) {
		const current = queue.shift()!
		if (isPathInIgnoredDirectory(current)) {
			continue
		}

		let entries
		try {
			entries = await fs.promises.readdir(current, { withFileTypes: true })
		} catch (err) {
			// Skip unreadable directories
			continue
		}

		const fullPaths = entries.map((e) => path.join(current, e.name.toString()))
		const relPaths = fullPaths.map((p) => path.relative(workspacePath, p))

		// Check which paths are git-ignored
		const gitIgnored = await git.checkIgnore(relPaths)
		gitIgnored.forEach((p) => ignoredSet.add(p))

		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i]
			const fullPath = fullPaths[i]
			const relPath = relPaths[i]

			if (ignoredSet.has(relPath) || isPathInIgnoredDirectory(fullPath)) {
				continue
			}

			result.push(fullPath)
			if (entry.isDirectory()) {
				queue.push(fullPath)
			}
		}
	}
	return result
}

/**
 * List only top-level files and directories in a directory
 */
async function listTopLevelFilesAndDirs(dir: string): Promise<string[]> {
	const entries = await fs.promises.readdir(dir, { withFileTypes: true })
	return entries.map((entry) => path.join(dir, entry.name.toString()))
}
