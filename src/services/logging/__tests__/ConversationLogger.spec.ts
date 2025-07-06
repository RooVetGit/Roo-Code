// npx vitest services/logging/__tests__/ConversationLogger.spec.ts

import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import { spawn } from "child_process"
import { ConversationLogger } from "../ConversationLogger"

vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(),
		workspaceFolders: [
			{
				uri: {
					fsPath: "/test/workspace",
				},
			},
		],
	},
	ProgressLocation: {
		Notification: 15,
	},
	window: {
		withProgress: vi.fn(),
	},
}))

/**
 * Waits for a given path to exist on the filesystem.
 * @param pathToExist The path to check.
 * @param timeout The maximum time to wait in milliseconds.
 * @returns A promise that resolves to true if the path exists, false otherwise.
 */
const waitForPath = async (pathToExist: string, timeout = 5000): Promise<boolean> => {
	const start = Date.now()
	while (Date.now() - start < timeout) {
		try {
			await fs.access(pathToExist)
			return true
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 100))
		}
	}
	return false
}

/**
 * Executes the create-finetuning-data.ts script in a separate process.
 * @param args - An array of command-line arguments.
 * @param cwd - The working directory for the script.
 * @returns A promise that resolves when the script finishes.
 */
function runFinetuningScript(args: string[], cwd: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const scriptPath = path.resolve(cwd, "scripts/create-finetuning-data.ts")
		const command = "npx"
		const spawnArgs = ["ts-node", scriptPath, ...args]

		const child = spawn(command, spawnArgs, {
			cwd,
			stdio: "pipe",
			shell: process.platform === "win32",
		})

		let stdout = ""
		let stderr = ""

		child.stdout.on("data", (data) => {
			stdout += data.toString()
		})

		child.stderr.on("data", (data) => {
			stderr += data.toString()
		})

		child.on("close", (code) => {
			if (code === 0) {
				resolve()
			} else {
				reject(new Error(`Script failed with code ${code}:\n${stderr}`))
			}
		})

		child.on("error", (err) => {
			reject(err)
		})
	})
}

describe("ConversationLogger", () => {
	let tempDir: string

	beforeEach(async () => {
		vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
			get: vi.fn().mockReturnValue(true),
		} as any)

		const testRunId = Math.random().toString(36).substring(7)
		tempDir = path.join(os.tmpdir(), "conversation-logger-tests", testRunId)
		await fs.mkdir(tempDir, { recursive: true })
	})

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true })
		vi.clearAllMocks()
	})

	describe("Unit Tests", () => {
		it("should create a log directory on initialization", async () => {
			const logDir = path.join(tempDir, ".roo-logs")
			new ConversationLogger(tempDir)
			await expect(waitForPath(logDir), ".roo-logs directory should be created").resolves.toBe(true)
		})

		it("should create a new session when startNewSession is called", () => {
			const logger = new ConversationLogger(tempDir)
			const firstSessionId = (logger as any).sessionId
			logger.startNewSession()
			const secondSessionId = (logger as any).sessionId
			expect(firstSessionId).not.toBe(secondSessionId)
		})

		it("should write a log entry to the correct session file", async () => {
			const logger = new ConversationLogger(tempDir)
			const logDir = path.join(tempDir, ".roo-logs")
			await waitForPath(logDir)

			const sessionId = (logger as any).sessionId
			await logger.logUserMessage("Hello, world!")

			const logFilePath = path.join(logDir, `${sessionId}.jsonl`)
			await expect(waitForPath(logFilePath), "Log file should be created after first log").resolves.toBe(true)

			const content = await fs.readFile(logFilePath, "utf-8")
			const entry = JSON.parse(content)

			expect(entry.content).toBe("Hello, world!")
			expect(entry.session_id).toBe(sessionId)
		})
	})

	describe("Integration Test: Finetuning Data Generation", () => {
		let logsDir: string
		let datasetsDir: string
		let projectRoot: string

		beforeEach(async () => {
			logsDir = path.join(tempDir, ".roo-logs")
			datasetsDir = path.join(tempDir, "finetuning-datasets")
			projectRoot = path.resolve(process.cwd(), "..")
			await fs.mkdir(logsDir, { recursive: true })
		})

		it("should generate a valid Gemini finetuning file by default", async () => {
			const logger = new ConversationLogger(tempDir)
			const sessionId = (logger as any).sessionId
			const logFilePath = path.join(logsDir, `${sessionId}.jsonl`)

			await logger.logUserMessage("What is the capital of France?")
			await expect(waitForPath(logFilePath)).resolves.toBe(true)
			await logger.logAIResponse("I will use a tool to find the capital.", "code", [
				{ name: "search", input: { query: "capital of France" } },
			])
			await logger.logToolCall("search", { query: "capital of France" }, { result: "Paris" })
			await logger.logAIResponse("The capital of France is Paris.")

			await runFinetuningScript([`--input`, logsDir, `--output`, datasetsDir], projectRoot)

			const expectedOutputFile = path.join(datasetsDir, `sft-dataset-gemini-${sessionId}.jsonl`)
			await expect(
				waitForPath(expectedOutputFile),
				`Output file ${expectedOutputFile} should exist`,
			).resolves.toBe(true)

			const outputContent = await fs.readFile(expectedOutputFile, "utf-8")
			const geminiExample = JSON.parse(outputContent)
			expect(geminiExample).toHaveProperty("messages")
			expect(geminiExample.messages[0].role).toBe("user")
		}, 60000)

		it("should generate a valid OpenAI finetuning file with --openai flag", async () => {
			const logger = new ConversationLogger(tempDir)
			const sessionId = (logger as any).sessionId
			await logger.logUserMessage("What is the weather in London?")
			await logger.logAIResponse("I will check the weather.", "code", [
				{ name: "weather", input: { city: "London" } },
			])
			await logger.logToolCall("weather", { city: "London" }, { temp: "15C", condition: "Cloudy" })
			await logger.logAIResponse("It is 15C and cloudy in London.")

			await runFinetuningScript([`--input`, logsDir, `--output`, datasetsDir, "--openai"], projectRoot)

			const expectedOutputFile = path.join(datasetsDir, `sft-dataset-openai-${sessionId}.jsonl`)
			await expect(
				waitForPath(expectedOutputFile),
				`Output file ${expectedOutputFile} should exist`,
			).resolves.toBe(true)

			const outputContent = await fs.readFile(expectedOutputFile, "utf-8")
			const openAIExample = JSON.parse(outputContent)
			expect(openAIExample).toHaveProperty("messages")
			expect(openAIExample.messages[0].role).toBe("user")
			expect(openAIExample.messages[1].role).toBe("assistant")
			expect(openAIExample.messages[1]).toHaveProperty("tool_calls")
		}, 60000)

		it("should generate a finetuning file for a specific session with --sessionId flag", async () => {
			const logger = new ConversationLogger(tempDir)

			// Session 1
			const sessionId1 = (logger as any).sessionId
			await logger.logUserMessage("First session message")
			await logger.logAIResponse("First session response")

			// Session 2
			logger.startNewSession()
			const sessionId2 = (logger as any).sessionId
			await logger.logUserMessage("Second session message")
			await logger.logAIResponse("Second session response")

			await runFinetuningScript(
				[`--input`, logsDir, `--output`, datasetsDir, "--sessionId", sessionId1],
				projectRoot,
			)

			const expectedOutputFile1 = path.join(datasetsDir, `sft-dataset-gemini-${sessionId1}.jsonl`)
			const unexpectedOutputFile2 = path.join(datasetsDir, `sft-dataset-gemini-${sessionId2}.jsonl`)

			await expect(waitForPath(expectedOutputFile1), `Output file for session 1 should exist`).resolves.toBe(true)
			await expect(
				waitForPath(unexpectedOutputFile2),
				`Output file for session 2 should NOT exist`,
			).resolves.toBe(false)
		}, 60000)

		it("should process only the most recent log file with --depth 1", async () => {
			const logger = new ConversationLogger(tempDir)

			// Session 1 (older)
			const sessionId1 = (logger as any).sessionId
			await logger.logUserMessage("Older message")
			await logger.logAIResponse("Older response")
			await new Promise((resolve) => setTimeout(resolve, 100)) // ensure different modification times

			// Session 2 (newer)
			logger.startNewSession()
			const sessionId2 = (logger as any).sessionId
			await logger.logUserMessage("Newer message")
			await logger.logAIResponse("Newer response")

			await runFinetuningScript([`--input`, logsDir, `--output`, datasetsDir, "--depth", "1"], projectRoot)

			const expectedOutputFile = path.join(datasetsDir, `sft-dataset-gemini-${sessionId2}.jsonl`)
			const unexpectedOutputFile = path.join(datasetsDir, `sft-dataset-gemini-${sessionId1}.jsonl`)

			await expect(
				waitForPath(expectedOutputFile),
				"Output file for the most recent session should exist",
			).resolves.toBe(true)
			await expect(
				waitForPath(unexpectedOutputFile),
				"Output file for the older session should NOT exist",
			).resolves.toBe(false)
		}, 60000)
	})
})
