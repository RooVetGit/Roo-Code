import os from "os"
import * as path from "path"
import * as fs from "fs"
import simpleGit, { SimpleGit } from "simple-git"
import { globSync } from "glob"
import ignore from "ignore"
import { arePathsEqual, getWorkspacePath } from "../../utils/path"
import { isPathInIgnoredDirectory } from "./ignore-utils"
import { listFilesWithRipgrep } from "./ripgrep-utils"

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
	// Early return for limit of 0 - no need to scan anything
	if (limit === 0) {
		return [[], false]
	}

	const workspacePath = getWorkspacePath()
	const absoluteDirPath = path.resolve(dirPath)

	const specialResult = handleSpecialDirectories(absoluteDirPath)
	if (specialResult) {
		// Normalizing path for consistency before returning.
		const normalizedPaths = specialResult[0].map(normalizePath)
		return [normalizedPaths, specialResult[1]]
	}

	const git = simpleGit(workspacePath)
	let allAbsolutePaths: string[]

	if (recursive) {
		allAbsolutePaths = await listAllFilesRecursively(absoluteDirPath, git, workspacePath, limit + 1)
	} else {
		allAbsolutePaths = await listNonRecursive(absoluteDirPath, git, workspacePath, limit + 1)
	}

	// Filter out any empty strings and apply the custom ignore list as a final pass.
	const finalPaths = allAbsolutePaths
		.filter((p) => p && !isPathInIgnoredDirectory(path.relative(workspacePath, p)))
		.map(normalizePath)

	const trimmed = finalPaths.slice(0, limit)
	return [trimmed, finalPaths.length > limit]
}

/**
 * Handle special directories (root, home) that should not be fully listed.
 * This is a synchronous function as it doesn't perform I/O.
 */
function handleSpecialDirectories(absolutePath: string): [string[], boolean] | null {
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
 * Recursively lists all files using the highly optimized `git ls-files` command.
 * Falls back to a manual filesystem walk if the git command fails.
 */
async function listAllFilesRecursively(
	dir: string,
	git: SimpleGit,
	workspacePath: string,
	limit: number,
): Promise<string[]> {
	try {
		// Use git ls-files for a massive performance boost.
		// --cached: All files tracked by git.
		// --others: All untracked files.
		// --exclude-standard: Respects .gitignore, .git/info/exclude, and global git config.
		const relativeDir = path.relative(workspacePath, dir)
		const args = ["ls-files", "--cached", "--others", "--exclude-standard"]
		// Scope the search to the target directory for efficiency
		if (relativeDir) {
			args.push(relativeDir)
		}

		const result = await git.raw(args)

		if (!result) return []

		return result
			.split("\n")
			.filter(Boolean) // Filter out empty lines
			.map((p) => path.join(workspacePath, p))
	} catch (error) {
		// Fallback to the manual method if git ls-files fails
		// (e.g., not a git repo, or an error with the command).
		console.warn("`git ls-files` failed, falling back to ripgrep:", error)
		return listAllFilesRecursivelyWithRipGrep(dir, git, workspacePath, limit)
	}
}

/**
 * A fallback recursive file lister that uses ripgrep for performance.
 * This is used if Git is not available or fails.
 */
async function listAllFilesRecursivelyWithRipGrep(
	dir: string,
	_git: SimpleGit,
	workspacePath: string,
	limit: number,
): Promise<string[]> {
	const ig = createGitignoreFilter(workspacePath)

	let files: string[] = []
	let usedRipgrep = false
	try {
		files = await listFilesWithRipgrep(dir, true, limit)
		usedRipgrep = true
	} catch (err) {
		console.warn("listFilesWithRipgrep failed:", err)
	}

	// If ripgrep failed or returned no files, fallback to manual method
	if (!files || files.length === 0) {
		const queue: string[] = [dir]
		while (queue.length > 0) {
			const currentDir = queue.shift()!
			if (isPathInIgnoredDirectory(path.relative(workspacePath, currentDir))) {
				continue
			}
			let entries: fs.Dirent[]
			try {
				entries = await fs.promises.readdir(currentDir, { withFileTypes: true })
			} catch (err) {
				continue
			}
			for (const entry of entries) {
				const fullPath = path.join(currentDir, entry.name)
				if (entry.isDirectory()) {
					queue.push(fullPath)
				} else {
					files.push(fullPath)
				}
			}
		}
	}

	// Map to relative paths, filter, then map back to absolute
	const filtered = ig.filter(files.map((f) => path.relative(workspacePath, path.resolve(f)).replace(/\\/g, "/")))
	return filtered.slice(0, limit).map((rel) => path.join(workspacePath, rel))
}

/**
 * Creates a filter function that respects nested .gitignore files.
 * @param {string} rootDir - The root directory to start scanning from.
 * @returns {import('ignore').Ignore} An ignore instance pre-populated with rules.
 */
function createGitignoreFilter(rootDir: string) {
	const ig = ignore()

	// Find all .gitignore files recursively
	const gitignoreFiles = globSync("**/.gitignore", {
		cwd: rootDir,
		dot: true,
		ignore: ["**/node_modules/**"],
	})

	// Add rules from the root .gitignore first, if it exists
	const rootGitignorePath = path.join(rootDir, ".gitignore")
	if (fs.existsSync(rootGitignorePath)) {
		const rootGitignoreContent = fs.readFileSync(rootGitignorePath, "utf8")
		ig.add(rootGitignoreContent)
	}

	// Process nested .gitignore files
	for (const gitignorePath of gitignoreFiles) {
		// We already handled the root one
		if (path.normalize(gitignorePath) === ".gitignore") {
			continue
		}

		const gitignoreContent = fs.readFileSync(path.join(rootDir, gitignorePath), "utf8")
		const gitignoreDir = path.dirname(gitignorePath)

		// Parse lines and make patterns relative to the rootDir
		const patterns = gitignoreContent
			.split(/\r?\n/)
			.filter((line) => line.trim() !== "" && !line.startsWith("#"))
			.map((pattern) => {
				const isNegated = pattern.startsWith("!")
				if (isNegated) {
					pattern = pattern.slice(1)
				}
				const fullPattern = path.join(gitignoreDir, pattern).replace(/\\/g, "/")
				return isNegated ? `!${fullPattern}` : fullPattern
			})

		ig.add(patterns)
	}

	return ig
}

/**
 * List only top-level files and directories, filtering out ignored ones.
 * Uses ripgrep for performance and consistency with recursive listing.
 */
async function listNonRecursive(dir: string, _git: SimpleGit, workspacePath: string, limit: number): Promise<string[]> {
	const ig = createGitignoreFilter(workspacePath)

	let files: string[] = []
	try {
		files = await listFilesWithRipgrep(dir, false, limit)
	} catch (err) {
		console.warn("listFilesWithRipgrep (non-recursive) failed:", err)
	}

	// If ripgrep failed or returned no files, fallback to manual method
	if (!files || files.length === 0) {
		const entries = await fs.promises.readdir(dir, { withFileTypes: true })
		return entries
			.map((entry) => path.join(dir, entry.name))
			.filter((fullPath) => {
				const relPath = path.relative(workspacePath, fullPath).replace(/\\/g, "/")
				return !ig.ignores(relPath) && !isPathInIgnoredDirectory(relPath)
			})
	}

	const filtered = ig.filter(files.map((f) => path.relative(workspacePath, path.resolve(f)).replace(/\\/g, "/")))

	// Ripgrep --files only lists files, not directories. Add top-level directories manually.
	let dirEntries: string[] = []
	try {
		const entries = await fs.promises.readdir(dir, { withFileTypes: true })
		dirEntries = entries
			.filter((entry) => entry.isDirectory())
			.map((entry) => path.join(dir, entry.name))
			.filter((fullPath) => {
				const relPath = path.relative(workspacePath, fullPath).replace(/\\/g, "/")
				return !ig.ignores(relPath) && !isPathInIgnoredDirectory(relPath)
			})
	} catch (err) {
		// ignore
	}

	// Enforce limit after combining files and directories
	const combined = [...dirEntries, ...filtered.map((rel) => path.join(workspacePath, rel))]
	return combined.slice(0, limit)
}
