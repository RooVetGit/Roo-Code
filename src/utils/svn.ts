import * as vscode from "vscode"
import * as path from "path"
import { promises as fs } from "fs"
import { exec } from "child_process"
import { promisify } from "util"
import { truncateOutput } from "../integrations/misc/extract-text"

const execAsync = promisify(exec)
const SVN_OUTPUT_LINE_LIMIT = 500

// SVN Debug Logger
export class SvnLogger {
	private static outputChannel: vscode.OutputChannel | null = null

	static getOutputChannel(): vscode.OutputChannel {
		if (!this.outputChannel) {
			this.outputChannel = vscode.window.createOutputChannel("Roo Code - SVN Debug")
		}
		return this.outputChannel
	}

	static debug(message: string, ...args: any[]) {
		const timestamp = new Date().toISOString()
		const logMessage = `[${timestamp}] [DEBUG] ${message}`

		// Log to console
		console.log(logMessage, ...args)

		// Log to VS Code output channel
		const channel = this.getOutputChannel()
		channel.appendLine(logMessage)
		if (args.length > 0) {
			channel.appendLine(`  Args: ${JSON.stringify(args, null, 2)}`)
		}
	}

	static error(message: string, error?: any) {
		const timestamp = new Date().toISOString()
		const logMessage = `[${timestamp}] [ERROR] ${message}`

		// Log to console
		console.error(logMessage, error)

		// Log to VS Code output channel
		const channel = this.getOutputChannel()
		channel.appendLine(logMessage)
		if (error) {
			channel.appendLine(`  Error: ${error.toString()}`)
			if (error.stack) {
				channel.appendLine(`  Stack: ${error.stack}`)
			}
		}
	}

	static info(message: string, ...args: any[]) {
		const timestamp = new Date().toISOString()
		const logMessage = `[${timestamp}] [INFO] ${message}`

		// Log to console
		console.log(logMessage, ...args)

		// Log to VS Code output channel
		const channel = this.getOutputChannel()
		channel.appendLine(logMessage)
		if (args.length > 0) {
			channel.appendLine(`  Data: ${JSON.stringify(args, null, 2)}`)
		}
	}

	static showOutput() {
		this.getOutputChannel().show()
	}
}

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
	SvnLogger.debug("getSvnRepositoryInfo called", { workspaceRoot })

	try {
		const svnDir = path.join(workspaceRoot, ".svn")
		SvnLogger.debug("Checking SVN directory", { svnDir })

		// Check if .svn directory exists
		try {
			await fs.access(svnDir)
			SvnLogger.debug("SVN directory found")
		} catch (error) {
			SvnLogger.debug("SVN directory not found - not an SVN repository", {
				error: (error instanceof Error ? error : new Error(String(error))).toString(),
			})
			return {}
		}

		const svnInfo: SvnRepositoryInfo = {}

		// Try to get SVN info using svn info command
		try {
			SvnLogger.debug("Executing 'svn info' command", { cwd: workspaceRoot })
			const { stdout } = await execAsync("svn info", { cwd: workspaceRoot })
			SvnLogger.debug("SVN info command output", { stdout })

			// Parse SVN info output
			const urlMatch = stdout.match(/^URL:\s*(.+)$/m)
			if (urlMatch && urlMatch[1]) {
				const url = urlMatch[1].trim()
				svnInfo.repositoryUrl = url
				svnInfo.repositoryName = extractSvnRepositoryName(url)
				SvnLogger.debug("Extracted repository info", { url, repositoryName: svnInfo.repositoryName })
			} else {
				SvnLogger.debug("No URL found in SVN info output")
			}

			const rootMatch = stdout.match(/^Working Copy Root Path:\s*(.+)$/m)
			if (rootMatch && rootMatch[1]) {
				svnInfo.workingCopyRoot = rootMatch[1].trim()
				SvnLogger.debug("Found working copy root", { workingCopyRoot: svnInfo.workingCopyRoot })
			} else {
				SvnLogger.debug("No working copy root found in SVN info output")
			}
		} catch (error) {
			SvnLogger.error("SVN info command failed", error instanceof Error ? error : new Error(String(error)))
		}

		SvnLogger.info("Final SVN repository info", svnInfo)
		return svnInfo
	} catch (error) {
		SvnLogger.error("Error in getSvnRepositoryInfo", error instanceof Error ? error : new Error(String(error)))
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
	SvnLogger.debug("checkSvnRepo called", { cwd })

	try {
		const svnDir = path.join(cwd, ".svn")
		await fs.access(svnDir)
		SvnLogger.debug("SVN repository detected", { svnDir })
		return true
	} catch (error) {
		SvnLogger.debug("Not an SVN repository", {
			cwd,
			error: (error instanceof Error ? error : new Error(String(error))).toString(),
		})
		return false
	}
}

/**
 * Checks if SVN is installed and available
 * @returns True if SVN is available, false otherwise
 */
export async function checkSvnInstalled(): Promise<boolean> {
	SvnLogger.debug("checkSvnInstalled called")

	try {
		const { stdout } = await execAsync("svn --version")
		SvnLogger.debug("SVN is installed", { version: stdout.split("\n")[0] })
		return true
	} catch (error) {
		SvnLogger.error(
			"SVN is not installed or not available",
			error instanceof Error ? error : new Error(String(error)),
		)
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
	SvnLogger.debug("searchSvnCommits called", { query, cwd })

	try {
		// Check if SVN is available
		const svnInstalled = await checkSvnInstalled()
		const isSvnRepo = await checkSvnRepo(cwd)

		SvnLogger.debug("SVN availability check", { svnInstalled, isSvnRepo })

		if (!svnInstalled || !isSvnRepo) {
			SvnLogger.debug("SVN not available or not a repository, returning empty array")
			return []
		}

		const commits: SvnCommit[] = []

		// If query looks like a revision number, search for that specific revision
		if (/^\d+$/.test(query)) {
			SvnLogger.debug("Query looks like revision number, searching for specific revision", { revision: query })
			try {
				const command = `svn log -r ${query} --xml`
				SvnLogger.debug("Executing revision search command", { command, cwd })

				const { stdout } = await execAsync(command, { cwd })
				SvnLogger.debug("Revision search output", { stdout })

				const revisionCommits = parseSvnLogXml(stdout)
				commits.push(...revisionCommits)
				SvnLogger.debug("Found commits for revision", {
					count: revisionCommits.length,
					commits: revisionCommits,
				})
			} catch (error) {
				SvnLogger.debug("Revision search failed, continuing with general search", {
					error: (error instanceof Error ? error : new Error(String(error))).toString(),
				})
			}
		}

		// Search in commit messages (get recent commits and filter)
		try {
			const command = "svn log -l 100 --xml"
			SvnLogger.debug("Executing message search command", { command, cwd })

			const { stdout } = await execAsync(command, { cwd })
			SvnLogger.debug("Message search output length", { outputLength: stdout.length })

			const allCommits = parseSvnLogXml(stdout)
			SvnLogger.debug("Parsed all commits", { count: allCommits.length })

			// Filter commits by message content
			const messageMatches = allCommits.filter(
				(commit) => commit.message.toLowerCase().includes(query.toLowerCase()) || commit.revision === query,
			)
			SvnLogger.debug("Filtered commits by message", { matchCount: messageMatches.length, query })

			// Add unique commits (avoid duplicates from revision search)
			messageMatches.forEach((commit) => {
				if (!commits.some((c) => c.revision === commit.revision)) {
					commits.push(commit)
				}
			})
		} catch (error) {
			SvnLogger.error("Message search failed", error instanceof Error ? error : new Error(String(error)))
		}

		const finalCommits = commits.slice(0, 20) // Limit results
		SvnLogger.info("Search completed", {
			query,
			totalFound: commits.length,
			returned: finalCommits.length,
			commits: finalCommits,
		})
		return finalCommits
	} catch (error) {
		SvnLogger.error("Error searching SVN commits", error instanceof Error ? error : new Error(String(error)))
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
		console.log("[DEBUG] getSvnWorkingState called with cwd:", cwd)

		if (!(await checkSvnInstalled()) || !(await checkSvnRepo(cwd))) {
			console.log("[DEBUG] SVN not installed or not a repository")
			return { status: "", diff: "" }
		}

		// Get status
		let status = ""
		try {
			console.log("[DEBUG] Executing 'svn status' command")
			const { stdout: statusOutput } = await execAsync("svn status", { cwd })
			console.log("[DEBUG] SVN status raw output:", JSON.stringify(statusOutput))
			status = truncateOutput(statusOutput, SVN_OUTPUT_LINE_LIMIT)
			console.log("[DEBUG] SVN status after truncation:", JSON.stringify(status))
		} catch (error) {
			console.log("[DEBUG] SVN status command failed:", error)
			// Status might not be available
		}

		// Get diff of working changes
		let diff = ""
		try {
			console.log("[DEBUG] Executing 'svn diff' command")
			const { stdout: diffOutput } = await execAsync("svn diff", { cwd })
			console.log("[DEBUG] SVN diff raw output length:", diffOutput.length)
			console.log("[DEBUG] SVN diff raw output preview:", JSON.stringify(diffOutput.substring(0, 500)))
			diff = truncateOutput(diffOutput, SVN_OUTPUT_LINE_LIMIT)
			console.log("[DEBUG] SVN diff after truncation length:", diff.length)
		} catch (error) {
			console.log("[DEBUG] SVN diff command failed:", error)
			// Diff might not be available
		}

		// If diff is empty but we have untracked files, provide additional information
		if (!diff.trim() && status.trim()) {
			const untrackedFiles = status
				.split("\n")
				.filter((line) => line.trim().startsWith("?"))
				.map((line) => line.trim().substring(1).trim())

			if (untrackedFiles.length > 0) {
				console.log("[DEBUG] Found untracked files, attempting to show content preview")
				let additionalInfo = "\n\nNote: The following files are untracked (not under version control):\n"

				for (const file of untrackedFiles.slice(0, 3)) {
					// Limit to first 3 files
					try {
						const filePath = path.resolve(cwd, file)
						const stats = await fs.stat(filePath)

						if (stats.isFile() && stats.size < 10000) {
							// Only show content for small files
							const content = await fs.readFile(filePath, "utf-8")
							const preview = content.length > 500 ? content.substring(0, 500) + "..." : content
							additionalInfo += `\n--- Content of ${file} ---\n${preview}\n`
						} else {
							additionalInfo += `\n--- ${file} (${stats.isFile() ? "file" : "directory"}) ---\n`
						}
					} catch (error) {
						additionalInfo += `\n--- ${file} (unable to read: ${error.message}) ---\n`
					}
				}

				if (untrackedFiles.length > 3) {
					additionalInfo += `\n... and ${untrackedFiles.length - 3} more untracked files`
				}

				diff = additionalInfo
			}
		}

		const result = { status, diff }
		console.log("[DEBUG] getSvnWorkingState returning:", JSON.stringify(result))
		return result
	} catch (error) {
		console.error("[DEBUG] Error in getSvnWorkingState:", error)
		return { status: "", diff: "" }
	}
}

/**
 * Gets formatted SVN commit information for mentions
 * @param revision The revision number (can be with or without 'r' prefix)
 * @param cwd The working directory
 * @returns Formatted commit information string
 */
export async function getSvnCommitInfoForMentions(revision: string, cwd: string): Promise<string> {
	try {
		console.log("[DEBUG] getSvnCommitInfoForMentions called with revision:", revision, "cwd:", cwd)

		if (!(await checkSvnInstalled()) || !(await checkSvnRepo(cwd))) {
			console.log("[DEBUG] SVN not installed or not a repository")
			return "Error: SVN not available or not an SVN repository"
		}

		// Clean revision number (remove 'r' prefix if present)
		const cleanRevision = revision.replace(/^r/i, "")
		console.log("[DEBUG] Clean revision:", cleanRevision)

		// Get commit info
		const { stdout: logOutput } = await execAsync(`svn log -r ${cleanRevision} -v`, { cwd })
		console.log("[DEBUG] SVN log output:", logOutput)

		// Parse the log output
		const lines = logOutput.split("\n")
		let commitInfo = ""
		let author = ""
		let date = ""
		let message = ""
		let changedPaths = ""

		// Find the revision line
		const revisionLineIndex = lines.findIndex((line) => line.includes(`r${cleanRevision}`))
		if (revisionLineIndex >= 0) {
			const revisionLine = lines[revisionLineIndex]
			const match = revisionLine.match(/r(\d+)\s+\|\s+([^|]+)\s+\|\s+([^|]+)\s+\|/)
			if (match) {
				author = match[2].trim()
				date = match[3].trim()
			}
		}

		// Find changed paths
		const changedPathsStart = lines.findIndex((line) => line.includes("Changed paths:"))
		if (changedPathsStart >= 0) {
			let i = changedPathsStart + 1
			const pathLines = []
			while (i < lines.length && lines[i].trim() && !lines[i].startsWith("-")) {
				if (lines[i].trim()) {
					pathLines.push(lines[i].trim())
				}
				i++
			}
			changedPaths = pathLines.join("\n")
		}

		// Find message
		const messageStart = lines.findIndex(
			(line, index) =>
				index > revisionLineIndex && line.trim() && !line.startsWith("-") && !line.includes("Changed paths:"),
		)
		if (messageStart >= 0) {
			let i = messageStart
			const messageLines = []
			while (i < lines.length && !lines[i].startsWith("-")) {
				if (lines[i].trim()) {
					messageLines.push(lines[i].trim())
				}
				i++
			}
			message = messageLines.join("\n")
		}

		// Get diff
		let diff = ""
		try {
			const { stdout: diffOutput } = await execAsync(`svn diff -c ${cleanRevision}`, { cwd })
			diff = truncateOutput(diffOutput, SVN_OUTPUT_LINE_LIMIT)
		} catch (error) {
			console.log("[DEBUG] SVN diff command failed:", error)
			diff = "Diff not available"
		}

		// Format the output
		commitInfo = `Revision: r${cleanRevision}\n`
		commitInfo += `Author: ${author}\n`
		commitInfo += `Date: ${date}\n\n`
		commitInfo += `Message: ${message}\n\n`

		if (changedPaths) {
			commitInfo += `Changed Paths:\n${changedPaths}\n\n`
		}

		if (diff && diff.trim()) {
			commitInfo += `Full Changes:\n\n${diff}`
		}

		console.log("[DEBUG] Formatted commit info:", commitInfo)
		return commitInfo
	} catch (error) {
		console.error("[DEBUG] Error getting SVN commit info for mentions:", error)
		return `Error fetching SVN commit r${revision}: ${error.message}`
	}
}
