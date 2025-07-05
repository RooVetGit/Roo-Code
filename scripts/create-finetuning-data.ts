import * as fs from "fs/promises"
import * as path from "path"
import { EOL } from "os"

// Interfaces based on ConversationLogger.ts and Gemini's format
interface LogEntry {
	timestamp: string
	session_id: string
	type: "user_message" | "ai_response" | "tool_call"
	mode: string
	content?: string
	tool_calls?: { name: string; input: any }[]
	tool_name?: string
	parameters?: any
	result?: any
}

interface GeminiMessage {
	role: "user" | "model" | "tool"
	parts: ({ text: string } | { tool_code: any } | { tool_result: any })[]
}

interface GeminiExample {
	messages: GeminiMessage[]
}

/**
 * Parses command-line arguments.
 * @param args - Command-line arguments array.
 * @returns Parsed arguments with input and output paths.
 */
function parseArguments(args: string[]): { input: string; output: string } {
	const inputFlag = "--input"
	const outputFlag = "--output"
	let input = ".roo-logs" // default input directory
	let output = "finetuning-dataset.jsonl" // default output file

	for (let i = 0; i < args.length; i++) {
		const arg = args[i]
		if (arg === inputFlag) {
			const value = args[i + 1]
			if (value) {
				input = value
			}
		} else if (arg === outputFlag) {
			const value = args[i + 1]
			if (value) {
				output = value
			}
		}
	}

	return { input, output }
}

/**
 * Finds all .jsonl files in a directory.
 * @param dir - The directory to search.
 * @returns A promise that resolves to an array of file paths.
 */
async function findLogFiles(dir: string): Promise<string[]> {
	try {
		const dirents = await fs.readdir(dir, { withFileTypes: true })
		const files = await Promise.all(
			dirents.map(async (dirent) => {
				const res = path.resolve(dir, dirent.name)
				if (dirent.isDirectory()) {
					return findLogFiles(res)
				}
				return res.endsWith(".jsonl") ? res : []
			}),
		)
		return Array.prototype.concat(...files)
	} catch (error) {
		console.error(`Error reading directory ${dir}:`, error)
		return []
	}
}

/**
 * Processes a single session log file and converts it to fine-tuning format.
 * @param filePath - The path to the log file.
 * @returns A promise that resolves to an array of GeminiExample objects.
 */
async function processLogFile(filePath: string): Promise<GeminiExample[]> {
	const fileContent = await fs.readFile(filePath, "utf-8")
	const lines = fileContent.split(/\r?\n/).filter((line) => line)
	const logEntries: LogEntry[] = lines
		.map((line) => {
			try {
				return JSON.parse(line)
			} catch (error) {
				console.warn(`Skipping malformed log entry: ${line}`)
				return null
			}
		})
		.filter((entry): entry is LogEntry => entry !== null)

	const examples: GeminiExample[] = []
	let i = 0

	while (i < logEntries.length) {
		const currentEntry = logEntries[i]
		if (currentEntry && currentEntry.type === "user_message") {
			let turn: LogEntry[] = [currentEntry]
			i++

			while (i < logEntries.length) {
				const nextEntry = logEntries[i]
				if (nextEntry && nextEntry.type !== "user_message") {
					turn.push(nextEntry)
					i++
				} else {
					break
				}
			}

			const messages: GeminiMessage[] = []
			let hasToolCall = false

			const firstMessage = turn[0]
			if (firstMessage) {
				messages.push({ role: "user", parts: [{ text: firstMessage.content ?? "" }] })
			}

			let modelResponseParts: ({ text: string } | { tool_code: any })[] = []

			for (let j = 1; j < turn.length; j++) {
				const entry = turn[j]
				if (!entry) continue

				if (entry.type === "ai_response") {
					if (entry.content) {
						modelResponseParts.push({ text: entry.content })
					}
					if (entry.tool_calls && entry.tool_calls.length > 0) {
						modelResponseParts.push(
							...entry.tool_calls.map((tc) => ({ tool_code: { name: tc.name, args: tc.input } })),
						)
						hasToolCall = true
					}
				} else if (entry.type === "tool_call") {
					if (modelResponseParts.length > 0) {
						messages.push({ role: "model", parts: modelResponseParts })
						modelResponseParts = []
					}

					let toolOutput = entry.result
					try {
						toolOutput = JSON.parse(entry.result)
					} catch (e) {
						/* Do nothing, use as raw string */
					}

					messages.push({
						role: "tool",
						parts: [{ tool_result: { name: entry.tool_name!, response: toolOutput } }],
					})
				}
			}

			if (modelResponseParts.length > 0) {
				messages.push({ role: "model", parts: modelResponseParts })
			}

			if (hasToolCall) {
				examples.push({ messages })
			}
			if (hasToolCall) {
				examples.push({ messages })
			}
		} else {
			i++
		}
	}
	return examples
}

/**
 * Main function to run the script.
 */
async function main() {
	const { input, output } = parseArguments(process.argv.slice(2))
	const workspaceRoot = process.cwd()
	const inputDir = path.resolve(workspaceRoot, input)
	const outputFile = path.resolve(workspaceRoot, output)

	console.log(`Starting conversion...`)
	console.log(`Input directory: ${inputDir}`)
	console.log(`Output file: ${outputFile}`)

	const logFiles = await findLogFiles(inputDir)

	if (logFiles.length === 0) {
		console.log("No .jsonl log files found. Exiting.")
		return
	}

	let allExamples: GeminiExample[] = []

	for (const file of logFiles) {
		const examples = await processLogFile(file)
		allExamples = allExamples.concat(examples)
	}

	if (allExamples.length > 0) {
		const outputContent = allExamples.map((ex) => JSON.stringify(ex)).join(EOL)
		await fs.writeFile(outputFile, outputContent, "utf-8")
		console.log(`Successfully created fine-tuning dataset with ${allExamples.length} examples at ${outputFile}`)
	} else {
		console.log("No valid training examples could be generated from the logs.")
	}
}

main().catch((error) => {
	console.error("An unexpected error occurred:", error)
	process.exit(1)
})
