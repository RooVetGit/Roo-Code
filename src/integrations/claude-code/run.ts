import * as vscode from "vscode"
import type Anthropic from "@anthropic-ai/sdk"
import { execa } from "execa"
import { ClaudeCodeMessage } from "./types"
import readline from "readline"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

const cwd = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0)

type ClaudeCodeOptions = {
	systemPrompt: string
	messages: Anthropic.Messages.MessageParam[]
	path?: string
	modelId?: string
}

type ProcessState = {
	partialData: string | null
	error: Error | null
	stderrLogs: string
	exitCode: number | null
}

export async function* runClaudeCode(options: ClaudeCodeOptions): AsyncGenerator<ClaudeCodeMessage | string> {
	// Validate inputs
	if (!options.systemPrompt || typeof options.systemPrompt !== "string") {
		throw new Error("systemPrompt is required and must be a string")
	}
	if (!options.messages || !Array.isArray(options.messages) || options.messages.length === 0) {
		throw new Error("messages is required and must be a non-empty array")
	}

	const process = runProcess(options)

	const rl = readline.createInterface({
		input: process.stdout,
	})

	try {
		const processState: ProcessState = {
			error: null,
			stderrLogs: "",
			exitCode: null,
			partialData: null,
		}

		process.stderr.on("data", (data) => {
			processState.stderrLogs += data.toString()
		})

		process.on("close", (code) => {
			processState.exitCode = code
		})

		process.on("error", (err) => {
			processState.error = err
		})

		for await (const line of rl) {
			if (processState.error) {
				throw processState.error
			}

			if (line.trim()) {
				const chunk = parseChunk(line, processState)

				if (!chunk) {
					continue
				}

				yield chunk
			}
		}

		// We rely on the assistant message. If the output was truncated, it's better having a poorly formatted message
		// from which to extract something, than throwing an error/showing the model didn't return any messages.
		if (processState.partialData && processState.partialData.startsWith(`{"type":"assistant"`)) {
			yield processState.partialData
		}

		const { exitCode } = await process
		if (exitCode !== null && exitCode !== 0) {
			const errorOutput = processState.error?.message || processState.stderrLogs?.trim()
			throw new Error(
				`Claude Code process exited with code ${exitCode}.${errorOutput ? ` Error output: ${errorOutput}` : ""}`,
			)
		}
	} finally {
		rl.close()
		if (!process.killed) {
			process.kill()
		}
	}
}

// We want the model to use our custom tool format instead of built-in tools.
// Disabling built-in tools prevents tool-only responses and ensures text output.
const claudeCodeTools = [
	"Task",
	"Bash",
	"Glob",
	"Grep",
	"LS",
	"exit_plan_mode",
	"Read",
	"Edit",
	"MultiEdit",
	"Write",
	"NotebookRead",
	"NotebookEdit",
	"WebFetch",
	"TodoRead",
	"TodoWrite",
	"WebSearch",
].join(",")

const CLAUDE_CODE_TIMEOUT = 600000 // 10 minutes

function runProcess({ systemPrompt, messages, path, modelId }: ClaudeCodeOptions) {
	const claudePath = path || "claude"
	const isWindows = process.platform === "win32"
	const cwd = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0)

	// Dispatch to the appropriate platform-specific method
	if (isWindows) {
		return runClaudeCodeOnWindows({
			systemPrompt,
			messages,
			claudePath,
			modelId,
			cwd,
		})
	} else {
		return runClaudeCodeOnNonWindows({
			systemPrompt,
			messages,
			claudePath,
			modelId,
			cwd,
		})
	}
}

/**
 * Runs Claude CLI on Windows using WSL
 * @param params Parameters for running Claude CLI
 * @returns Execa process
 */
function runClaudeCodeOnWindows({
	systemPrompt,
	messages,
	claudePath,
	modelId,
	cwd,
}: {
	systemPrompt: string
	messages: Anthropic.Messages.MessageParam[]
	claudePath: string
	modelId?: string
	cwd?: string
}) {
	/**
	 * Creates temporary files for Claude CLI input and returns their paths
	 * @param cwd The current working directory
	 * @param messages The messages to write to a file
	 * @param systemPrompt The system prompt to write to a file
	 * @returns Object containing paths to the temporary files and a cleanup function
	 */
	const createTemporaryFiles = (
		cwd: string | undefined,
		messages: Anthropic.Messages.MessageParam[],
		systemPrompt: string,
	) => {
		// Always use system temp directory to avoid workspace pollution
		const tempDirPath = path.join(os.tmpdir(), ".claude-code-temp")

		// Create the directory if it doesn't exist
		if (!fs.existsSync(tempDirPath)) {
			fs.mkdirSync(tempDirPath, { recursive: true })
		}

		// Create unique filenames with process PID to avoid collisions
		const timestamp = Date.now()
		const pid = process.pid
		const messagesFilePath = path.join(tempDirPath, `messages-${timestamp}-${pid}.json`)
		const systemPromptFilePath = path.join(tempDirPath, `system-prompt-${timestamp}-${pid}.txt`)

		// Write the files
		fs.writeFileSync(messagesFilePath, JSON.stringify(messages), "utf8")
		fs.writeFileSync(systemPromptFilePath, systemPrompt, "utf8")

		// Return paths and cleanup function
		return {
			messagesFilePath,
			systemPromptFilePath,
			cleanup: () => {
				try {
					fs.unlinkSync(messagesFilePath)
					fs.unlinkSync(systemPromptFilePath)

					// Try to remove the directory if it's empty (use newer rmSync)
					try {
						const files = fs.readdirSync(tempDirPath)
						if (files.length === 0) {
							fs.rmSync(tempDirPath, { recursive: true })
						}
					} catch (dirError) {
						// Directory might not be empty or already removed, which is fine
					}
				} catch (error) {
					console.error("Error cleaning up temporary Claude CLI files:", error)
					// Don't re-throw to avoid breaking the main process
				}
			},
		}
	}

	/**
	 * Converts a Windows path to a WSL-compatible path
	 * @param windowsPath The Windows path to convert
	 * @returns The WSL-compatible path
	 */
	const convertWindowsPathToWsl = (windowsPath: string): string => {
		// Validate that this is a Windows absolute path with drive letter
		if (!windowsPath || windowsPath.length < 3 || windowsPath.charAt(1) !== ":") {
			throw new Error(`Invalid Windows path format: ${windowsPath}`)
		}

		// Remove drive letter and convert backslashes to forward slashes
		const driveLetter = windowsPath.charAt(0).toLowerCase()
		const pathWithoutDrive = windowsPath.substring(2).replace(/\\/g, "/")
		return `/mnt/${driveLetter}${pathWithoutDrive}`
	}

	// Create temporary files for messages and system prompt
	const tempFiles = createTemporaryFiles(cwd, messages, systemPrompt)

	// Convert Windows paths to WSL paths
	const wslMessagesPath = convertWindowsPathToWsl(tempFiles.messagesFilePath)
	const wslSystemPromptPath = convertWindowsPathToWsl(tempFiles.systemPromptFilePath)

	// Modify args to use file paths instead of raw JSON
	const fileArgs = [
		"-p",
		`@${wslMessagesPath}`,
		"--system-prompt",
		`@${wslSystemPromptPath}`,
		"--verbose",
		"--output-format",
		"stream-json",
		"--disallowedTools",
		claudeCodeTools,
		"--max-turns",
		"1",
	]

	if (modelId) {
		fileArgs.push("--model", modelId)
	}

	try {
		// Create the process
		const childProcess = execa("wsl", [claudePath, ...fileArgs], {
			stdin: "ignore",
			stdout: "pipe",
			stderr: "pipe",
			env: {
				...process.env,
				// The default is 32000. However, I've gotten larger responses, so we increase it unless the user specified it.
				CLAUDE_CODE_MAX_OUTPUT_TOKENS: process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS || "64000",
			},
			cwd,
			maxBuffer: 1024 * 1024 * 1000,
			timeout: CLAUDE_CODE_TIMEOUT,
		})

		// Clean up temporary files when the process exits
		childProcess.finally(() => {
			tempFiles.cleanup()
		})

		// Register cleanup handlers for process termination signals
		const cleanupOnTermination = () => {
			tempFiles.cleanup()
			// Only attempt to kill the process if it's still running
			if (childProcess && !childProcess.killed) {
				childProcess.kill()
			}
		}

		// Handle forceful termination by user
		process.on("SIGINT", cleanupOnTermination)
		process.on("SIGTERM", cleanupOnTermination)
		process.on("exit", cleanupOnTermination)

		// Remove the signal listeners when the child process completes
		childProcess.finally(() => {
			process.off("SIGINT", cleanupOnTermination)
			process.off("SIGTERM", cleanupOnTermination)
			process.off("exit", cleanupOnTermination)
		})

		return childProcess
	} catch (error) {
		// Clean up temp files if WSL execution fails
		tempFiles.cleanup()
		throw new Error(
			`Failed to execute Claude CLI via WSL: ${error instanceof Error ? error.message : String(error)}. Make sure WSL is installed and configured properly.`,
		)
	}
}

/**
 * Runs Claude CLI on non-Windows platforms
 * @param params Parameters for running Claude CLI
 * @returns Execa process
 */
function runClaudeCodeOnNonWindows({
	systemPrompt,
	messages,
	claudePath,
	modelId,
	cwd,
}: {
	systemPrompt: string
	messages: Anthropic.Messages.MessageParam[]
	claudePath: string
	modelId?: string
	cwd?: string
}) {
	// Create args for Claude CLI
	const args = [
		"-p",
		"--system-prompt",
		systemPrompt,
		"--verbose",
		"--output-format",
		"stream-json",
		"--disallowedTools",
		claudeCodeTools,
		// Roo Code will handle recursive calls
		"--max-turns",
		"1",
	]

	if (modelId) {
		args.push("--model", modelId)
	}

	const child = execa(claudePath, args, {
		stdin: "pipe",
		stdout: "pipe",
		stderr: "pipe",
		env: {
			...process.env,
			// The default is 32000. However, I've gotten larger responses, so we increase it unless the user specified it.
			CLAUDE_CODE_MAX_OUTPUT_TOKENS: process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS || "64000",
		},
		cwd,
		maxBuffer: 1024 * 1024 * 1000,
		timeout: CLAUDE_CODE_TIMEOUT,
	})

	// Write messages to stdin after process is spawned
	// This avoids the E2BIG error on Linux when passing large messages as command line arguments
	// Linux has a per-argument limit of ~128KiB for execve() system calls
	const messagesJson = JSON.stringify(messages)

	// Use setImmediate to ensure the process has been spawned before writing to stdin
	// This prevents potential race conditions where stdin might not be ready
	setImmediate(() => {
		try {
			child.stdin.write(messagesJson, "utf8", (error) => {
				if (error) {
					console.error("Error writing to Claude Code stdin:", error)
					child.kill()
				}
			})
			child.stdin.end()
		} catch (error) {
			console.error("Error accessing Claude Code stdin:", error)
			child.kill()
		}
	})

	return child
}

function parseChunk(data: string, processState: ProcessState) {
	if (processState.partialData) {
		processState.partialData += data

		const chunk = attemptParseChunk(processState.partialData)

		if (!chunk) {
			return null
		}

		processState.partialData = null
		return chunk
	}

	const chunk = attemptParseChunk(data)

	if (!chunk) {
		processState.partialData = data
	}

	return chunk
}

function attemptParseChunk(data: string): ClaudeCodeMessage | null {
	try {
		return JSON.parse(data)
	} catch (error) {
		console.error("Error parsing chunk:", error, data.length)
		return null
	}
}
