import * as assert from "assert"
import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"

import type { ClineMessage } from "@roo-code/types"

import { waitUntilCompleted } from "./utils"
import { setDefaultSuiteTimeout } from "./test-utils"

suite("Diagnostic Settings", function () {
	setDefaultSuiteTimeout(this)

	let tempDir: string
	let tempFile: string

	suiteSetup(async () => {
		// Create a temporary directory for test files
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
		if (!workspaceFolder) {
			throw new Error("No workspace folder found")
		}
		tempDir = path.join(workspaceFolder.uri.fsPath, "test-diagnostics")
		await fs.mkdir(tempDir, { recursive: true })
		tempFile = path.join(tempDir, "test-file.ts")
	})

	suiteTeardown(async () => {
		// Clean up temporary files
		try {
			await fs.rm(tempDir, { recursive: true, force: true })
		} catch (error) {
			console.error("Failed to clean up temp directory:", error)
		}
	})

	test("Should respect includeDiagnosticMessages setting when disabled", async () => {
		const api = globalThis.api

		// Create a file with intentional errors
		const fileContent = `
function testFunction() {
	const x = 1
	const y = 2
	// Missing return statement
}

// Unused variable
const unusedVar = "test"

// Type error
const num: number = "string"
`
		await fs.writeFile(tempFile, fileContent)

		// Open the file to trigger diagnostics
		const doc = await vscode.workspace.openTextDocument(tempFile)
		await vscode.window.showTextDocument(doc)

		// Wait for diagnostics to be generated
		await new Promise((resolve) => setTimeout(resolve, 2000))

		const messages: ClineMessage[] = []

		api.on("message", ({ message }) => {
			messages.push(message)
		})

		// Start a task with diagnostic messages disabled
		const taskId = await api.startNewTask({
			configuration: {
				mode: "code",
				autoApprovalEnabled: true,
				includeDiagnosticMessages: false,
			},
			text: `Check the problems in the file ${tempFile} using @problems mention`,
		})

		await waitUntilCompleted({ api, taskId })

		// Check that no diagnostic details were included
		const problemMessages = messages.filter((m) => m.type === "say" && m.text?.includes("workspace_diagnostics"))

		assert.ok(problemMessages.length > 0, "Should have workspace diagnostics message")

		const diagnosticsContent = problemMessages[0].text
		assert.ok(
			!diagnosticsContent?.includes("Type 'string' is not assignable to type 'number'") &&
				!diagnosticsContent?.includes("unusedVar") &&
				!diagnosticsContent?.includes("Missing return statement"),
			"Should not include detailed diagnostic messages when disabled",
		)
	})

	test("Should respect maxDiagnosticMessages setting", async () => {
		const api = globalThis.api

		// Create multiple files with errors to generate many diagnostics
		const files = []
		for (let i = 0; i < 10; i++) {
			const fileName = path.join(tempDir, `error-file-${i}.ts`)
			files.push(fileName)
			await fs.writeFile(
				fileName,
				`
				const error${i}: number = "string${i}"
				const unused${i} = "test"
				function missing${i}() {
					// Missing return
				}
			`,
			)
		}

		// Open all files to trigger diagnostics
		for (const file of files) {
			const doc = await vscode.workspace.openTextDocument(file)
			await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true })
		}

		// Wait for diagnostics
		await new Promise((resolve) => setTimeout(resolve, 3000))

		const messages: ClineMessage[] = []

		api.on("message", ({ message }) => {
			messages.push(message)
		})

		// Start a task with limited diagnostic messages
		const taskId = await api.startNewTask({
			configuration: {
				mode: "code",
				autoApprovalEnabled: true,
				includeDiagnosticMessages: true,
				maxDiagnosticMessages: 5,
			},
			text: `List all problems in the workspace using @problems mention`,
		})

		await waitUntilCompleted({ api, taskId })

		// Extract diagnostic content
		const problemMessages = messages.filter((m) => m.type === "say" && m.text?.includes("workspace_diagnostics"))

		assert.ok(problemMessages.length > 0, "Should have workspace diagnostics message")

		const diagnosticsContent = problemMessages[0].text || ""

		// Count the number of diagnostic entries
		const diagnosticMatches = diagnosticsContent.match(/error\d+:/g) || []

		assert.ok(
			diagnosticMatches.length <= 5,
			`Should limit diagnostics to 5 or fewer, but found ${diagnosticMatches.length}`,
		)

		// Clean up test files
		for (const file of files) {
			await fs.unlink(file).catch(() => {})
		}
	})

	test("Should include all diagnostics when maxDiagnosticMessages is -1 (unlimited)", async () => {
		const api = globalThis.api

		// Create multiple files with errors
		const files = []
		for (let i = 0; i < 3; i++) {
			const fileName = path.join(tempDir, `unlimited-error-${i}.ts`)
			files.push(fileName)
			await fs.writeFile(
				fileName,
				`
				const unlimitedError${i}: number = "string${i}"
				const unusedUnlimited${i} = "test"
			`,
			)
		}

		// Open all files
		for (const file of files) {
			const doc = await vscode.workspace.openTextDocument(file)
			await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true })
		}

		await new Promise((resolve) => setTimeout(resolve, 2000))

		const messages: ClineMessage[] = []

		api.on("message", ({ message }) => {
			messages.push(message)
		})

		// Start a task with unlimited diagnostic messages
		const taskId = await api.startNewTask({
			configuration: {
				mode: "code",
				autoApprovalEnabled: true,
				includeDiagnosticMessages: true,
				maxDiagnosticMessages: -1,
			},
			text: `Show all problems in files starting with unlimited-error using @problems`,
		})

		await waitUntilCompleted({ api, taskId })

		const problemMessages = messages.filter((m) => m.type === "say" && m.text?.includes("workspace_diagnostics"))

		assert.ok(problemMessages.length > 0, "Should have workspace diagnostics message")

		const diagnosticsContent = problemMessages[0].text || ""

		// Should include diagnostics from all 3 files
		for (let i = 0; i < 3; i++) {
			assert.ok(
				diagnosticsContent.includes(`unlimitedError${i}`),
				`Should include diagnostic from file ${i} when unlimited`,
			)
		}

		// Clean up
		for (const file of files) {
			await fs.unlink(file).catch(() => {})
		}
	})

	test("Should use default values when settings are not provided", async () => {
		const api = globalThis.api

		// Create a file with an error
		const defaultTestFile = path.join(tempDir, "default-test.ts")
		await fs.writeFile(defaultTestFile, `const defaultError: number = "string"`)

		const doc = await vscode.workspace.openTextDocument(defaultTestFile)
		await vscode.window.showTextDocument(doc)

		await new Promise((resolve) => setTimeout(resolve, 1500))

		const messages: ClineMessage[] = []

		api.on("message", ({ message }) => {
			messages.push(message)
		})

		// Start a task without specifying diagnostic settings
		const taskId = await api.startNewTask({
			configuration: {
				mode: "code",
				autoApprovalEnabled: true,
				// No diagnostic settings provided - should use defaults
			},
			text: `Check problems in ${defaultTestFile} using @problems`,
		})

		await waitUntilCompleted({ api, taskId })

		const problemMessages = messages.filter((m) => m.type === "say" && m.text?.includes("workspace_diagnostics"))

		assert.ok(problemMessages.length > 0, "Should have workspace diagnostics message")

		const diagnosticsContent = problemMessages[0].text || ""

		// Default includeDiagnosticMessages is true, so should include details
		assert.ok(
			diagnosticsContent.includes("Type 'string' is not assignable to type 'number'") ||
				diagnosticsContent.includes("defaultError"),
			"Should include diagnostic details by default",
		)

		await fs.unlink(defaultTestFile).catch(() => {})
	})
})
