import * as assert from "assert"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import * as vscode from "vscode"

import type { ClineMessage } from "@roo-code/types"

import { waitFor, sleep } from "../utils"

suite("Roo Code read_file Tool", () => {
	let tempDir: string
	let testFiles: {
		simple: string
		multiline: string
		empty: string
		large: string
		xmlContent: string
		nested: string
	}

	// Create a temporary directory and test files
	suiteSetup(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "roo-test-read-"))

		// Create test files in VSCode workspace directory
		const workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || tempDir

		// Create test files with different content types
		testFiles = {
			simple: path.join(workspaceDir, `simple-${Date.now()}.txt`),
			multiline: path.join(workspaceDir, `multiline-${Date.now()}.txt`),
			empty: path.join(workspaceDir, `empty-${Date.now()}.txt`),
			large: path.join(workspaceDir, `large-${Date.now()}.txt`),
			xmlContent: path.join(workspaceDir, `xml-content-${Date.now()}.xml`),
			nested: path.join(workspaceDir, "nested", "deep", `nested-${Date.now()}.txt`),
		}

		// Create files with content
		await fs.writeFile(testFiles.simple, "Hello, World!")
		await fs.writeFile(testFiles.multiline, "Line 1\nLine 2\nLine 3\nLine 4\nLine 5")
		await fs.writeFile(testFiles.empty, "")

		// Create a large file (100 lines)
		const largeContent = Array.from(
			{ length: 100 },
			(_, i) => `Line ${i + 1}: This is a test line with some content`,
		).join("\n")
		await fs.writeFile(testFiles.large, largeContent)

		// Create XML content file
		await fs.writeFile(
			testFiles.xmlContent,
			"<root>\n  <child>Test content</child>\n  <data>Some data</data>\n</root>",
		)

		// Create nested directory and file
		await fs.mkdir(path.dirname(testFiles.nested), { recursive: true })
		await fs.writeFile(testFiles.nested, "Content in nested directory")

		console.log("Test files created in:", workspaceDir)
		console.log("Test files:", testFiles)
	})

	// Clean up temporary directory and files after tests
	suiteTeardown(async () => {
		// Cancel any running tasks before cleanup
		try {
			await globalThis.api.cancelCurrentTask()
		} catch {
			// Task might not be running
		}

		// Clean up test files
		for (const filePath of Object.values(testFiles)) {
			try {
				await fs.unlink(filePath)
			} catch {
				// File might not exist
			}
		}

		// Clean up nested directory
		try {
			await fs.rmdir(path.dirname(testFiles.nested))
			await fs.rmdir(path.dirname(path.dirname(testFiles.nested)))
		} catch {
			// Directory might not exist or not be empty
		}

		await fs.rm(tempDir, { recursive: true, force: true })
	})

	// Clean up before each test
	setup(async () => {
		// Cancel any previous task
		try {
			await globalThis.api.cancelCurrentTask()
		} catch {
			// Task might not be running
		}

		// Small delay to ensure clean state
		await sleep(100)
	})

	// Clean up after each test
	teardown(async () => {
		// Cancel the current task
		try {
			await globalThis.api.cancelCurrentTask()
		} catch {
			// Task might not be running
		}

		// Small delay to ensure clean state
		await sleep(100)
	})

	test("Should read a simple text file", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let taskStarted = false
		let taskCompleted = false
		let errorOccurred: string | null = null
		let toolExecuted = false

		// Listen for messages
		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Check for tool execution
			if (message.type === "say" && message.say === "api_req_started") {
				const text = message.text || ""
				if (text.includes("read_file")) {
					toolExecuted = true
					console.log("Tool executed:", text.substring(0, 200))
				}
			}

			// Log important messages for debugging
			if (message.type === "say" && message.say === "error") {
				errorOccurred = message.text || "Unknown error"
				console.error("Error:", message.text)
			}
		}
		api.on("message", messageHandler)

		// Listen for task events
		const taskStartedHandler = (id: string) => {
			if (id === taskId) {
				taskStarted = true
				console.log("Task started:", id)
			}
		}
		api.on("taskStarted", taskStartedHandler)

		const taskCompletedHandler = (id: string) => {
			if (id === taskId) {
				taskCompleted = true
				console.log("Task completed:", id)
			}
		}
		api.on("taskCompleted", taskCompletedHandler)

		let taskId: string
		try {
			// Start task with a simple read file request
			const fileName = path.basename(testFiles.simple)
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowReadOnly: true,
					alwaysAllowReadOnlyOutsideWorkspace: true,
				},
				text: `Read the file "${fileName}" and tell me what it contains. The file exists in the workspace, so just read it.`,
			})

			console.log("Task ID:", taskId)
			console.log("Reading file:", fileName)

			// Wait for task to start
			await waitFor(() => taskStarted, { timeout: 10_000 })

			// Check for early errors
			if (errorOccurred) {
				console.error("Early error detected:", errorOccurred)
			}

			// Wait for task completion
			await waitFor(() => taskCompleted, { timeout: 30_000 })

			// Verify the read_file tool was executed
			assert.ok(toolExecuted, "The read_file tool should have been executed")

			// Check that no errors occurred
			assert.strictEqual(errorOccurred, null, "No errors should have occurred")

			// Verify the AI read the file content
			const completionMessage = messages.find(
				(m) =>
					m.type === "say" &&
					(m.say === "completion_result" || m.say === "text") &&
					m.text?.includes("Hello, World!"),
			)
			assert.ok(completionMessage, "AI should have mentioned the file content 'Hello, World!'")

			console.log("Test passed! File read successfully")
		} finally {
			// Clean up
			api.off("message", messageHandler)
			api.off("taskStarted", taskStartedHandler)
			api.off("taskCompleted", taskCompletedHandler)
		}
	})

	test("Should read a multiline file", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let taskCompleted = false
		let toolExecuted = false

		// Listen for messages
		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Check for tool execution
			if (message.type === "say" && message.say === "api_req_started") {
				const text = message.text || ""
				if (text.includes("read_file")) {
					toolExecuted = true
				}
			}
		}
		api.on("message", messageHandler)

		// Listen for task completion
		const taskCompletedHandler = (id: string) => {
			if (id === taskId) {
				taskCompleted = true
			}
		}
		api.on("taskCompleted", taskCompletedHandler)

		let taskId: string
		try {
			// Start task
			const fileName = path.basename(testFiles.multiline)
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowReadOnly: true,
					alwaysAllowReadOnlyOutsideWorkspace: true,
				},
				text: `Read the file "${fileName}" and count how many lines it has. The file exists in the workspace.`,
			})

			// Wait for task completion
			await waitFor(() => taskCompleted, { timeout: 30_000 })

			// Verify the read_file tool was executed
			assert.ok(toolExecuted, "The read_file tool should have been executed")

			// Verify the AI mentioned the correct number of lines
			const completionMessage = messages.find(
				(m) =>
					m.type === "say" &&
					(m.say === "completion_result" || m.say === "text") &&
					(m.text?.includes("5 lines") || m.text?.includes("five lines") || m.text?.includes("Line 5")),
			)
			assert.ok(completionMessage, "AI should have mentioned the file has 5 lines")

			console.log("Test passed! Multiline file read successfully")
		} finally {
			// Clean up
			api.off("message", messageHandler)
			api.off("taskCompleted", taskCompletedHandler)
		}
	})

	test("Should read file with line range", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let taskCompleted = false
		let _toolExecuted = false

		// Listen for messages
		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Check for tool execution with line range
			if (message.type === "say" && message.say === "api_req_started") {
				const text = message.text || ""
				if (text.includes("read_file") && (text.includes("line_range") || text.includes("start_line"))) {
					_toolExecuted = true
					console.log("Tool executed with line range:", text.substring(0, 300))
				}
			}
		}
		api.on("message", messageHandler)

		// Listen for task completion
		const taskCompletedHandler = (id: string) => {
			if (id === taskId) {
				taskCompleted = true
			}
		}
		api.on("taskCompleted", taskCompletedHandler)

		let taskId: string
		try {
			// Start task
			const fileName = path.basename(testFiles.multiline)
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowReadOnly: true,
					alwaysAllowReadOnlyOutsideWorkspace: true,
				},
				text: `Read lines 2 to 4 from the file "${fileName}". The file exists in the workspace.`,
			})

			// Wait for task completion
			await waitFor(() => taskCompleted, { timeout: 30_000 })

			// Verify the AI mentioned the specific lines
			const completionMessage = messages.find(
				(m) =>
					m.type === "say" &&
					(m.say === "completion_result" || m.say === "text") &&
					m.text?.includes("Line 2") &&
					m.text?.includes("Line 3") &&
					m.text?.includes("Line 4"),
			)
			assert.ok(completionMessage, "AI should have mentioned lines 2, 3, and 4")

			console.log("Test passed! File read with line range successfully")
		} finally {
			// Clean up
			api.off("message", messageHandler)
			api.off("taskCompleted", taskCompletedHandler)
		}
	})

	test("Should handle reading non-existent file", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let taskCompleted = false
		let toolExecuted = false
		let _errorHandled = false

		// Listen for messages
		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Check for tool execution
			if (message.type === "say" && message.say === "api_req_started") {
				const text = message.text || ""
				if (text.includes("read_file")) {
					toolExecuted = true
					// Check if error was returned
					if (text.includes("error") || text.includes("not found")) {
						_errorHandled = true
					}
				}
			}
		}
		api.on("message", messageHandler)

		// Listen for task completion
		const taskCompletedHandler = (id: string) => {
			if (id === taskId) {
				taskCompleted = true
			}
		}
		api.on("taskCompleted", taskCompletedHandler)

		let taskId: string
		try {
			// Start task with non-existent file
			const nonExistentFile = `non-existent-${Date.now()}.txt`
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowReadOnly: true,
					alwaysAllowReadOnlyOutsideWorkspace: true,
				},
				text: `Try to read the file "${nonExistentFile}" and tell me what happens.`,
			})

			// Wait for task completion
			await waitFor(() => taskCompleted, { timeout: 30_000 })

			// Verify the read_file tool was executed
			assert.ok(toolExecuted, "The read_file tool should have been executed")

			// Verify the AI handled the error appropriately
			const completionMessage = messages.find(
				(m) =>
					m.type === "say" &&
					(m.say === "completion_result" || m.say === "text") &&
					(m.text?.toLowerCase().includes("not found") ||
						m.text?.toLowerCase().includes("doesn't exist") ||
						m.text?.toLowerCase().includes("does not exist")),
			)
			assert.ok(completionMessage, "AI should have mentioned the file was not found")

			console.log("Test passed! Non-existent file handled correctly")
		} finally {
			// Clean up
			api.off("message", messageHandler)
			api.off("taskCompleted", taskCompletedHandler)
		}
	})

	test("Should read XML content file", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let taskCompleted = false
		let toolExecuted = false

		// Listen for messages
		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Check for tool execution
			if (message.type === "say" && message.say === "api_req_started") {
				const text = message.text || ""
				if (text.includes("read_file")) {
					toolExecuted = true
				}
			}
		}
		api.on("message", messageHandler)

		// Listen for task completion
		const taskCompletedHandler = (id: string) => {
			if (id === taskId) {
				taskCompleted = true
			}
		}
		api.on("taskCompleted", taskCompletedHandler)

		let taskId: string
		try {
			// Start task
			const fileName = path.basename(testFiles.xmlContent)
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowReadOnly: true,
					alwaysAllowReadOnlyOutsideWorkspace: true,
				},
				text: `Read the XML file "${fileName}" and tell me what elements it contains. The file exists in the workspace.`,
			})

			// Wait for task completion
			await waitFor(() => taskCompleted, { timeout: 30_000 })

			// Verify the read_file tool was executed
			assert.ok(toolExecuted, "The read_file tool should have been executed")

			// Verify the AI mentioned the XML content
			const completionMessage = messages.find(
				(m) =>
					m.type === "say" &&
					(m.say === "completion_result" || m.say === "text") &&
					m.text?.includes("root") &&
					m.text?.includes("child") &&
					m.text?.includes("data"),
			)
			assert.ok(completionMessage, "AI should have mentioned the XML elements")

			console.log("Test passed! XML file read successfully")
		} finally {
			// Clean up
			api.off("message", messageHandler)
			api.off("taskCompleted", taskCompletedHandler)
		}
	})

	test("Should read multiple files in sequence", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let taskCompleted = false
		let readFileCount = 0

		// Listen for messages
		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Count read_file executions
			if (message.type === "say" && message.say === "api_req_started") {
				const text = message.text || ""
				if (text.includes("read_file")) {
					readFileCount++
					console.log(`Read file execution #${readFileCount}`)
				}
			}
		}
		api.on("message", messageHandler)

		// Listen for task completion
		const taskCompletedHandler = (id: string) => {
			if (id === taskId) {
				taskCompleted = true
			}
		}
		api.on("taskCompleted", taskCompletedHandler)

		let taskId: string
		try {
			// Start task to read multiple files
			const simpleFileName = path.basename(testFiles.simple)
			const multilineFileName = path.basename(testFiles.multiline)
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowReadOnly: true,
					alwaysAllowReadOnlyOutsideWorkspace: true,
				},
				text: `Read these two files and tell me what each contains:
1. "${simpleFileName}"
2. "${multilineFileName}"
Both files exist in the workspace.`,
			})

			// Wait for task completion
			await waitFor(() => taskCompleted, { timeout: 45_000 })

			// Verify multiple read_file executions
			assert.ok(
				readFileCount >= 2,
				`Should have executed read_file at least twice, but executed ${readFileCount} times`,
			)

			// Verify the AI mentioned both file contents
			const completionMessage = messages.find(
				(m) =>
					m.type === "say" &&
					(m.say === "completion_result" || m.say === "text") &&
					m.text?.includes("Hello, World!") &&
					(m.text?.includes("Line 1") || m.text?.includes("5 lines")),
			)
			assert.ok(completionMessage, "AI should have mentioned contents of both files")

			console.log("Test passed! Multiple files read successfully")
		} finally {
			// Clean up
			api.off("message", messageHandler)
			api.off("taskCompleted", taskCompletedHandler)
		}
	})

	test("Should read large file efficiently", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let taskCompleted = false
		let toolExecuted = false

		// Listen for messages
		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Check for tool execution
			if (message.type === "say" && message.say === "api_req_started") {
				const text = message.text || ""
				if (text.includes("read_file")) {
					toolExecuted = true
					console.log("Reading large file...")
				}
			}
		}
		api.on("message", messageHandler)

		// Listen for task completion
		const taskCompletedHandler = (id: string) => {
			if (id === taskId) {
				taskCompleted = true
			}
		}
		api.on("taskCompleted", taskCompletedHandler)

		let taskId: string
		try {
			// Start task
			const fileName = path.basename(testFiles.large)
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowReadOnly: true,
					alwaysAllowReadOnlyOutsideWorkspace: true,
				},
				text: `Read the first 10 lines of the file "${fileName}" and tell me what pattern you see. The file exists in the workspace.`,
			})

			// Wait for task completion
			await waitFor(() => taskCompleted, { timeout: 30_000 })

			// Verify the read_file tool was executed
			assert.ok(toolExecuted, "The read_file tool should have been executed")

			// Verify the AI mentioned the line pattern
			const completionMessage = messages.find(
				(m) =>
					m.type === "say" &&
					(m.say === "completion_result" || m.say === "text") &&
					(m.text?.includes("Line 1") || m.text?.includes("pattern") || m.text?.includes("numbered")),
			)
			assert.ok(completionMessage, "AI should have identified the line pattern")

			console.log("Test passed! Large file read efficiently")
		} finally {
			// Clean up
			api.off("message", messageHandler)
			api.off("taskCompleted", taskCompletedHandler)
		}
	})
})
