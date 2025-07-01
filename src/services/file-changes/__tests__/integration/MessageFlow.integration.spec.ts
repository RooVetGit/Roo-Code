// Integration tests for webview-extension message flow for FilesChangedOverview
// npx vitest run src/services/file-changes/__tests__/integration/MessageFlow.integration.test.ts

import { describe, beforeEach, afterEach, it, expect, vi } from "vitest"
import * as fs from "fs/promises"
import * as path from "path"
import { EventEmitter } from "vscode"
import { FileChangeManager } from "../../FileChangeManager"

// Override vscode mock for these specific tests with working EventEmitter
vi.mock("vscode", async () => {
	const originalVscode = await vi.importActual("../../../../__mocks__/vscode.js")

	// Create working EventEmitter constructor function
	const WorkingEventEmitter = function (this: any) {
		this.listeners = []

		this.event = (listener: any) => {
			this.listeners.push(listener)
			return {
				dispose: () => {
					const index = this.listeners.indexOf(listener)
					if (index >= 0) {
						this.listeners.splice(index, 1)
					}
				},
			}
		}

		this.fire = (data: any) => {
			this.listeners.forEach((listener: any) => {
				try {
					listener(data)
				} catch (e) {
					// Ignore listener errors in tests
				}
			})
		}

		this.dispose = () => {
			this.listeners = []
		}
	}

	return {
		...originalVscode,
		EventEmitter: WorkingEventEmitter,
	}
})

// Mock filesystem and vscode
vi.mock("fs/promises", () => ({
	mkdir: vi.fn(),
	writeFile: vi.fn(),
	rename: vi.fn(),
	readFile: vi.fn(),
	access: vi.fn(),
	unlink: vi.fn(),
}))

// Mock console for tests
const mockConsole = {
	log: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
	debug: vi.fn(),
}
vi.stubGlobal("console", mockConsole)
vi.stubGlobal("setImmediate", (fn: () => void) => setTimeout(fn, 0))

// Mock webview message handler
interface WebviewMessage {
	type: string
	[key: string]: any
}

interface ExtensionMessage {
	type: string
	[key: string]: any
}

// Simulated webview-extension communication
class MockMessageBridge {
	private webviewToExtensionHandlers: Array<(message: WebviewMessage) => void> = []
	private extensionToWebviewHandlers: Array<(message: ExtensionMessage) => void> = []

	// Webview sends message to extension
	postMessageToExtension(message: WebviewMessage) {
		this.webviewToExtensionHandlers.forEach((handler) => {
			try {
				handler(message)
			} catch (error) {
				console.error("Error in extension message handler:", error)
			}
		})
	}

	// Extension sends message to webview
	postMessageToWebview(message: ExtensionMessage) {
		this.extensionToWebviewHandlers.forEach((handler) => {
			try {
				handler(message)
			} catch (error) {
				console.error("Error in webview message handler:", error)
			}
		})
	}

	// Register handlers
	onWebviewMessage(handler: (message: WebviewMessage) => void) {
		this.webviewToExtensionHandlers.push(handler)
	}

	onExtensionMessage(handler: (message: ExtensionMessage) => void) {
		this.extensionToWebviewHandlers.push(handler)
	}

	// Clear handlers
	clear() {
		this.webviewToExtensionHandlers = []
		this.extensionToWebviewHandlers = []
	}
}

// Mock extension-side file operations
class MockFileOperations {
	private files: Map<string, string> = new Map()

	constructor() {
		// Mock fs operations to use our in-memory storage
		vi.mocked(fs.writeFile).mockImplementation(async (filePath: any, content: any) => {
			this.files.set(String(filePath), String(content))
		})

		vi.mocked(fs.readFile).mockImplementation(async (filePath: any) => {
			const content = this.files.get(String(filePath))
			if (content === undefined) {
				throw new Error(`ENOENT: no such file or directory, open '${filePath}'`)
			}
			return content
		})

		vi.mocked(fs.access).mockImplementation(async (filePath: any) => {
			if (!this.files.has(String(filePath))) {
				throw new Error(`ENOENT: no such file or directory, access '${filePath}'`)
			}
		})
	}

	setFile(filePath: string, content: string) {
		this.files.set(filePath, content)
	}

	getFile(filePath: string): string | undefined {
		return this.files.get(filePath)
	}

	hasFile(filePath: string): boolean {
		return this.files.has(filePath)
	}

	deleteFile(filePath: string) {
		this.files.delete(filePath)
	}

	clear() {
		this.files.clear()
	}
}

// Mock checkpoint service for diff operations
class MockCheckpointService {
	private checkpoints: Map<string, Map<string, string>> = new Map()

	addCheckpoint(checkpointHash: string, files: Map<string, string>) {
		this.checkpoints.set(checkpointHash, new Map(files))
	}

	getFileDiff(fromHash: string, toHash: string, filePath: string) {
		const fromFiles = this.checkpoints.get(fromHash) || new Map()
		const toFiles = this.checkpoints.get(toHash) || new Map()

		return {
			paths: { relative: filePath, absolute: `/abs/${filePath}` },
			content: {
				before: fromFiles.get(filePath) || "",
				after: toFiles.get(filePath) || "",
			},
			type: "edit",
		}
	}

	getDiff(fromHash: string, toHash: string) {
		const fromFiles = this.checkpoints.get(fromHash) || new Map()
		const toFiles = this.checkpoints.get(toHash) || new Map()
		const allFiles = new Set([...fromFiles.keys(), ...toFiles.keys()])

		return Array.from(allFiles).map((filePath) => this.getFileDiff(fromHash, toHash, filePath))
	}
}

describe("FilesChangedOverview Message Flow Integration", () => {
	let fileChangeManager: FileChangeManager
	let messageBridge: MockMessageBridge
	let fileOperations: MockFileOperations
	let checkpointService: MockCheckpointService
	let mockTaskId: string
	let mockGlobalStoragePath: string
	let mockBaseCheckpoint: string

	// Simulated extension-side message handler
	const extensionMessageHandler = (message: WebviewMessage) => {
		switch (message.type) {
			case "viewDiff": {
				// Simulate opening diff view
				const uri = message.uri
				console.log(`Opening diff view for ${uri}`)
				break
			}

			case "acceptFileChange": {
				const uri = message.uri
				fileChangeManager
					.acceptChange(uri)
					.then(() => {
						// Send updated state to webview
						const changes = fileChangeManager.getChanges()
						messageBridge.postMessageToWebview({
							type: "filesChanged",
							filesChanged: changes.files.length > 0 ? changes : undefined,
						})
					})
					.catch((error) => {
						// Handle errors properly to avoid unhandled rejections
						console.error("Failed to accept file change:", error)
						// Send error state to webview
						messageBridge.postMessageToWebview({
							type: "fileChangeError",
							error: error.message,
							uri: uri,
						})
					})
				break
			}

			case "rejectFileChange": {
				const uri = message.uri
				// Simulate reverting file content
				const change = fileChangeManager.getFileChange(uri)
				if (change) {
					const originalContent = checkpointService.getFileDiff(
						change.fromCheckpoint,
						change.toCheckpoint,
						uri,
					).content.before
					fileOperations.setFile(uri, originalContent)
				}

				fileChangeManager
					.rejectChange(uri)
					.then(() => {
						// Send updated state to webview
						const changes = fileChangeManager.getChanges()
						messageBridge.postMessageToWebview({
							type: "filesChanged",
							filesChanged: changes.files.length > 0 ? changes : undefined,
						})
					})
					.catch((error) => {
						// Handle errors properly to avoid unhandled rejections
						console.error("Failed to reject file change:", error)
						// Send error state to webview
						messageBridge.postMessageToWebview({
							type: "fileChangeError",
							error: error.message,
							uri: uri,
						})
					})
				break
			}

			case "acceptAllFileChanges": {
				fileChangeManager
					.acceptAll()
					.then(() => {
						// Send updated state to webview
						messageBridge.postMessageToWebview({
							type: "filesChanged",
							filesChanged: undefined,
						})
					})
					.catch((error) => {
						// Handle errors properly to avoid unhandled rejections
						console.error("Failed to accept all file changes:", error)
						messageBridge.postMessageToWebview({
							type: "fileChangeError",
							error: error.message,
						})
					})
				break
			}

			case "rejectAllFileChanges": {
				// Simulate reverting all files to baseline
				const changes = fileChangeManager.getChanges()
				changes.files.forEach((change) => {
					const originalContent = checkpointService.getFileDiff(
						change.fromCheckpoint,
						change.toCheckpoint,
						change.uri,
					).content.before
					fileOperations.setFile(change.uri, originalContent)
				})

				fileChangeManager
					.rejectAll()
					.then(() => {
						// Send updated state to webview
						messageBridge.postMessageToWebview({
							type: "filesChanged",
							filesChanged: undefined,
						})
					})
					.catch((error) => {
						// Handle errors properly to avoid unhandled rejections
						console.error("Failed to reject all file changes:", error)
						messageBridge.postMessageToWebview({
							type: "fileChangeError",
							error: error.message,
						})
					})
				break
			}
		}
	}

	beforeEach(async () => {
		// Reset all mocks
		vi.clearAllMocks()
		vi.resetAllMocks()

		// Setup test infrastructure
		mockTaskId = `integration-test-${Date.now()}`
		mockGlobalStoragePath = "/mock/storage"
		mockBaseCheckpoint = "baseline-hash"

		// Initialize services
		messageBridge = new MockMessageBridge()
		fileOperations = new MockFileOperations()
		checkpointService = new MockCheckpointService()

		// Setup filesystem mocks
		vi.mocked(fs.mkdir).mockResolvedValue(undefined)
		vi.mocked(fs.rename).mockResolvedValue(undefined)
		vi.mocked(fs.unlink).mockResolvedValue(undefined)

		// Create FileChangeManager
		fileChangeManager = new FileChangeManager(mockBaseCheckpoint, mockTaskId, mockGlobalStoragePath)
		await new Promise((resolve) => setTimeout(resolve, 0))

		// Setup message bridge
		messageBridge.onWebviewMessage(extensionMessageHandler)

		// Setup checkpoint data
		const baselineFiles = new Map([
			["src/test1.ts", "// Original content 1"],
			["src/test2.ts", "// Original content 2"],
			["docs/readme.md", "# Original README"],
		])
		checkpointService.addCheckpoint(mockBaseCheckpoint, baselineFiles)

		const currentFiles = new Map([
			["src/test1.ts", "// Original content 1\n// New line added"],
			["src/test2.ts", "// Modified content 2"],
			["docs/readme.md", "# Updated README\nNew content"],
		])
		checkpointService.addCheckpoint("current-hash", currentFiles)

		// Setup initial file changes
		fileChangeManager.recordChange("src/test1.ts", "edit", mockBaseCheckpoint, "current-hash", 1, 0)
		fileChangeManager.recordChange("src/test2.ts", "edit", mockBaseCheckpoint, "current-hash", 0, 1)
		fileChangeManager.recordChange("docs/readme.md", "edit", mockBaseCheckpoint, "current-hash", 1, 0)

		await new Promise((resolve) => setTimeout(resolve, 10))
	})

	afterEach(() => {
		messageBridge.clear()
		fileOperations.clear()
		fileChangeManager.dispose()
	})

	describe("Basic Message Flow", () => {
		it("should handle webview to extension message sending", () => {
			const messages: WebviewMessage[] = []
			messageBridge.onWebviewMessage((msg) => messages.push(msg))

			// Simulate webview sending messages
			messageBridge.postMessageToExtension({ type: "viewDiff", uri: "src/test1.ts" })
			messageBridge.postMessageToExtension({ type: "acceptFileChange", uri: "src/test2.ts" })

			expect(messages).toHaveLength(2)
			expect(messages[0]).toEqual({ type: "viewDiff", uri: "src/test1.ts" })
			expect(messages[1]).toEqual({ type: "acceptFileChange", uri: "src/test2.ts" })
		})

		it("should handle extension to webview message sending", () => {
			const messages: ExtensionMessage[] = []
			messageBridge.onExtensionMessage((msg) => messages.push(msg))

			// Simulate extension sending messages
			const changeset = fileChangeManager.getChanges()
			messageBridge.postMessageToWebview({ type: "filesChanged", filesChanged: changeset })

			expect(messages).toHaveLength(1)
			expect(messages[0].type).toBe("filesChanged")
			expect(messages[0].filesChanged.files).toHaveLength(3)
		})
	})

	describe("File Change Actions", () => {
		it("should handle accepting a single file change", async () => {
			const webviewMessages: ExtensionMessage[] = []
			messageBridge.onExtensionMessage((msg) => webviewMessages.push(msg))

			// Initial state - 3 files changed
			expect(fileChangeManager.getFileChangeCount()).toBe(3)

			// Webview sends accept message
			messageBridge.postMessageToExtension({ type: "acceptFileChange", uri: "src/test1.ts" })

			// Wait for async processing
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Should have 2 files remaining
			expect(fileChangeManager.getFileChangeCount()).toBe(2)
			expect(fileChangeManager.getFileChange("src/test1.ts")).toBeUndefined()

			// Should notify webview of updated state
			expect(webviewMessages).toHaveLength(1)
			expect(webviewMessages[0].type).toBe("filesChanged")
			expect(webviewMessages[0].filesChanged.files).toHaveLength(2)
		})

		it("should handle rejecting a single file change", async () => {
			const webviewMessages: ExtensionMessage[] = []
			messageBridge.onExtensionMessage((msg) => webviewMessages.push(msg))

			// Set up file with modified content
			fileOperations.setFile("src/test1.ts", "// Modified content")

			// Webview sends reject message
			messageBridge.postMessageToExtension({ type: "rejectFileChange", uri: "src/test1.ts" })

			// Wait for async processing
			await new Promise((resolve) => setTimeout(resolve, 10))

			// File should be reverted to original content
			expect(fileOperations.getFile("src/test1.ts")).toBe("// Original content 1")

			// Should have 2 files remaining
			expect(fileChangeManager.getFileChangeCount()).toBe(2)

			// Should notify webview
			expect(webviewMessages).toHaveLength(1)
			expect(webviewMessages[0].type).toBe("filesChanged")
		})

		it("should handle accepting all file changes", async () => {
			const webviewMessages: ExtensionMessage[] = []
			messageBridge.onExtensionMessage((msg) => webviewMessages.push(msg))

			// Webview sends accept all message
			messageBridge.postMessageToExtension({ type: "acceptAllFileChanges" })

			// Wait for async processing
			await new Promise((resolve) => setTimeout(resolve, 10))

			// All files should be accepted
			expect(fileChangeManager.getFileChangeCount()).toBe(0)

			// Should notify webview with undefined (no changes)
			expect(webviewMessages).toHaveLength(1)
			expect(webviewMessages[0].type).toBe("filesChanged")
			expect(webviewMessages[0].filesChanged).toBeUndefined()
		})

		it("should handle rejecting all file changes", async () => {
			const webviewMessages: ExtensionMessage[] = []
			messageBridge.onExtensionMessage((msg) => webviewMessages.push(msg))

			// Set up files with modified content
			fileOperations.setFile("src/test1.ts", "// Modified content 1")
			fileOperations.setFile("src/test2.ts", "// Modified content 2")
			fileOperations.setFile("docs/readme.md", "# Modified README")

			// Webview sends reject all message
			messageBridge.postMessageToExtension({ type: "rejectAllFileChanges" })

			// Wait for async processing
			await new Promise((resolve) => setTimeout(resolve, 10))

			// All files should be reverted
			expect(fileOperations.getFile("src/test1.ts")).toBe("// Original content 1")
			expect(fileOperations.getFile("src/test2.ts")).toBe("// Original content 2")
			expect(fileOperations.getFile("docs/readme.md")).toBe("# Original README")

			// All changes should be cleared
			expect(fileChangeManager.getFileChangeCount()).toBe(0)

			// Should notify webview
			expect(webviewMessages).toHaveLength(1)
			expect(webviewMessages[0].filesChanged).toBeUndefined()
		})
	})

	describe("View Diff Action", () => {
		it("should handle view diff request", () => {
			const consoleLogSpy = vi.spyOn(console, "log")

			// Webview sends view diff message
			messageBridge.postMessageToExtension({ type: "viewDiff", uri: "src/test1.ts" })

			// Should log diff opening (simulated)
			expect(consoleLogSpy).toHaveBeenCalledWith("Opening diff view for src/test1.ts")
		})
	})

	describe("Real-time State Synchronization", () => {
		it("should keep webview state in sync with file changes", async () => {
			const webviewMessages: ExtensionMessage[] = []
			messageBridge.onExtensionMessage((msg) => webviewMessages.push(msg))

			// Simulate file change manager detecting new changes
			fileChangeManager.recordChange("src/new-file.ts", "create", mockBaseCheckpoint, "new-hash", 10, 0)
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Add a new change to simulate real-time updates
			fileChangeManager.recordChange("src/another-file.ts", "create", mockBaseCheckpoint, "another-hash", 5, 0)
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Accept one change
			messageBridge.postMessageToExtension({ type: "acceptFileChange", uri: "src/test1.ts" })
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Reject another change
			messageBridge.postMessageToExtension({ type: "rejectFileChange", uri: "src/test2.ts" })
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Should have sent multiple state updates
			expect(webviewMessages.length).toBeGreaterThan(0)

			// Final state should have 3 files (original docs/readme.md + 2 new files)
			const finalMessage = webviewMessages[webviewMessages.length - 1]
			expect(finalMessage.type).toBe("filesChanged")
			expect(finalMessage.filesChanged.files).toHaveLength(3)
		})

		it("should handle concurrent file operations", async () => {
			const webviewMessages: ExtensionMessage[] = []
			messageBridge.onExtensionMessage((msg) => webviewMessages.push(msg))

			// Send multiple concurrent messages
			const promises = [
				messageBridge.postMessageToExtension({ type: "acceptFileChange", uri: "src/test1.ts" }),
				messageBridge.postMessageToExtension({ type: "rejectFileChange", uri: "src/test2.ts" }),
				messageBridge.postMessageToExtension({ type: "acceptFileChange", uri: "docs/readme.md" }),
			]

			// Wait for all operations to complete
			await Promise.all(promises)
			await new Promise((resolve) => setTimeout(resolve, 20))

			// All operations should complete successfully
			expect(fileChangeManager.getFileChangeCount()).toBe(0)

			// Should have received state updates
			expect(webviewMessages.length).toBeGreaterThan(0)

			// Final state should show no changes
			const finalMessage = webviewMessages[webviewMessages.length - 1]
			expect(finalMessage.filesChanged).toBeUndefined()
		})
	})

	describe("Error Handling", () => {
		it("should handle file operation errors gracefully", async () => {
			// Mock file operation to fail
			vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error("Disk full"))

			const webviewMessages: ExtensionMessage[] = []
			messageBridge.onExtensionMessage((msg) => webviewMessages.push(msg))

			// Verify file exists before test
			expect(fileChangeManager.getFileChange("src/test1.ts")).toBeDefined()

			// Try to accept a change
			messageBridge.postMessageToExtension({ type: "acceptFileChange", uri: "src/test1.ts" })

			// Wait for async processing
			await new Promise((resolve) => setTimeout(resolve, 20))

			// Should receive an error message
			expect(webviewMessages).toHaveLength(1)
			expect(webviewMessages[0]).toEqual({
				type: "fileChangeError",
				error: "Disk full",
				uri: "src/test1.ts",
			})

			// File should still be in changeset since operation failed
			expect(fileChangeManager.getFileChange("src/test1.ts")).toBeDefined()
		})

		it("should handle invalid message types gracefully", () => {
			expect(() => {
				messageBridge.postMessageToExtension({ type: "invalidMessageType", data: "test" })
			}).not.toThrow()

			// Should not cause any state changes
			expect(fileChangeManager.getFileChangeCount()).toBe(3)
		})

		it("should handle missing file URIs gracefully", async () => {
			const webviewMessages: ExtensionMessage[] = []
			messageBridge.onExtensionMessage((msg) => webviewMessages.push(msg))

			// Send message with non-existent file
			messageBridge.postMessageToExtension({ type: "acceptFileChange", uri: "non-existent.ts" })

			await new Promise((resolve) => setTimeout(resolve, 10))

			// Should not crash and original files should remain
			expect(fileChangeManager.getFileChangeCount()).toBe(3)
		})
	})

	describe("Performance and Memory", () => {
		it("should handle large number of file changes efficiently", async () => {
			// Clear existing changes
			await fileChangeManager.acceptAll()

			// Add many file changes
			const numFiles = 100
			for (let i = 0; i < numFiles; i++) {
				fileChangeManager.recordChange(`src/file${i}.ts`, "create", mockBaseCheckpoint, "batch-hash", 1, 0)
			}

			await new Promise((resolve) => setTimeout(resolve, 10))

			expect(fileChangeManager.getFileChangeCount()).toBe(numFiles)

			// Accept all should complete in reasonable time
			const startTime = Date.now()
			messageBridge.postMessageToExtension({ type: "acceptAllFileChanges" })
			await new Promise((resolve) => setTimeout(resolve, 50))
			const endTime = Date.now()

			expect(endTime - startTime).toBeLessThan(1000) // Should complete within 1 second
			expect(fileChangeManager.getFileChangeCount()).toBe(0)
		})

		it("should properly clean up resources", () => {
			// Dispose should not throw
			expect(() => fileChangeManager.dispose()).not.toThrow()

			// Message bridge should clear handlers
			expect(() => messageBridge.clear()).not.toThrow()
		})
	})
})
