import * as vscode from "vscode"
import * as path from "path"
import { promises as fs } from "fs"
import { exec } from "child_process"
import { promisify } from "util"
import { truncateOutput } from "../integrations/misc/extract-text"

const execAsync = promisify(exec)
const SVN_OUTPUT_LINE_LIMIT = 500

export interface SvnRepositoryInfo {
	repositoryUrl?: string
	repositoryName?: string
	workingCopyRoot?: string
}

export interface SvnCommit {
	revision: string
	author: string
	date: string
	message: string
}

/**
 * Extracts SVN repository information from the workspace's .svn directory
 * @param workspaceRoot The root path of the workspace
 * @returns SVN repository information or empty object if not an SVN repository
 */
export async function getSvnRepositoryInfo(workspaceRoot: string): Promise<SvnRepositoryInfo> {
	try {
		const svnDir = path.join(workspaceRoot, ".svn")

		// Check if .svn directory exists
		try {
			await fs.access(svnDir)
		} catch {
			// Not an SVN repository
			return {}
		}

		const svnInfo: SvnRepositoryInfo = {}

		// Try to get SVN info using svn info command
		try {
			const { stdout } = await execAsync("svn info", { cwd: workspaceRoot })

			// Parse SVN info output
			const urlMatch = stdout.match(/^URL:\s*(.+)$/m)
			if (urlMatch && urlMatch[1]) {
				const url = urlMatch[1].trim()
				svnInfo.repositoryUrl = url
				svnInfo.repositoryName = extractSvnRepositoryName(url)
			}

			const rootMatch = stdout.match(/^Working Copy Root Path:\s*(.+)$/m)
			if (rootMatch && rootMatch[1]) {
				svnInfo.workingCopyRoot = rootMatch[1].trim()
			}
		} catch (error) {
			// Ignore SVN info errors
		}

		return svnInfo
	} catch (error) {
		// Return empty object on any error
		return {}
	}
}

/**
 * Extracts repository name from an SVN URL
 * @param url The SVN URL
 * @returns Repository name or undefined
 */
export function extractSvnRepositoryName(url: string): string {
	try {
		// Handle different SVN URL formats
		const patterns = [
			// Standard SVN: https://svn.example.com/repo/trunk -> repo
			/\/([^\/]+)\/(?:trunk|branches|tags)(?:\/.*)?$/,
			// Simple repo: https://svn.example.com/repo -> repo
			/\/([^\/]+)\/?$/,
		]

		for (const pattern of patterns) {
			const match = url.match(pattern)
			if (match && match[1]) {
				return match[1]
			}
		}

		// Fallback: use the last part of the URL
		const parts = url.split("/").filter(Boolean)
		return parts[parts.length - 1] || ""
	} catch {
		return ""
	}
}

/**
 * Gets SVN repository information for the current VSCode workspace
 * @returns SVN repository information or empty object if not available
 */
export async function getWorkspaceSvnInfo(): Promise<SvnRepositoryInfo> {
	const workspaceFolders = vscode.workspace.workspaceFolders
	if (!workspaceFolders || workspaceFolders.length === 0) {
		return {}
	}

	// Use the first workspace folder
	const workspaceRoot = workspaceFolders[0].uri.fsPath
	return getSvnRepositoryInfo(workspaceRoot)
}

/**
 * Checks if the given directory is an SVN repository
 * @param cwd The directory to check
 * @returns True if it's an SVN repository, false otherwise
 */
export async function checkSvnRepo(cwd: string): Promise<boolean> {
	try {
		const svnDir = path.join(cwd, ".svn")
		await fs.access(svnDir)
		return true
	} catch {
		return false
	}
}

/**
 * Checks if SVN is installed and available
 * @returns True if SVN is available, false otherwise
 */
export async function checkSvnInstalled(): Promise<boolean> {
	try {
		await execAsync("svn --version")
		return true
	} catch {
		return false
	}
}

/**
 * Searches for SVN commits by revision number or message content
 * @param query The search query (revision number or message text)
 * @param cwd The working directory
 * @returns Array of matching SVN commits
 */
export async function searchSvnCommits(query: string, cwd: string): Promise<SvnCommit[]> {
	try {
		// Check if SVN is available
		if (!(await checkSvnInstalled()) || !(await checkSvnRepo(cwd))) {
			return []
		}

		const commits: SvnCommit[] = []

		// If query looks like a revision number, search for that specific revision
		if (/^\d+$/.test(query)) {
			try {
				const { stdout } = await execAsync(`svn log -r ${query} --xml`, { cwd })
				const revisionCommits = parseSvnLogXml(stdout)
				commits.push(...revisionCommits)
			} catch {
				// Revision might not exist, continue with general search
			}
		}

		// Search in commit messages (get recent commits and filter)
		try {
			const { stdout } = await execAsync("svn log -l 100 --xml", { cwd })
			const allCommits = parseSvnLogXml(stdout)

			// Filter commits by message content
			const messageMatches = allCommits.filter(
				(commit) => commit.message.toLowerCase().includes(query.toLowerCase()) || commit.revision === query,
			)

			// Add unique commits (avoid duplicates from revision search)
			messageMatches.forEach((commit) => {
				if (!commits.some((c) => c.revision === commit.revision)) {
					commits.push(commit)
				}
			})
		} catch {
			// Ignore errors in message search
		}

		return commits.slice(0, 20) // Limit results
	} catch (error) {
		console.error("Error searching SVN commits:", error)
		return []
	}
}

/**
 * Parses SVN log XML output into commit objects
 * @param xmlOutput The XML output from svn log --xml
 * @returns Array of SVN commits
 */
function parseSvnLogXml(xmlOutput: string): SvnCommit[] {
	const commits: SvnCommit[] = []

	try {
		// Simple XML parsing for SVN log entries
		const entryRegex = /<logentry[^>]*revision="(\d+)"[^>]*>([\s\S]*?)<\/logentry>/g
		const authorRegex = /<author>([\s\S]*?)<\/author>/
		const dateRegex = /<date>([\s\S]*?)<\/date>/
		const msgRegex = /<msg>([\s\S]*?)<\/msg>/

		let match
		while ((match = entryRegex.exec(xmlOutput)) !== null) {
			const [, revision, entryContent] = match

			const authorMatch = authorRegex.exec(entryContent)
			const dateMatch = dateRegex.exec(entryContent)
			const msgMatch = msgRegex.exec(entryContent)

			commits.push({
				revision,
				author: authorMatch ? authorMatch[1].trim() : "Unknown",
				date: dateMatch ? new Date(dateMatch[1]).toISOString() : "",
				message: msgMatch ? msgMatch[1].trim() : "",
			})
		}
	} catch (error) {
		console.error("Error parsing SVN log XML:", error)
	}

	return commits
}

/**
 * Gets detailed information about a specific SVN revision
 * @param revision The revision number
 * @param cwd The working directory
 * @returns Detailed commit information including diff
 */
export async function getSvnCommitInfo(
	revision: string,
	cwd: string,
): Promise<{
	commit: SvnCommit | null
	diff: string
	stats: string
}> {
	try {
		if (!(await checkSvnInstalled()) || !(await checkSvnRepo(cwd))) {
			return { commit: null, diff: "", stats: "" }
		}

		// Get commit info
		const { stdout: logOutput } = await execAsync(`svn log -r ${revision} --xml`, { cwd })
		const commits = parseSvnLogXml(logOutput)
		const commit = commits[0] || null

		// Get diff
		let diff = ""
		try {
			const { stdout: diffOutput } = await execAsync(`svn diff -c ${revision}`, { cwd })
			diff = truncateOutput(diffOutput, SVN_OUTPUT_LINE_LIMIT)
		} catch {
			// Diff might not be available
		}

		// Get stats (changed files)
		let stats = ""
		try {
			const { stdout: changedOutput } = await execAsync(`svn log -r ${revision} -v`, { cwd })
			const changedMatch = changedOutput.match(/Changed paths:([\s\S]*?)(?=\n\n|\n-{72}|\n$)/)
			if (changedMatch) {
				stats = changedMatch[1].trim()
			}
		} catch {
			// Stats might not be available
		}

		return { commit, diff, stats }
	} catch (error) {
		console.error("Error getting SVN commit info:", error)
		return { commit: null, diff: "", stats: "" }
	}
}

/**
 * Gets the current working state of the SVN repository
 * @param cwd The working directory
 * @returns Object containing status and diff information
 */
export async function getSvnWorkingState(cwd: string): Promise<{
	status: string
	diff: string
}> {
	try {
		if (!(await checkSvnInstalled()) || !(await checkSvnRepo(cwd))) {
			return { status: "", diff: "" }
		}

		// Get status
		let status = ""
		try {
			const { stdout: statusOutput } = await execAsync("svn status", { cwd })
			status = truncateOutput(statusOutput, SVN_OUTPUT_LINE_LIMIT)
		} catch {
			// Status might not be available
		}

		// Get diff of working changes
		let diff = ""
		try {
			const { stdout: diffOutput } = await execAsync("svn diff", { cwd })
			diff = truncateOutput(diffOutput, SVN_OUTPUT_LINE_LIMIT)
		} catch {
			// Diff might not be available
		}

		return { status, diff }
	} catch (error) {
		console.error("Error getting SVN working state:", error)
		return { status: "", diff: "" }
	}
}
