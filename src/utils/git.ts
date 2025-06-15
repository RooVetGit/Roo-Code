import * as vscode from "vscode"
import * as path from "path"
import { promises as fs } from "fs"

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
 * Gets git commit information - stub implementation
 * @param workspaceRoot The workspace root directory
 * @returns Promise resolving to commit info
 */
export async function getCommitInfo(workspaceRoot: string): Promise<GitCommit[]> {
	// TODO: Implement git commit retrieval
	return []
}

/**
 * Gets git working state - stub implementation
 * @param workspaceRoot The workspace root directory
 * @returns Promise resolving to working state info
 */
export async function getWorkingState(workspaceRoot: string): Promise<{ hasChanges: boolean }> {
	// TODO: Implement git working state check
	return { hasChanges: false }
}

/**
 * Searches git commits - stub implementation
 * @param workspaceRoot The workspace root directory
 * @param query The search query
 * @returns Promise resolving to matching commits
 */
export async function searchCommits(workspaceRoot: string, query: string): Promise<GitCommit[]> {
	// TODO: Implement git commit search
	return []
}
