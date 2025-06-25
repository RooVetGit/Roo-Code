import * as vscode from "vscode"
import * as path from "path"
import { promises as fs } from "fs"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

export interface GitRepositoryInfo {
	repositoryUrl?: string
	repositoryName?: string
	defaultBranch?: string
}

export interface GitCommit {
	hash: string
	message: string
	author?: string
	date?: string
}

/**
 * Extracts git repository information from the workspace's .git directory
 * @param workspaceRoot The root path of the workspace
 * @returns Git repository information or empty object if not a git repository
 */
export async function getGitRepositoryInfo(workspaceRoot: string): Promise<GitRepositoryInfo> {
	try {
		const gitDir = path.join(workspaceRoot, ".git")

		// Check if .git directory exists
		try {
			await fs.access(gitDir)
		} catch {
			// Not a git repository
			return {}
		}

		const gitInfo: GitRepositoryInfo = {}

		// Try to read git config file
		try {
			const configPath = path.join(gitDir, "config")
			const configContent = await fs.readFile(configPath, "utf8")

			// Very simple approach - just find any URL line
			const urlMatch = configContent.match(/url\s*=\s*(.+?)(?:\r?\n|$)/m)

			if (urlMatch && urlMatch[1]) {
				const url = urlMatch[1].trim()
				gitInfo.repositoryUrl = sanitizeGitUrl(url)
				const repositoryName = extractRepositoryName(url)
				if (repositoryName) {
					gitInfo.repositoryName = repositoryName
				}
			}

			// Extract default branch (if available)
			const branchMatch = configContent.match(/\[branch "([^"]+)"\]/i)
			if (branchMatch && branchMatch[1]) {
				gitInfo.defaultBranch = branchMatch[1]
			}
		} catch (error) {
			// Ignore config reading errors
		}

		// Try to read HEAD file to get current branch
		if (!gitInfo.defaultBranch) {
			try {
				const headPath = path.join(gitDir, "HEAD")
				const headContent = await fs.readFile(headPath, "utf8")
				const branchMatch = headContent.match(/ref: refs\/heads\/(.+)/)
				if (branchMatch && branchMatch[1]) {
					gitInfo.defaultBranch = branchMatch[1].trim()
				}
			} catch (error) {
				// Ignore HEAD reading errors
			}
		}

		return gitInfo
	} catch (error) {
		// Return empty object on any error
		return {}
	}
}

/**
 * Sanitizes a git URL to remove sensitive information like tokens
 * @param url The original git URL
 * @returns Sanitized URL
 */
function sanitizeGitUrl(url: string): string {
	try {
		// Remove credentials from HTTPS URLs
		if (url.startsWith("https://")) {
			const urlObj = new URL(url)
			// Remove username and password
			urlObj.username = ""
			urlObj.password = ""
			return urlObj.toString()
		}

		// For SSH URLs, return as-is (they don't contain sensitive tokens)
		if (url.startsWith("git@") || url.startsWith("ssh://")) {
			return url
		}

		// For other formats, return as-is but remove any potential tokens
		return url.replace(/:[a-f0-9]{40,}@/gi, "@")
	} catch {
		// If URL parsing fails, return original (might be SSH format)
		return url
	}
}

/**
 * Extracts repository name from a git URL
 * @param url The git URL
 * @returns Repository name or undefined
 */
function extractRepositoryName(url: string): string {
	try {
		// Handle different URL formats
		const patterns = [
			// HTTPS: https://github.com/user/repo.git -> user/repo
			/https:\/\/[^\/]+\/([^\/]+\/[^\/]+?)(?:\.git)?$/,
			// SSH: git@github.com:user/repo.git -> user/repo
			/git@[^:]+:([^\/]+\/[^\/]+?)(?:\.git)?$/,
			// SSH with user: ssh://git@github.com/user/repo.git -> user/repo
			/ssh:\/\/[^\/]+\/([^\/]+\/[^\/]+?)(?:\.git)?$/,
		]

		for (const pattern of patterns) {
			const match = url.match(pattern)
			if (match && match[1]) {
				return match[1].replace(/\.git$/, "")
			}
		}

		return ""
	} catch {
		return ""
	}
}

/**
 * Gets git repository information for the current VSCode workspace
 * @returns Git repository information or empty object if not available
 */
export async function getWorkspaceGitInfo(): Promise<GitRepositoryInfo> {
	const workspaceFolders = vscode.workspace.workspaceFolders
	if (!workspaceFolders || workspaceFolders.length === 0) {
		return {}
	}

	// Use the first workspace folder
	const workspaceRoot = workspaceFolders[0].uri.fsPath
	return getGitRepositoryInfo(workspaceRoot)
}

/**
 * Gets git commit information for a specific commit hash
 * @param commitHash The commit hash to get information for
 * @param workspaceRoot Optional workspace root directory (if not provided, uses the first workspace folder)
 * @returns Promise resolving to formatted commit info string
 */
export async function getCommitInfo(commitHash: string, workspaceRoot?: string): Promise<string> {
	try {
		// Get workspace root if not provided
		if (!workspaceRoot) {
			const workspaceFolders = vscode.workspace.workspaceFolders
			if (!workspaceFolders || workspaceFolders.length === 0) {
				return ""
			}
			workspaceRoot = workspaceFolders[0].uri.fsPath
		}

		// Check if .git directory exists
		const gitDir = path.join(workspaceRoot, ".git")
		try {
			await fs.access(gitDir)
		} catch {
			// Not a git repository
			return ""
		}

		// Use git show to get detailed commit information
		// The format is similar to what git show would normally output
		const command = `git -C "${workspaceRoot}" show --no-patch --format="%H %s%n%nAuthor: %an%nDate: %ad" ${commitHash}`

		const { stdout } = await execAsync(command)
		return stdout.trim()
	} catch (error) {
		console.error(`Error retrieving git commit info: ${error instanceof Error ? error.message : String(error)}`)
		return ""
	}
}

/**
 * Gets git working state - checks if there are uncommitted changes
 * @param workspaceRoot The workspace root directory
 * @returns Promise resolving to working state info
 */
export async function getWorkingState(workspaceRoot: string): Promise<{ hasChanges: boolean }> {
	try {
		// Check if .git directory exists
		const gitDir = path.join(workspaceRoot, ".git")
		try {
			await fs.access(gitDir)
		} catch {
			// Not a git repository
			return { hasChanges: false }
		}

		// Use git status --porcelain for machine-readable output
		// If there are changes, it will output lines describing the changes
		// If there are no changes, the output will be empty
		const command = `git -C "${workspaceRoot}" status --porcelain`

		const { stdout } = await execAsync(command)

		// If stdout is not empty, there are changes
		return { hasChanges: stdout.trim() !== "" }
	} catch (error) {
		console.error(`Error checking git working state: ${error instanceof Error ? error.message : String(error)}`)
		return { hasChanges: false }
	}
}

/**
 * Searches git commits matching a query string
 * @param query The search query (searches commit messages)
 * @param workspaceRoot Optional workspace root directory (if not provided, uses the first workspace folder)
 * @param limit Maximum number of commits to retrieve (default: 20)
 * @returns Promise resolving to matching commits
 */
export async function searchCommits(query: string, workspaceRoot?: string, limit: number = 20): Promise<GitCommit[]> {
	try {
		// Get workspace root if not provided
		if (!workspaceRoot) {
			const workspaceFolders = vscode.workspace.workspaceFolders
			if (!workspaceFolders || workspaceFolders.length === 0) {
				return []
			}
			workspaceRoot = workspaceFolders[0].uri.fsPath
		}

		// Check if .git directory exists
		const gitDir = path.join(workspaceRoot, ".git")
		try {
			await fs.access(gitDir)
		} catch {
			// Not a git repository
			return []
		}

		// Format: hash, author, date, message
		// %H: full hash, %an: author name, %ad: author date, %s: subject (message)
		const format = "--pretty=format:%H|%an|%ad|%s"

		// Use git log with grep to search commit messages
		// The -i flag makes the search case-insensitive
		const command = `git -C "${workspaceRoot}" log ${format} -n ${limit} --grep="${query}" -i`

		const { stdout } = await execAsync(command)

		// Parse the output into GitCommit objects
		return stdout
			.split("\n")
			.filter((line) => line.trim() !== "")
			.map((line) => {
				const [hash, author, date, message] = line.split("|")
				return {
					hash,
					author,
					date,
					message,
				}
			})
	} catch (error) {
		console.error(`Error searching git commits: ${error instanceof Error ? error.message : String(error)}`)
		return []
	}
}
