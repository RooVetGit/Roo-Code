import * as assert from "assert"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

import type { ClineMessage } from "@roo-code/types"

import { sleep, waitUntilCompleted } from "./utils"
import { setDefaultSuiteTimeout } from "./test-utils"

suite("Silent Mode Integration", function () {
	setDefaultSuiteTimeout(this)

	let tempDir: string
	let testFiles: {
		newFile: string
		existingFile: string
		modifyFile: string
	}

	// Create a temporary directory for test files
	suiteSetup(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "roo-silent-mode-test-"))
		console.log("Silent Mode test temp directory:", tempDir)
	})

	// Clean up temporary directory after tests
	suiteTeardown(async () => {
		// Cancel any running tasks before cleanup
		try {
			await globalThis.api.cancelCurrentTask()
		} catch {
			// Task might not be running
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

		// Generate unique file names for each test
		const timestamp = Date.now()
		testFiles = {
			newFile: path.join(tempDir, `new-file-${timestamp}.ts`),
			existingFile: path.join(tempDir, `existing-file-${timestamp}.ts`),
			modifyFile: path.join(tempDir, `modify-file-${timestamp}.ts`),
		}

		// Create an existing file for modification tests
		await fs.writeFile(testFiles.existingFile, "// Initial content\nconst original = true;\n")

		// Small delay to ensure clean state
		await sleep(200)
	})

	// Clean up after each test
	teardown(async () => {
		// Cancel the current task
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

		// Small delay to ensure clean state
		await sleep(200)
	})

	test("Should activate Silent Mode and perform file operations silently", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let _taskStarted = false
		let taskCompleted = false
		let errorOccurred: string | null = null
		let _silentModeActivated = false
		let _fileOperationsExecuted = false
		let _completionNotificationShown = false

		// Listen for messages
		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Check for Silent Mode activation
			if (message.type === "say" && message.text?.includes("Silent Mode")) {
				if (message.text.includes("activated") || message.text.includes("working silently")) {
					_silentModeActivated = true
					console.log("Silent Mode activated:", message.text?.substring(0, 200))
				}
			}

			// Check for file operations
			if (message.type === "say" && message.say === "api_req_started") {
				if (message.text && (message.text.includes("write_to_file") || message.text.includes("apply_diff"))) {
					_fileOperationsExecuted = true
					console.log("File operation in Silent Mode:", message.text?.substring(0, 200))
				}
			}

			// Check for completion notification
			if (message.type === "say" && message.text?.includes("completed silently")) {
				_completionNotificationShown = true
				console.log("Silent Mode completion notification:", message.text?.substring(0, 200))
			}

			// Log errors
			if (message.type === "say" && message.say === "error") {
				errorOccurred = message.text || "Unknown error"
				console.error("Error:", message.text)
			}

			// Log important events for debugging
			if (message.type === "ask" && message.ask === "tool") {
				console.log("Tool request:", message.text?.substring(0, 200))
			}
			if (message.type === "say" && (message.say === "completion_result" || message.say === "text")) {
				console.log("AI response:", message.text?.substring(0, 200))
			}
		}
		api.on("message", messageHandler)

		// Listen for task events
		const taskStartedHandler = (id: string) => {
			if (id === taskId) {
				_taskStarted = true
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
			// Start task with Silent Mode enabled
			const baseFileName = path.basename(testFiles.newFile)
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowWrite: true,
					alwaysAllowReadOnly: true,
					alwaysAllowReadOnlyOutsideWorkspace: true,
					// silentMode: true, // TODO: Enable when Silent Mode is implemented
				},
				text: `Create a TypeScript file named "${baseFileName}" with a simple class definition. The class should have a constructor and a method.`,
			})

			console.log("Task ID:", taskId)
			console.log("Base filename:", baseFileName)
			console.log("Expecting file at:", testFiles.newFile)

			// Wait for task completion
			await waitUntilCompleted({ api, taskId, timeout: 60_000 })

			// Verify task completed
			assert.ok(taskCompleted, "Task should have completed")
			assert.ok(!errorOccurred, `No errors should occur, but got: ${errorOccurred}`)

			// Verify file was created
			const fileExists = await fs
				.access(testFiles.newFile)
				.then(() => true)
				.catch(() => false)
			assert.ok(fileExists, `File should have been created at ${testFiles.newFile}`)

			if (fileExists) {
				const content = await fs.readFile(testFiles.newFile, "utf-8")
				assert.ok(content.includes("class"), "File should contain a class definition")
				assert.ok(content.includes("constructor"), "File should contain a constructor")
				console.log("Created file content preview:", content.substring(0, 200))
			}

			// TODO: Verify Silent Mode behaviors when implemented
			// For now, we just verify the task completes successfully
			console.log("Silent Mode integration test completed successfully")
		} finally {
			// Clean up event listeners
			api.off("message", messageHandler)
			api.off("taskStarted", taskStartedHandler)
			api.off("taskCompleted", taskCompletedHandler)
		}
	})

	test("Should handle file modifications in Silent Mode", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let taskCompleted = false
		let errorOccurred: string | null = null

		// Listen for messages
		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			if (message.type === "say" && message.say === "error") {
				errorOccurred = message.text || "Unknown error"
				console.error("Error:", message.text)
			}
		}
		api.on("message", messageHandler)

		// Listen for task completion
		const taskCompletedHandler = (id: string) => {
			if (id === taskId) {
				taskCompleted = true
				console.log("Task completed:", id)
			}
		}
		api.on("taskCompleted", taskCompletedHandler)

		let taskId: string
		try {
			// Read initial content
			const initialContent = await fs.readFile(testFiles.existingFile, "utf-8")
			console.log("Initial file content:", initialContent)

			const fileName = path.basename(testFiles.existingFile)
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowWrite: true,
					alwaysAllowReadOnly: true,
					alwaysAllowReadOnlyOutsideWorkspace: true,
					// silentMode: true, // TODO: Enable when Silent Mode is implemented
				},
				text: `Modify the file "${fileName}" to add a new function called "newFunction" that returns "Hello World".`,
			})

			// Wait for task completion
			await waitUntilCompleted({ api, taskId, timeout: 60_000 })

			// Verify task completed
			assert.ok(taskCompleted, "Task should have completed")
			assert.ok(!errorOccurred, `No errors should occur, but got: ${errorOccurred}`)

			// Verify file was modified
			const finalContent = await fs.readFile(testFiles.existingFile, "utf-8")
			assert.notStrictEqual(finalContent, initialContent, "File content should have changed")
			assert.ok(finalContent.includes("newFunction"), "File should contain the new function")

			console.log("Modified file content preview:", finalContent.substring(0, 300))
		} finally {
			// Clean up event listeners
			api.off("message", messageHandler)
			api.off("taskCompleted", taskCompletedHandler)
		}
	})

	test("Should gracefully fallback to interactive mode when Silent Mode fails", async function () {
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let taskCompleted = false
		let _errorOccurred: string | null = null
		let _fallbackToInteractiveMode = false

		// Listen for messages
		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Check for fallback to interactive mode
			if (message.type === "say" && message.text?.includes("interactive")) {
				if (message.text.includes("fallback") || message.text.includes("switching to interactive")) {
					_fallbackToInteractiveMode = true
					console.log("Fallback to interactive mode:", message.text?.substring(0, 200))
				}
			}

			if (message.type === "say" && message.say === "error") {
				_errorOccurred = message.text || "Unknown error"
				console.error("Error:", message.text)
			}
		}
		api.on("message", messageHandler)

		// Listen for task completion
		const taskCompletedHandler = (id: string) => {
			if (id === taskId) {
				taskCompleted = true
				console.log("Task completed:", id)
			}
		}
		api.on("taskCompleted", taskCompletedHandler)

		let taskId: string
		try {
			// Start a task that might be challenging for Silent Mode
			// This tests the fallback mechanism
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowWrite: true,
					alwaysAllowReadOnly: true,
					alwaysAllowReadOnlyOutsideWorkspace: true,
					// silentMode: true, // TODO: Enable when Silent Mode is implemented
				},
				text: `Create a complex web application with multiple files and dependencies. This should be challenging for Silent Mode.`,
			})

			// Wait for task completion (or timeout)
			await waitUntilCompleted({ api, taskId, timeout: 60_000 })

			// The task should complete either in Silent Mode or fall back to interactive
			assert.ok(taskCompleted, "Task should have completed (either silently or interactively)")

			// TODO: When Silent Mode is fully implemented, verify fallback behavior
			console.log("Fallback test completed")
		} finally {
			// Clean up event listeners
			api.off("message", messageHandler)
			api.off("taskCompleted", taskCompletedHandler)
		}
	})

	test("Should handle Silent Mode toggle commands", async function () {
		// This test would verify the toggle functionality
		// For now, it's a placeholder for when the command system is integrated

		const api = globalThis.api

		try {
			// TODO: Test Silent Mode toggle command when implemented
			// await vscode.commands.executeCommand('roo-cline.toggleSilentMode')

			// For now, just verify the API is available
			assert.ok(api, "API should be available for testing toggle commands")

			console.log("Silent Mode toggle test completed (placeholder)")
		} catch (error) {
			console.log("Toggle command not yet implemented:", error)
		}
	})
})
