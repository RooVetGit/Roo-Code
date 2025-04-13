import * as vscode from "vscode"
import * as path from "path"
import { openFile } from "../../integrations/misc/open-file"
import { UrlContentFetcher } from "../../services/browser/UrlContentFetcher"
import { mentionRegexGlobal, formatGitSuggestion, type MentionSuggestion } from "../../shared/context-mentions"
import fs from "fs/promises"
import { extractTextFromFile } from "../../integrations/misc/extract-text"
import { isBinaryFile } from "isbinaryfile"
import { diagnosticsToProblemsString } from "../../integrations/diagnostics"
import { getCommitInfo, getWorkingState } from "../../utils/git"
import { getLatestTerminalOutput } from "../../integrations/terminal/get-latest-output"
import { getWorkspacePath } from "../../utils/path"
import { FileContextTracker } from "../context-tracking/FileContextTracker"

/**
 * Helper function to unescape spaces in file paths that were escaped with a backslash.
 * e.g., "file\ with\ spaces.txt" becomes "file with spaces.txt"
 *
 * This is critical for converting displayed/stored paths (with escaped spaces) to
 * actual file system paths that can be used with Node.js fs functions.
 */
function unescapePathSpaces(escapedPath: string): string {
	try {
		// Use the original regex logic which should be correct for \ followed by space
		const result = escapedPath.replace(/\\ /g, " ")
		return result
	} catch (error) {
		// If any error occurs, log it and return the original path
		console.error("Error in unescapePathSpaces:", error)
		return escapedPath
	}
}

export async function openMention(mention?: string): Promise<void> {
	if (!mention) {
		return
	}

	const cwd = getWorkspacePath()
	if (!cwd) {
		return
	}

	if (mention.startsWith("/")) {
		const relPathWithEscapes = mention.slice(1)
		const relPath = unescapePathSpaces(relPathWithEscapes) // Unescape spaces
		const absPath = path.resolve(cwd, relPath)
		if (mention.endsWith("/")) {
			vscode.commands.executeCommand("revealInExplorer", vscode.Uri.file(absPath))
		} else {
			openFile(absPath)
		}
	} else if (mention === "problems") {
		vscode.commands.executeCommand("workbench.actions.view.problems")
	} else if (mention === "terminal") {
		vscode.commands.executeCommand("workbench.action.terminal.focus")
	} else if (mention.startsWith("http")) {
		vscode.env.openExternal(vscode.Uri.parse(mention))
	}
}

export async function parseMentions(
	text: string,
	cwd: string,
	urlContentFetcher: UrlContentFetcher,
	fileContextTracker?: FileContextTracker,
): Promise<string> {
	// Store full mentions and their corresponding values (capture group 1)
	const mentionDetails: { fullMatch: string; value: string }[] = []
	const matches = Array.from(text.matchAll(mentionRegexGlobal))

	for (const match of matches) {
		const fullMention = match[0] // e.g., @/path\ with\ spaces.txt
		const mentionValue = match[1] // e.g., /path\ with\ spaces.txt
		mentionDetails.push({ fullMatch: fullMention, value: mentionValue })
	}

	// Store the replacements separately
	const replacements: { original: string; replacement: string }[] = []

	// Build replacement strings based on the *value* (capture group)
	for (const detail of mentionDetails) {
		const { fullMatch, value } = detail
		let replacementText = fullMatch // Default to original

		if (value.startsWith("http")) {
			replacementText = `'${value}' (see below for site content)`
		} else if (value.startsWith("/")) {
			const mentionPath = value.slice(1)
			replacementText = mentionPath.endsWith("/")
				? `'${mentionPath}' (see below for folder content)`
				: `'${mentionPath}' (see below for file content)`
		} else if (value === "problems") {
			replacementText = `Workspace Problems (see below for diagnostics)`
		} else if (value === "git-changes") {
			replacementText = `Working directory changes (see below for details)`
		} else if (/^[a-f0-9]{7,40}$/.test(value)) {
			replacementText = `Git commit '${value}' (see below for commit info)`
		} else if (value === "terminal") {
			replacementText = `Terminal Output (see below for output)`
		}

		replacements.push({ original: fullMatch, replacement: replacementText })
	}

	// Apply replacements to the original text
	let parsedText = text
	for (const rep of replacements) {
		// Ensure we only replace the exact original match
		// This avoids issues if the same mention value appears multiple times
		parsedText = parsedText.replace(rep.original, rep.replacement)
	}

	const urlMentionDetails = mentionDetails.find((detail) => detail.value.startsWith("http"))
	let launchBrowserError: Error | undefined
	if (urlMentionDetails) {
		try {
			await urlContentFetcher.launchBrowser()
		} catch (error) {
			launchBrowserError = error as Error
			vscode.window.showErrorMessage(
				`Error fetching content for ${urlMentionDetails.value}: ${(error as Error).message}`,
			)
		}
	}

	// Process content fetching based on the extracted details
	for (const detail of mentionDetails) {
		const { fullMatch, value } = detail // Use both fullMatch and value

		if (value.startsWith("http")) {
			let result: string
			if (launchBrowserError) {
				result = `Error fetching content: ${launchBrowserError.message}`
			} else {
				try {
					const markdown = await urlContentFetcher.urlToMarkdown(value) // Use value for URL
					result = markdown
				} catch (error) {
					vscode.window.showErrorMessage(`Error fetching content for ${value}: ${(error as Error).message}`)
					result = `Error fetching content: ${(error as Error).message}`
				}
			}
			parsedText += `\n\n<url_content url="${value}">\n${result}\n</url_content>`
		} else if (value.startsWith("/")) {
			// FIX: Extract path part, potentially removing leading '@'
			let mentionPathWithEscapes = fullMatch.startsWith("@") ? fullMatch.slice(1) : value

			// FIX: Create a relative path by removing the leading '/' for resolution
			let relativePathForResolve = mentionPathWithEscapes.startsWith("/")
				? mentionPathWithEscapes.slice(1)
				: mentionPathWithEscapes

			try {
				const content = await getFileOrFolderContent(relativePathForResolve, cwd)

				// Check original value for the logical type (file/folder)
				if (value.endsWith("/")) {
					// FIX: Remove leading slash from display path if present
					const displayPath = mentionPathWithEscapes.startsWith("/")
						? mentionPathWithEscapes.slice(1)
						: mentionPathWithEscapes
					parsedText += `\n\n<folder_content path="${displayPath}">\n${content}\n</folder_content>`
				} else {
					// FIX: Remove leading slash from display path if present
					const displayPath = mentionPathWithEscapes.startsWith("/")
						? mentionPathWithEscapes.slice(1)
						: mentionPathWithEscapes
					parsedText += `\n\n<file_content path="${displayPath}">\n${content}\n</file_content>`
					if (fileContextTracker) {
						await fileContextTracker.trackFileContext(relativePathForResolve, "file_mentioned")
					}
				}
			} catch (error) {
				const errorMessage = (error as Error).message
				// FIX: Remove leading slash from display path in error case too
				const displayPath = mentionPathWithEscapes.startsWith("/")
					? mentionPathWithEscapes.slice(1)
					: mentionPathWithEscapes
				if (value.endsWith("/")) {
					parsedText += `\n\n<folder_content path="${displayPath}">\nError fetching content: ${errorMessage}\n</folder_content>`
				} else {
					parsedText += `\n\n<file_content path="${displayPath}">\nError fetching content: ${errorMessage}\n</file_content>`
				}
			}
		} else if (value === "problems") {
			try {
				const problems = await getWorkspaceProblems(cwd)
				parsedText += `\n\n<workspace_diagnostics>\n${problems}\n</workspace_diagnostics>`
			} catch (error) {
				parsedText += `\n\n<workspace_diagnostics>\nError fetching diagnostics: ${(error as Error).message}\n</workspace_diagnostics>`
			}
		} else if (value === "git-changes") {
			try {
				const workingState = await getWorkingState(cwd)
				parsedText += `\n\n<git_working_state>\n${workingState}\n</git_working_state>`
			} catch (error) {
				parsedText += `\n\n<git_working_state>\nError fetching working state: ${(error as Error).message}\n</git_working_state>`
			}
		} else if (/^[a-f0-9]{7,40}$/.test(value)) {
			try {
				const commitInfo = await getCommitInfo(value, cwd)
				parsedText += `\n\n<git_commit hash="${value}">\n${commitInfo}\n</git_commit>`
			} catch (error) {
				parsedText += `\n\n<git_commit hash="${value}">\nError fetching commit info: ${(error as Error).message}\n</git_commit>`
			}
		} else if (value === "terminal") {
			try {
				const terminalOutput = await getLatestTerminalOutput()
				parsedText += `\n\n<terminal_output>\n${terminalOutput}\n</terminal_output>`
			} catch (error) {
				parsedText += `\n\n<terminal_output>\nError fetching terminal output: ${(error as Error).message}\n</terminal_output>`
			}
		}
	}

	if (urlMentionDetails) {
		try {
			await urlContentFetcher.closeBrowser()
		} catch (error) {
			console.error(`Error closing browser: ${error.message}`)
		}
	}

	return parsedText
}

async function getFileOrFolderContent(mentionPathWithEscapes: string, cwd: string): Promise<string> {
	const mentionPath = unescapePathSpaces(mentionPathWithEscapes) // Unescape before resolving
	const absPath = path.resolve(cwd, mentionPath)

	try {
		const stats = await fs.stat(absPath)

		if (stats.isFile()) {
			try {
				const content = await extractTextFromFile(absPath)
				return content
			} catch (error) {
				// Use the unescaped path for error messages that reference the resolved path
				return `(Failed to read contents of ${mentionPath}): ${error.message}`
			}
		} else if (stats.isDirectory()) {
			const entries = await fs.readdir(absPath, { withFileTypes: true })
			let folderContent = ""
			const fileContentPromises: Promise<string | undefined>[] = []
			entries.forEach((entry, index) => {
				const isLast = index === entries.length - 1
				const linePrefix = isLast ? "└── " : "├── "
				if (entry.isFile()) {
					folderContent += `${linePrefix}${entry.name}\n`
					// Use the original escaped path for constructing nested mention paths
					const escapedFilePath = path
						.join(mentionPathWithEscapes, entry.name)
						.replace(/\\/g, "/")
						.replace(/ /g, "\\ ")
					// Use the unescaped path for resolving absolute path
					const absoluteFilePath = path.resolve(absPath, entry.name)
					fileContentPromises.push(
						(async () => {
							try {
								const isBinary = await isBinaryFile(absoluteFilePath).catch(() => false)
								if (isBinary) {
									return undefined
								}
								const content = await extractTextFromFile(absoluteFilePath)
								// Use the properly escaped path for the XML tag
								return `<file_content path="${escapedFilePath}">\n${content}\n</file_content>`
							} catch (error) {
								return undefined
							}
						})(),
					)
				} else if (entry.isDirectory()) {
					folderContent += `${linePrefix}${entry.name}/\n`
				} else {
					folderContent += `${linePrefix}${entry.name}\n`
				}
			})
			const fileContents = (await Promise.all(fileContentPromises)).filter((content) => content)
			return `${folderContent}\n${fileContents.join("\n\n")}`.trim()
		} else {
			// Use the unescaped path for error messages
			return `(Failed to read contents of ${mentionPath})`
		}
	} catch (error) {
		// Use the unescaped path for error messages
		throw new Error(`Failed to access path "${mentionPath}": ${error.message}`)
	}
}

async function getWorkspaceProblems(cwd: string): Promise<string> {
	const diagnostics = vscode.languages.getDiagnostics()
	const result = await diagnosticsToProblemsString(
		diagnostics,
		[vscode.DiagnosticSeverity.Error, vscode.DiagnosticSeverity.Warning],
		cwd,
	)
	if (!result) {
		return "No errors or warnings detected."
	}
	return result
}
