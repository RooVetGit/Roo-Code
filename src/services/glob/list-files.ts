// List files in a directory, using simple-git to determine ignored files

import os from "os"
import * as path from "path"
import * as fs from "fs"
import simpleGit from "simple-git"
import { arePathsEqual, getWorkspacePath } from "../../utils/path"
import { isPathInIgnoredDirectory } from "./ignore-utils"

function normalizePath(p: string): string {
	return p.replace(/\\/g, "/")
}

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
	const workspacePath = getWorkspacePath()
	const specialResult = await handleSpecialDirectories(dirPath)
	if (specialResult) {
		const relativePaths = specialResult[0].map((p) => normalizePath(path.relative(workspacePath, p)))
		return [relativePaths, specialResult[1]]
	}

	const git = simpleGit(workspacePath)
	const absoluteDirPath = path.resolve(dirPath)

	let allAbsolutePaths: string[]
	if (recursive) {
		allAbsolutePaths = await listAllFilesRecursively(absoluteDirPath, git, workspacePath)
	} else {
		// For non-recursive, we still need to filter
		const topLevelPaths = await listTopLevelFilesAndDirs(absoluteDirPath)
		const relPaths = topLevelPaths.map((p) => path.relative(workspacePath, p))
		const ignored = await git.checkIgnore(relPaths)
		const ignoredSet = new Set(ignored || [])
		allAbsolutePaths = topLevelPaths.filter((p, i) => !ignoredSet.has(relPaths[i]) && !isPathInIgnoredDirectory(p))
	}

	const allRelativePaths = allAbsolutePaths
		.map((p) => normalizePath(path.relative(workspacePath, p)))
		.filter((p) => p) // Filter out empty strings from root listing

	const trimmed = allRelativePaths.slice(0, limit)
	return [trimmed, allRelativePaths.length > limit]
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
	if (arePathsEqual(absolutePath, homeDir)) {
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
	const ignoredSet = new Set<string>() // This set will accumulate all ignored paths relative to workspacePath

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

		// Paths relative to the *current* directory for checkIgnore
		const currentDirEntryNames = entries.map((e) => e.name.toString())

		// Create a new simple-git instance for the current directory
		const currentGit = simpleGit(current)
		const gitIgnoredInCurrentContext = await currentGit.checkIgnore(currentDirEntryNames)

		// Convert ignored paths back to workspace-relative paths and add to the global ignoredSet
		gitIgnoredInCurrentContext.forEach((ignoredName) => {
			const fullIgnoredPath = path.join(current, ignoredName)
			ignoredSet.add(normalizePath(path.relative(workspacePath, fullIgnoredPath)))
		})

		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i]
			const fullPath = path.join(current, entry.name.toString())
			const relPath = normalizePath(path.relative(workspacePath, fullPath))

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
