import os from "os"
import * as path from "path"
import * as fs from "fs"
import * as childProcess from "child_process"
import * as vscode from "vscode"
import { arePathsEqual } from "../../utils/path"
import { getBinPath } from "../../services/ripgrep"
import { DIRS_TO_IGNORE, GITIGNORE_WHITELIST } from "./constants"

/**
 * Check if a path is whitelisted or is a parent of a whitelisted path
 */
function isPathWhitelisted(absolutePath: string): boolean {
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
function mightContainWhitelistedPaths(dirPath: string): boolean {
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
 * Special check for .roo directory
 */
function isRooPath(dirPath: string): boolean {
	const normalizedPath = path.normalize(dirPath)
	const dirName = path.basename(normalizedPath)

	// Check if this is .roo or under .roo using path segments
	const segments = normalizedPath.split(path.sep)
	return dirName === ".roo" || segments.includes(".roo")
}

/**
 * List files in a directory, with optional recursive traversal
 *
 * @param dirPath - Directory path to list files from
 * @param recursive - Whether to recursively list files in subdirectories
 * @param limit - Maximum number of files to return
 * @returns Tuple of [file paths array, whether the limit was reached]
 */
export async function listFiles(dirPath: string, recursive: boolean, limit: number): Promise<[string[], boolean]> {
	// Early return for limit of 0 - no need to scan anything
	if (limit === 0) {
		return [[], false]
	}

	// Handle special directories
	const specialResult = await handleSpecialDirectories(dirPath)

	if (specialResult) {
		return specialResult
	}

	// Get ripgrep path
	const rgPath = await getRipgrepPath()

	// Get files using ripgrep
	const files = await listFilesWithRipgrep(rgPath, dirPath, recursive, limit)

	// Get directories with proper filtering
	const gitignorePatterns = await parseGitignoreFile(dirPath, recursive)
	const directories = await listFilteredDirectories(dirPath, recursive, gitignorePatterns)

	// Combine and format the results
	return formatAndCombineResults(files, directories, limit)
}

/**
 * Handle special directories (root, home) that should not be fully listed
 */
async function handleSpecialDirectories(dirPath: string): Promise<[string[], boolean] | null> {
	const absolutePath = path.resolve(dirPath)

	// Do not allow listing files in root directory
	const root = process.platform === "win32" ? path.parse(absolutePath).root : "/"
	const isRoot = arePathsEqual(absolutePath, root)
	if (isRoot) {
		return [[root], false]
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
 * Get the path to the ripgrep binary
 */
async function getRipgrepPath(): Promise<string> {
	const vscodeAppRoot = vscode.env.appRoot
	const rgPath = await getBinPath(vscodeAppRoot)

	if (!rgPath) {
		throw new Error("Could not find ripgrep binary")
	}

	return rgPath
}

/**
 * List files using ripgrep with appropriate arguments
 */
async function listFilesWithRipgrep(
	rgPath: string,
	dirPath: string,
	recursive: boolean,
	limit: number,
): Promise<string[]> {
	const absolutePath = path.resolve(dirPath)
	const rgArgs = buildRipgrepArgs(absolutePath, recursive)
	return execRipgrep(rgPath, rgArgs, limit)
}

/**
 * Build appropriate ripgrep arguments based on whether we're doing a recursive search
 */
function buildRipgrepArgs(dirPath: string, recursive: boolean): string[] {
	// Base arguments to list files
	const args = ["--files", "--hidden", "--follow"]

	if (recursive) {
		return [...args, ...buildRecursiveArgs(dirPath), dirPath]
	} else {
		return [...args, ...buildNonRecursiveArgs(), dirPath]
	}
}

/**
 * Build ripgrep arguments for recursive directory traversal
 */
function buildRecursiveArgs(dirPath?: string): string[] {
	const args: string[] = []

	// Check if this path is whitelisted (with defensive null check)
	const isWhitelisted = dirPath ? isPathWhitelisted(dirPath) : false

	if (isWhitelisted) {
		// For whitelisted paths, don't respect .gitignore
		args.push("--no-ignore-vcs")
	}
	// Otherwise, ripgrep respects .gitignore by default

	// Apply directory exclusions for recursive searches
	// But be more selective about hidden directories
	for (const dir of DIRS_TO_IGNORE) {
		if (dir === ".*") {
			// Don't use the broad .* pattern
			// Instead, we'll handle hidden directories in shouldIncludeDirectory
			continue
		}
		args.push("-g", `!**/${dir}/**`)
	}

	return args
}

/**
 * Build ripgrep arguments for non-recursive directory listing
 */
function buildNonRecursiveArgs(): string[] {
	const args: string[] = []

	// For non-recursive, limit to the current directory level
	args.push("-g", "*")
	args.push("--maxdepth", "1") // ripgrep uses maxdepth, not max-depth

	// Don't respect .gitignore in non-recursive mode (consistent with original behavior)
	args.push("--no-ignore-vcs")

	// Apply directory exclusions for non-recursive searches
	for (const dir of DIRS_TO_IGNORE) {
		if (dir === ".*") {
			// For hidden files/dirs in non-recursive mode
			args.push("-g", "!.*")
		} else {
			// Direct children only
			args.push("-g", `!${dir}`)
			args.push("-g", `!${dir}/**`)
		}
	}

	return args
}

/**
 * Parse the .gitignore file if it exists and is relevant
 */
async function parseGitignoreFile(dirPath: string, recursive: boolean): Promise<string[]> {
	if (!recursive) {
		return [] // Only needed for recursive mode
	}

	const absolutePath = path.resolve(dirPath)
	const gitignorePath = path.join(absolutePath, ".gitignore")

	try {
		// Check if .gitignore exists
		const exists = await fs.promises
			.access(gitignorePath)
			.then(() => true)
			.catch(() => false)

		if (!exists) {
			return []
		}

		// Read and parse .gitignore file
		const content = await fs.promises.readFile(gitignorePath, "utf8")
		return content
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith("#"))
	} catch (err) {
		console.warn(`Error reading .gitignore: ${err}`)
		return [] // Continue without gitignore patterns on error
	}
}

/**
 * List directories with appropriate filtering
 */
async function listFilteredDirectories(
	dirPath: string,
	recursive: boolean,
	gitignorePatterns: string[],
): Promise<string[]> {
	const absolutePath = path.resolve(dirPath)
	const directories: string[] = []

	async function scanDirectory(currentPath: string): Promise<void> {
		try {
			// List all entries in the current directory
			const entries = await fs.promises.readdir(currentPath, { withFileTypes: true })

			// Filter for directories only, excluding symbolic links to prevent circular traversal
			for (const entry of entries) {
				if (entry.isDirectory() && !entry.isSymbolicLink()) {
					const dirName = entry.name
					const fullDirPath = path.join(currentPath, dirName)

					// Check if this directory should be included
					if (shouldIncludeDirectory(dirName, recursive, gitignorePatterns, fullDirPath)) {
						// Add the directory to our results (with trailing slash)
						const formattedPath = fullDirPath.endsWith("/") ? fullDirPath : `${fullDirPath}/`
						directories.push(formattedPath)

						// If recursive mode and not a ignored directory, scan subdirectories
						if (recursive && !isDirectoryExplicitlyIgnored(dirName)) {
							await scanDirectory(fullDirPath)
						}
					}
				}
			}
		} catch (err) {
			// Silently continue if we can't read a directory
			console.warn(`Could not read directory ${currentPath}: ${err}`)
		}
	}

	// Start scanning from the root directory
	await scanDirectory(absolutePath)

	return directories
}

/**
 * Determine if a directory should be included in results based on filters
 */
function shouldIncludeDirectory(
	dirName: string,
	recursive: boolean,
	gitignorePatterns: string[],
	fullPath: string,
): boolean {
	// Always include whitelisted paths
	if (isPathWhitelisted(fullPath)) {
		return true
	}

	// Special handling for hidden directories
	if (dirName.startsWith(".") && DIRS_TO_IGNORE.includes(".*")) {
		// Check if this hidden directory might contain whitelisted paths
		if (mightContainWhitelistedPaths(fullPath)) {
			// Only allow if it's actually part of a whitelisted path
			// This ensures we don't accidentally include similar-named directories
			return true
		}
		// Block all other hidden directories
		return false
	}

	// Check against explicit ignore patterns
	if (isDirectoryExplicitlyIgnored(dirName)) {
		// But allow if it might contain whitelisted paths
		if (!mightContainWhitelistedPaths(fullPath)) {
			return false
		}
	}

	// Check against gitignore patterns in recursive mode
	if (recursive && gitignorePatterns.length > 0 && isIgnoredByGitignore(dirName, gitignorePatterns)) {
		// But allow if it might contain whitelisted paths
		if (!mightContainWhitelistedPaths(fullPath)) {
			return false
		}
	}

	return true
}

/**
 * Check if a directory is in our explicit ignore list
 */
function isDirectoryExplicitlyIgnored(dirName: string): boolean {
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

/**
 * Check if a directory matches any gitignore patterns
 */
function isIgnoredByGitignore(dirName: string, gitignorePatterns: string[]): boolean {
	for (const pattern of gitignorePatterns) {
		// Directory patterns (ending with /)
		if (pattern.endsWith("/")) {
			const dirPattern = pattern.slice(0, -1)
			if (dirName === dirPattern) {
				return true
			}
			if (pattern.startsWith("**/") && dirName === dirPattern.slice(3)) {
				return true
			}
		}
		// Simple name patterns
		else if (dirName === pattern) {
			return true
		}
		// Wildcard patterns
		else if (pattern.includes("*")) {
			const regexPattern = pattern.replace(/\\/g, "\\\\").replace(/\./g, "\\.").replace(/\*/g, ".*")
			const regex = new RegExp(`^${regexPattern}$`)
			if (regex.test(dirName)) {
				return true
			}
		}
	}

	return false
}

/**
 * Combine file and directory results and format them properly
 */
function formatAndCombineResults(files: string[], directories: string[], limit: number): [string[], boolean] {
	// Combine file paths with directory paths
	const allPaths = [...directories, ...files]

	// Deduplicate paths (a directory might appear in both lists)
	const uniquePathsSet = new Set(allPaths)
	const uniquePaths = Array.from(uniquePathsSet)

	// Sort to ensure directories come first, followed by files
	uniquePaths.sort((a: string, b: string) => {
		const aIsDir = a.endsWith("/")
		const bIsDir = b.endsWith("/")

		if (aIsDir && !bIsDir) return -1
		if (!aIsDir && bIsDir) return 1
		return a.localeCompare(b)
	})

	const trimmedPaths = uniquePaths.slice(0, limit)
	return [trimmedPaths, trimmedPaths.length >= limit]
}

/**
 * Execute ripgrep command and return list of files
 */
async function execRipgrep(rgPath: string, args: string[], limit: number): Promise<string[]> {
	return new Promise((resolve, reject) => {
		const rgProcess = childProcess.spawn(rgPath, args)
		let output = ""
		let results: string[] = []

		// Set timeout to avoid hanging
		const timeoutId = setTimeout(() => {
			rgProcess.kill()
			console.warn("ripgrep timed out, returning partial results")
			resolve(results.slice(0, limit))
		}, 10_000)

		// Process stdout data as it comes in
		rgProcess.stdout.on("data", (data) => {
			output += data.toString()
			processRipgrepOutput()

			// Kill the process if we've reached the limit
			if (results.length >= limit) {
				rgProcess.kill()
				clearTimeout(timeoutId) // Clear the timeout when we kill the process due to reaching the limit
			}
		})

		// Process stderr but don't fail on non-zero exit codes
		rgProcess.stderr.on("data", (data) => {
			console.error(`ripgrep stderr: ${data}`)
		})

		// Handle process completion
		rgProcess.on("close", (code) => {
			// Clear the timeout to avoid memory leaks
			clearTimeout(timeoutId)

			// Process any remaining output
			processRipgrepOutput(true)

			// Log non-zero exit codes but don't fail
			if (code !== 0 && code !== null && code !== 143 /* SIGTERM */) {
				console.warn(`ripgrep process exited with code ${code}, returning partial results`)
			}

			resolve(results.slice(0, limit))
		})

		// Handle process errors
		rgProcess.on("error", (error) => {
			// Clear the timeout to avoid memory leaks
			clearTimeout(timeoutId)
			reject(new Error(`ripgrep process error: ${error.message}`))
		})

		// Helper function to process output buffer
		function processRipgrepOutput(isFinal = false) {
			const lines = output.split("\n")

			// Keep the last incomplete line unless this is the final processing
			if (!isFinal) {
				output = lines.pop() || ""
			} else {
				output = ""
			}

			// Process each complete line
			for (const line of lines) {
				if (line.trim() && results.length < limit) {
					results.push(line)
				} else if (results.length >= limit) {
					break
				}
			}
		}
	})
}
