//src/services/ripgrep/index.ts
import * as vscode from "vscode"
import * as childProcess from "child_process"
import * as path from "path"
import * as fs from "fs"
import * as readline from "readline"

const isWindows = /^win/.test(process.platform)
const binName = isWindows ? "rg.exe" : "rg"

const MAX_FILES = 100
const DEFAULT_TOKEN_LIMIT = 8000; // Default token limit

interface RipgrepMatch {
	file: string
	line: number
	column: number
	content: string
	lineNumber: number
	beforeContext: string[] // Changed to string array, limit to 1 line
	afterContext: string[]  // Changed to string array, limit to 1 line
}

interface RipgrepResult {
	matches: Map<string, RipgrepMatch[]>
	totalMatches: number
	isComplete: boolean
	truncatedDueToTokenLimit: boolean // Added flag for token limit truncation, renamed
}

async function getBinPath(vscodeAppRoot: string): Promise<string | undefined> {
	const checkPath = async (pkgFolder: string) => {
		const fullPath = path.join(vscodeAppRoot, pkgFolder, binName)
		return (await pathExists(fullPath)) ? fullPath : undefined
	}

	return (
		(await checkPath("node_modules/@vscode/ripgrep/bin/")) ||
		(await checkPath("node_modules/vscode-ripgrep/bin")) ||
		(await checkPath("node_modules.asar.unpacked/vscode-ripgrep/bin/")) ||
		(await checkPath("node_modules.asar.unpacked/@vscode/ripgrep/bin/"))
	)
}

async function pathExists(path: string): Promise<boolean> {
	return new Promise((resolve) => {
		fs.access(path, (err) => {
			resolve(err === null)
		})
	})
}

async function execRipgrep(bin: string, args: string[], tokenLimit: number): Promise<RipgrepResult> {
	return new Promise((resolve, reject) => {
		const rgProcess = childProcess.spawn(bin, args)
		const rl = readline.createInterface({
			input: rgProcess.stdout,
			crlfDelay: Infinity,
		})

		const matches = new Map<string, RipgrepMatch[]>()
		let totalMatches = 0
		let estimatedTokens = 0
		let isComplete = true
		let truncatedDueToTokenLimit = false // Renamed
		let currentMatch: RipgrepMatch | null = null // Changed to full RipgrepMatch type

		const processLine = (line: string) => {
			if (!line) return

			try {
				const parsed = JSON.parse(line)
				if (parsed.type === "match") {
					const file = parsed.data.path.text
					totalMatches++

					const match: RipgrepMatch = {
						file,
						line: parsed.data.line_number,
						column: parsed.data.submatches[0].start,
						content: parsed.data.lines.text,
						lineNumber: parsed.data.line_number,
						beforeContext: [],
						afterContext: [],
					}

					const matchTokens = Math.ceil(match.content.length / 4)

					if (estimatedTokens + matchTokens > tokenLimit) {
						isComplete = false
						truncatedDueToTokenLimit = true // Renamed
						rl.close()
						rgProcess.kill()
						return
					}
					estimatedTokens += matchTokens


					if (!matches.has(file)) {
						matches.set(file, [])
					}
					matches.get(file)!.push(match)
					currentMatch = match; // Track current match for context
				} else if (parsed.type === "context" && currentMatch) {
					const contextEntry = parsed.data.lines.text

					if (parsed.data.line_number < currentMatch.lineNumber!) {
						if (currentMatch.beforeContext.length < 1) { // Limit to 1 line before
							currentMatch.beforeContext.push(contextEntry)
						}
					} else {
						if (currentMatch.afterContext.length < 1) {  // Limit to 1 line after
							currentMatch.afterContext.push(contextEntry)
						}
					}
				}
			} catch (error) {
				console.error("Error parsing ripgrep output:", error)
			}
		}

		rl.on("line", processLine)

		let errorOutput = ""
		rgProcess.stderr.on("data", (data) => {
			errorOutput += data.toString()
		})

		rl.on("close", () => {
			if (errorOutput) {
				reject(new Error(`ripgrep process error: ${errorOutput}`))
			} else {
				resolve({
					matches,
					totalMatches,
					isComplete,
					truncatedDueToTokenLimit, // Renamed
				})
			}
		})

		rgProcess.on("error", (error) => {
			reject(new Error(`ripgrep process error: ${error.message}`))
		})
	})
}

interface SearchResult {
	matches: Array<{
		file: string
		line: number
		column: number
		content: string
		beforeContext: string[]
		afterContext: string[]
	}>
	summary: {
		totalMatches: number
		matchedFiles: number
		isComplete: boolean
		truncated: boolean
		truncatedDueToTokenLimit: boolean // Added flag for token limit truncation, renamed
	}
}

export async function regexSearchFiles(
	cwd: string,
	directoryPath: string,
	regex: string,
	filePattern?: string,
	tokenLimit: number = DEFAULT_TOKEN_LIMIT // Added tokenLimit parameter with default
): Promise<SearchResult> {
	const rgPath = await getBinPath(vscode.env.appRoot)

	if (!rgPath) {
		throw new Error("Could not find ripgrep binary")
	}

	const args = ["--json", "-e", regex, "--glob", filePattern || "*", "--context", "1", directoryPath]

	try {
		const { matches, totalMatches, isComplete: initialComplete, truncatedDueToTokenLimit: initialTruncatedToken } = await execRipgrep(rgPath, args, tokenLimit) // Renamed

		const results: SearchResult["matches"] = []
		let searchComplete = initialComplete
		let truncatedToken = initialTruncatedToken

		for (const [filePath, fileMatches] of matches.entries()) {
			const relativePath = path.relative(cwd, filePath)

			for (const match of fileMatches) {
				results.push({
					file: relativePath,
					line: match.line,
					column: match.column,
					content: match.content,
					beforeContext: match.beforeContext,
					afterContext: match.afterContext,
				})
			}
		}

		return {
			matches: results,
			summary: {
				totalMatches,
				matchedFiles: matches.size,
				isComplete: searchComplete,
				truncated: !searchComplete || matches.size >= MAX_FILES || truncatedToken, // Include token truncation in summary
				truncatedDueToTokenLimit: truncatedToken, // Added token truncation flag to summary, Renamed
			},
		}
	} catch (error) {
		return {
			matches: [],
			summary: {
				totalMatches: 0,
				matchedFiles: 0,
				isComplete: true,
				truncated: false,
				truncatedDueToTokenLimit: false, // Renamed
			},
		}
	}
}

export function formatSearchResults(results: SearchResult): string {
	let output = ""

	// Add summary
	output += `Found ${results.summary.totalMatches} matches across ${results.summary.matchedFiles} files`
	if (results.summary.truncated) {
		output += " (results truncated"
		if (results.summary.truncatedDueToTokenLimit) { // Renamed
			output += " due to token limit" // Indicate token limit truncation specifically
		} else if (results.summary.matchedFiles >= MAX_FILES) {
			output += " due to file limit" // Indicate file limit truncation
		} else {
			output += " due to size limits" // General size limits if not token or file limit
		}
		output += ")"
	}
	output += "\n\n"

	// Format matches
	for (const match of results.matches) {
		output += `${match.file}:${match.line} - ${match.content}\n`
		if (match.beforeContext.length > 0) {
			output += `  > ${match.beforeContext[0].trim()}\n` // Added before context
		}
		if (match.afterContext.length > 0) {
			output += `  > ${match.afterContext[0].trim()}\n`  // Added after context
		}
	}

	return output.trim()
}
