import * as vscode from "vscode"
import * as path from "path"
import { promises as fs } from "fs"
import { exec } from "child_process"
import { promisify } from "util"
import { truncateOutput } from "../integrations/misc/extract-text"
import * as os from "os"

/**
 * Convert SVN command output buffer to string with cross-platform encoding support
 * @param output Buffer or string output from SVN command
 * @returns Properly decoded string
 */
function convertSvnOutput(output: Buffer | string): string {
	if (typeof output === "string") {
		return output
	}

	// Try UTF-8 first (works for Linux/macOS and modern Windows)
	try {
		const utf8Result = output.toString("utf8")
		// Check if the result contains replacement characters (indicates encoding issues)
		if (!utf8Result.includes("\uFFFD")) {
			return utf8Result
		}
	} catch (error) {
		// UTF-8 decoding failed
	}

	// On Windows, try common Chinese encodings if UTF-8 failed
	if (os.platform() === "win32") {
		try {
			// Try GBK/GB2312 encoding (common on Chinese Windows systems)
			// Note: Node.js doesn't support GBK directly, so we'll use latin1 as fallback
			// and let the system handle the encoding
			return output.toString("latin1")
		} catch (error) {
			// Fallback to latin1 if all else fails
		}
	}

	// Final fallback: use UTF-8 even if it has replacement characters
	return output.toString("utf8")
}

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
 * Enhanced error handling with user-friendly messages
 */
class SvnErrorHandler {
	/**
	 * Shows user-friendly error message with guidance
	 */
	static async showSvnNotInstalledError(): Promise<void> {
		const action = await vscode.window.showErrorMessage(
			"SVN is not installed or not available in PATH",
			{
				modal: false,
				detail: "SVN command line tool is required for SVN operations. Please install SVN and ensure it's available in your system PATH.",
			},
			"Install Guide",
			"Check PATH",
		)

		if (action === "Install Guide") {
			vscode.env.openExternal(vscode.Uri.parse("https://subversion.apache.org/packages.html"))
		} else if (action === "Check PATH") {
			vscode.window.showInformationMessage("To check if SVN is in PATH, open terminal and run: svn --version", {
				modal: false,
			})
		}
	}

	/**
	 * Shows user-friendly message when not in SVN repository
	 */
	static async showNotSvnRepositoryError(workspacePath: string): Promise<void> {
		const action = await vscode.window.showWarningMessage(
			"Current workspace is not an SVN repository",
			{
				modal: false,
				detail: `The directory "${workspacePath}" does not contain a .svn folder. SVN operations are only available in SVN working copies.`,
			},
			"Learn More",
			"Initialize SVN",
		)

		if (action === "Learn More") {
			vscode.env.openExternal(vscode.Uri.parse("https://svnbook.red-bean.com/en/1.7/svn.basic.html"))
		} else if (action === "Initialize SVN") {
			vscode.window.showInformationMessage(
				"To initialize SVN repository, use: svn checkout <repository-url> or svn import",
				{ modal: false },
			)
		}
	}

	/**
	 * Shows network/connection error with guidance
	 */
	static async showNetworkError(error: Error): Promise<void> {
		const action = await vscode.window.showErrorMessage(
			"SVN network operation failed",
			{
				modal: false,
				detail: `Network error: ${error.message}. This could be due to network connectivity issues, server problems, or authentication failures.`,
			},
			"Retry",
			"Check Connection",
		)

		if (action === "Check Connection") {
			vscode.window.showInformationMessage(
				"Please check:\n• Network connectivity\n• SVN server status\n• Authentication credentials\n• Firewall settings",
				{ modal: false },
			)
		}
	}

	/**
	 * Shows repository corruption error with guidance
	 */
	static async showRepositoryCorruptionError(workspacePath: string): Promise<void> {
		const action = await vscode.window.showErrorMessage(
			"SVN repository appears to be corrupted",
			{
				modal: false,
				detail: `The .svn directory in "${workspacePath}" may be corrupted or incomplete. This can happen due to interrupted operations or file system issues.`,
			},
			"Cleanup",
			"Get Help",
		)

		if (action === "Cleanup") {
			vscode.window.showInformationMessage(
				"Try running: svn cleanup\nIf that fails, you may need to re-checkout the repository.",
				{ modal: false },
			)
		} else if (action === "Get Help") {
			vscode.env.openExternal(vscode.Uri.parse("https://svnbook.red-bean.com/en/1.7/svn.ref.svn.c.cleanup.html"))
		}
	}

	/**
	 * Shows permission error with guidance
	 */
	static async showPermissionError(error: Error): Promise<void> {
		const action = await vscode.window.showErrorMessage(
			"SVN operation failed due to permission issues",
			{
				modal: false,
				detail: `Permission denied: ${error.message}. This could be due to file system permissions or SVN server access rights.`,
			},
			"Check Permissions",
			"Get Help",
		)

		if (action === "Check Permissions") {
			vscode.window.showInformationMessage(
				"Please check:\n• File/folder permissions\n• SVN server access rights\n• User authentication\n• Write permissions in working directory",
				{ modal: false },
			)
		}
	}

	/**
	 * Shows feature unavailable message with graceful degradation
	 */
	static showFeatureUnavailable(feature: string, reason: string): void {
		vscode.window.showWarningMessage(`SVN ${feature} is currently unavailable`, {
			modal: false,
			detail: `${reason}. Some SVN features may be limited until this is resolved.`,
		})
	}

	/**
	 * Determines error type and shows appropriate message
	 */
	static async handleSvnError(error: Error, context: string, workspacePath?: string): Promise<void> {
		const errorMessage = error.message.toLowerCase()

		// Network/connection errors
		if (
			errorMessage.includes("network") ||
			errorMessage.includes("connection") ||
			errorMessage.includes("timeout") ||
			errorMessage.includes("unreachable") ||
			errorMessage.includes("resolve")
		) {
			await this.showNetworkError(error)
			return
		}

		// Permission errors
		if (
			errorMessage.includes("permission") ||
			errorMessage.includes("access denied") ||
			errorMessage.includes("forbidden") ||
			errorMessage.includes("eacces")
		) {
			await this.showPermissionError(error)
			return
		}

		// Repository corruption
		if (
			errorMessage.includes("corrupt") ||
			errorMessage.includes("invalid") ||
			errorMessage.includes("malformed") ||
			errorMessage.includes("cleanup")
		) {
			if (workspacePath) {
				await this.showRepositoryCorruptionError(workspacePath)
				return
			}
		}

		// SVN not found
		if (
			errorMessage.includes("not found") ||
			errorMessage.includes("command not found") ||
			errorMessage.includes("is not recognized")
		) {
			await this.showSvnNotInstalledError()
			return
		}

		// Generic error with context
		vscode.window
			.showErrorMessage(
				`SVN ${context} failed`,
				{
					modal: false,
					detail: `Error: ${error.message}\n\nPlease check the SVN Debug output channel for more details.`,
				},
				"Show Output",
			)
			.then((action) => {
				if (action === "Show Output") {
					SvnLogger.showOutput()
				}
			})
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
		const svnError = error instanceof Error ? error : new Error(String(error))
		SvnLogger.error("SVN is not installed or not available", svnError)

		// Show user-friendly error message
		await SvnErrorHandler.showSvnNotInstalledError()
		return false
	}
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
		const svnError = error instanceof Error ? error : new Error(String(error))
		SvnLogger.debug("Not an SVN repository", {
			cwd,
			error: svnError.toString(),
		})

		// Show user-friendly message for workspace operations
		if (cwd === vscode.workspace.workspaceFolders?.[0]?.uri.fsPath) {
			await SvnErrorHandler.showNotSvnRepositoryError(cwd)
		}
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
		if (!svnInstalled) {
			SvnErrorHandler.showFeatureUnavailable("search", "SVN is not installed")
			return []
		}

		const isSvnRepo = await checkSvnRepo(cwd)
		if (!isSvnRepo) {
			SvnErrorHandler.showFeatureUnavailable("search", "Not an SVN repository")
			return []
		}

		SvnLogger.debug("SVN availability check", { svnInstalled, isSvnRepo })

		const commits: SvnCommit[] = []

		// If query looks like a revision number with 'r' prefix, search for that specific revision
		// Only support "r123" format, not pure numbers
		const revisionMatch = query.match(/^r(\d+)$/i)
		if (revisionMatch) {
			const revisionNumber = revisionMatch[1]
			SvnLogger.debug("Query looks like revision number, searching for specific revision", {
				originalQuery: query,
				revision: revisionNumber,
			})
			try {
				const command = `svn log -r ${revisionNumber} --xml`
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
				const svnError = error instanceof Error ? error : new Error(String(error))
				SvnLogger.debug("Revision search failed, continuing with general search", {
					error: svnError.toString(),
				})
				await SvnErrorHandler.handleSvnError(svnError, "revision search", cwd)
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

			// Filter commits by message content or revision match
			const messageMatches = allCommits.filter((commit) => {
				// Check message content match
				const messageMatch = commit.message.toLowerCase().includes(query.toLowerCase())

				// Check revision match (only handle "r123" format, not pure numbers)
				let revisionMatch = false
				const revisionMatchResult = query.match(/^r(\d+)$/i)
				if (revisionMatchResult) {
					const queryRevision = revisionMatchResult[1]
					revisionMatch = commit.revision === queryRevision
				}

				return messageMatch || revisionMatch
			})
			SvnLogger.debug("Filtered commits by message", { matchCount: messageMatches.length, query })

			// Add unique commits (avoid duplicates from revision search)
			messageMatches.forEach((commit) => {
				if (!commits.some((c) => c.revision === commit.revision)) {
					commits.push(commit)
				}
			})
		} catch (error) {
			const svnError = error instanceof Error ? error : new Error(String(error))
			SvnLogger.error("Message search failed", svnError)
			await SvnErrorHandler.handleSvnError(svnError, "commit search", cwd)
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
		const svnError = error instanceof Error ? error : new Error(String(error))
		SvnLogger.error("Error searching SVN commits", svnError)
		await SvnErrorHandler.handleSvnError(svnError, "commit search", cwd)
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
		const svnInstalled = await checkSvnInstalled()
		const isSvnRepo = await checkSvnRepo(cwd)

		if (!svnInstalled || !isSvnRepo) {
			if (!svnInstalled) {
				SvnErrorHandler.showFeatureUnavailable("commit info", "SVN is not installed")
			} else {
				SvnErrorHandler.showFeatureUnavailable("commit info", "Not an SVN repository")
			}
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
		} catch (error) {
			const svnError = error instanceof Error ? error : new Error(String(error))
			SvnLogger.debug("Diff not available for revision", { revision, error: svnError.message })
		}

		// Get stats (changed files)
		let stats = ""
		try {
			const { stdout: changedOutput } = await execAsync(`svn log -r ${revision} -v`, { cwd })
			const changedMatch = changedOutput.match(/Changed paths:([\s\S]*?)(?=\n\n|\n-{72}|\n$)/)
			if (changedMatch) {
				stats = changedMatch[1].trim()
			}
		} catch (error) {
			const svnError = error instanceof Error ? error : new Error(String(error))
			SvnLogger.debug("Stats not available for revision", { revision, error: svnError.message })
		}

		return { commit, diff, stats }
	} catch (error) {
		const svnError = error instanceof Error ? error : new Error(String(error))
		SvnLogger.error("Error getting SVN commit info", svnError)
		await SvnErrorHandler.handleSvnError(svnError, "commit info", cwd)
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

		const svnInstalled = await checkSvnInstalled()
		const isSvnRepo = await checkSvnRepo(cwd)

		if (!svnInstalled || !isSvnRepo) {
			console.log("[DEBUG] SVN not installed or not a repository")
			if (!svnInstalled) {
				SvnErrorHandler.showFeatureUnavailable("working state", "SVN is not installed")
			} else {
				SvnErrorHandler.showFeatureUnavailable("working state", "Not an SVN repository")
			}
			return { status: "", diff: "" }
		}

		let status = ""
		try {
			console.log("[DEBUG] Executing 'svn status' command")
			const { stdout } = await execAsync("svn status", { cwd })
			console.log("[DEBUG] SVN status raw output:", JSON.stringify(stdout))
			status = truncateOutput(stdout, SVN_OUTPUT_LINE_LIMIT)
			console.log("[DEBUG] SVN status after truncation:", JSON.stringify(status))
		} catch (error) {
			const svnError = error instanceof Error ? error : new Error(String(error))
			console.log("[DEBUG] SVN status command failed:", svnError)
			await SvnErrorHandler.handleSvnError(svnError, "status check", cwd)
		}

		let diff = ""
		try {
			console.log("[DEBUG] Executing 'svn diff' command")
			const { stdout } = await execAsync("svn diff", { cwd })
			console.log("[DEBUG] SVN diff raw output length:", stdout.length)
			console.log("[DEBUG] SVN diff raw output preview:", JSON.stringify(stdout.substring(0, 500)))
			diff = truncateOutput(stdout, SVN_OUTPUT_LINE_LIMIT)
			console.log("[DEBUG] SVN diff after truncation length:", diff.length)
		} catch (error) {
			const svnError = error instanceof Error ? error : new Error(String(error))
			console.log("[DEBUG] SVN diff command failed:", svnError)
			await SvnErrorHandler.handleSvnError(svnError, "diff check", cwd)
		}

		// If no diff but there are changes, show untracked files info
		if (!diff.trim() && status.trim()) {
			const lines = status.split("\n").filter((line) => line.trim())
			if (lines.length > 3) {
				const visibleLines = lines.slice(0, 3)
				diff = visibleLines.join("\n") + `\n... and ${lines.length - 3} more untracked files`
			} else {
				diff = status
			}
		}

		const result = { status, diff }
		console.log("[DEBUG] getSvnWorkingState returning:", JSON.stringify(result))
		return result
	} catch (error) {
		const svnError = error instanceof Error ? error : new Error(String(error))
		console.error("[DEBUG] Error in getSvnWorkingState:", svnError)
		await SvnErrorHandler.handleSvnError(svnError, "working state", cwd)
		return { status: "", diff: "" }
	}
}

/**
 * Gets SVN commit information for mentions with enhanced error handling
 * @param revision The revision number (with or without 'r' prefix)
 * @param cwd The working directory
 * @returns Formatted commit information or error message
 */
export async function getSvnCommitInfoForMentions(revision: string, cwd: string): Promise<string> {
	try {
		console.log("[DEBUG] getSvnCommitInfoForMentions called with revision:", revision, "cwd:", cwd)

		const svnInstalled = await checkSvnInstalled()
		const isSvnRepo = await checkSvnRepo(cwd)

		if (!svnInstalled || !isSvnRepo) {
			console.log("[DEBUG] SVN not installed or not a repository")
			return "Error: SVN not available or not an SVN repository"
		}

		const cleanRevision = revision.replace(/^r/i, "")
		if (!/^\d+$/.test(cleanRevision)) {
			throw new Error("Invalid revision number format")
		}
		console.log("[DEBUG] Clean revision:", cleanRevision)

		// Use UTF-8 encoding to handle Chinese characters properly
		const { stdout } = await execAsync(`svn log -r ${cleanRevision} -v`, {
			cwd,
			encoding: "utf8",
		})
		console.log("[DEBUG] SVN log output:", stdout)

		// Parse the log output more carefully
		const lines = stdout.split("\n")

		// Find the header line (contains revision info)
		const headerLineIndex = lines.findIndex((line) => line.includes(`r${cleanRevision} |`))
		if (headerLineIndex === -1) {
			return `Revision ${revision} not found`
		}

		const headerLine = lines[headerLineIndex]
		const parts = headerLine.split("|").map((part) => part.trim())

		if (parts.length < 3) {
			return `Revision ${revision}: Unable to parse commit information`
		}

		const [rev, author, dateInfo] = parts
		// Extract just the date part, ignore the Chinese day name to avoid encoding issues
		const dateMatch = dateInfo.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [+-]\d{4})/)
		const date = dateMatch ? dateMatch[1] : dateInfo.split("(")[0].trim()

		// Find the commit message (after "Changed paths:" section)
		let message = "No message"
		let changedPaths = ""

		// Look for "Changed paths:" section
		const changedPathsIndex = lines.findIndex((line) => line.includes("Changed paths:"))
		if (changedPathsIndex !== -1) {
			// Extract changed paths
			const pathLines = []
			for (let i = changedPathsIndex + 1; i < lines.length; i++) {
				const line = lines[i]
				if (line.trim() === "" || line.startsWith("---")) {
					break
				}
				if (line.trim().match(/^[AMDRC]\s+\//)) {
					pathLines.push(line.trim())
				}
			}
			changedPaths = pathLines.join("\n")

			// Find message after the changed paths section
			for (let i = changedPathsIndex + 1; i < lines.length; i++) {
				const line = lines[i]
				if (line.trim() === "" && i + 1 < lines.length) {
					// Check if next line is not a separator and not empty
					const nextLine = lines[i + 1]
					if (nextLine && !nextLine.startsWith("---") && nextLine.trim() !== "") {
						// Found the message
						const messageLines = []
						for (let j = i + 1; j < lines.length; j++) {
							const msgLine = lines[j]
							if (msgLine.startsWith("---")) {
								break
							}
							if (msgLine.trim() !== "") {
								messageLines.push(msgLine)
							}
						}
						if (messageLines.length > 0) {
							message = messageLines.join("\n").trim()
						}
						break
					}
				}
			}
		}

		// Get diff information with cross-platform encoding compatibility
		let diff = ""
		try {
			console.log("[DEBUG] Getting diff for revision:", cleanRevision)
			const { stdout: rawDiffOutput } = await execAsync(`svn diff -c ${cleanRevision}`, {
				cwd,
			})
			const diffOutput = convertSvnOutput(rawDiffOutput)
			diff = truncateOutput(diffOutput, SVN_OUTPUT_LINE_LIMIT)
			console.log("[DEBUG] Diff length:", diff.length)
		} catch (error) {
			const svnError = error instanceof Error ? error : new Error(String(error))
			console.log("[DEBUG] Diff not available for revision:", svnError.message)
		}

		// Format the result with changed files and diff
		let result = `${rev} by ${author} on ${date}\n${message}`

		if (changedPaths) {
			result += `\n\nChanged files:\n${changedPaths}`
		}

		if (diff && diff.trim()) {
			result += `\n\nDiff:\n${diff}`
		}

		return result
	} catch (error) {
		const svnError = error instanceof Error ? error : new Error(String(error))
		console.error("[DEBUG] Error getting SVN commit info for mentions:", svnError)
		await SvnErrorHandler.handleSvnError(svnError, "commit info for mentions", cwd)
		return `Error retrieving revision ${revision}: ${svnError.message}`
	}
}
