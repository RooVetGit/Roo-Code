// npx vitest services/logging/__tests__/ConversationLogger.spec.ts

import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import { exec } from "child_process"
import { promisify } from "util"
import { ConversationLogger } from "../ConversationLogger"

const execAsync = promisify(exec)

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

		it("should generate a valid finetuning file from a single conversation session", async () => {
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

			const scriptPath = path.join(projectRoot, "scripts/create-finetuning-data.ts")
			const command = `npx ts-node ${scriptPath} --input ${logsDir} --output ${datasetsDir}`
			await execAsync(command, { cwd: projectRoot })

			const expectedOutputFile = path.join(datasetsDir, `finetuning-dataset-${sessionId}.jsonl`)
			await expect(
				waitForPath(expectedOutputFile),
				`Output file ${expectedOutputFile} should exist`,
			).resolves.toBe(true)

			const outputContent = await fs.readFile(expectedOutputFile, "utf-8")
			const geminiExample = JSON.parse(outputContent)
			expect(geminiExample).toHaveProperty("messages")
		}, 30000)

		it("should generate separate finetuning files for multiple conversation sessions", async () => {
			const logger = new ConversationLogger(tempDir)

			// Session 1
			const sessionId1 = (logger as any).sessionId
			await logger.logUserMessage("First session message")
			await logger.logAIResponse("First session tool call", "code", [{ name: "tool1", input: {} }])
			await logger.logToolCall("tool1", {}, { success: true })
			await logger.logAIResponse("First session response")
			const logFilePath1 = path.join(logsDir, `${sessionId1}.jsonl`)
			await expect(waitForPath(logFilePath1)).resolves.toBe(true)

			// Session 2
			logger.startNewSession()
			const sessionId2 = (logger as any).sessionId
			await logger.logUserMessage("Second session message")
			await logger.logAIResponse("Second session tool call", "code", [{ name: "tool2", input: {} }])
			await logger.logToolCall("tool2", {}, { success: true })
			await logger.logAIResponse("Second session response")
			const logFilePath2 = path.join(logsDir, `${sessionId2}.jsonl`)
			await expect(waitForPath(logFilePath2)).resolves.toBe(true)

			// Execution
			const scriptPath = path.join(projectRoot, "scripts/create-finetuning-data.ts")
			const command = `npx ts-node ${scriptPath} --input ${logsDir} --output ${datasetsDir}`
			await execAsync(command, { cwd: projectRoot })

			// Validation
			const expectedOutputFile1 = path.join(datasetsDir, `finetuning-dataset-${sessionId1}.jsonl`)
			const expectedOutputFile2 = path.join(datasetsDir, `finetuning-dataset-${sessionId2}.jsonl`)

			await expect(waitForPath(expectedOutputFile1), `Output file for session 1 should exist`).resolves.toBe(true)
			await expect(waitForPath(expectedOutputFile2), `Output file for session 2 should exist`).resolves.toBe(true)
		}, 30000)
	})
})
