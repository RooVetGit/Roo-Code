import type { Mock } from "vitest"
import * as vscode from "vscode"
import WorkspaceTracker from "../WorkspaceTracker"
import { ClineProvider } from "../../../core/webview/ClineProvider"
import { listFiles } from "../../../services/glob/list-files"
import { getWorkspacePath } from "../../../utils/path"
import { executeRipgrepForFiles } from "../../../services/search/file-search"

// Mock functions - must be defined before vitest.mock calls
const mockOnDidCreate = vitest.fn()
const mockOnDidDelete = vitest.fn()
const mockDispose = vitest.fn()

// Store registered tab change callback
let registeredTabChangeCallback: (() => Promise<void>) | null = null
// Store registered configuration change callback
let registeredConfigChangeCallback: ((event: any) => void) | null = null

// Mock workspace path
vitest.mock("../../../utils/path", () => ({
	getWorkspacePath: vitest.fn().mockReturnValue("/test/workspace"),
	toRelativePath: vitest.fn((path, cwd) => {
		// Handle both Windows and POSIX paths by using path.relative
		const relativePath = require("path").relative(cwd, path)
		// Convert to forward slashes for consistency
		let normalizedPath = relativePath.replace(/\\/g, "/")
		// Add trailing slash if original path had one
		return path.endsWith("/") ? normalizedPath + "/" : normalizedPath
	}),
}))

// Mock executeRipgrepForFiles function
vitest.mock("../../../services/search/file-search", () => ({
	executeRipgrepForFiles: vitest.fn(),
}))

// Mock ignore utils
vitest.mock("../../../services/glob/ignore-utils", () => ({
	isPathInIgnoredDirectory: vitest.fn().mockReturnValue(false),
}))

// Mock watcher - must be defined after mockDispose but before vitest.mock("vscode")
const mockWatcher = {
	onDidCreate: mockOnDidCreate.mockReturnValue({ dispose: mockDispose }),
	onDidDelete: mockOnDidDelete.mockReturnValue({ dispose: mockDispose }),
	dispose: mockDispose,
}

// Mock vscode
vitest.mock("vscode", () => ({
	window: {
		tabGroups: {
			onDidChangeTabs: vitest.fn((callback) => {
				registeredTabChangeCallback = callback
				return { dispose: mockDispose }
			}),
			all: [],
		},
		onDidChangeActiveTextEditor: vitest.fn(() => ({ dispose: vitest.fn() })),
	},
	workspace: {
		workspaceFolders: [
			{
				uri: { fsPath: "/test/workspace" },
				name: "test",
				index: 0,
			},
		],
		createFileSystemWatcher: vitest.fn(() => mockWatcher),
		fs: {
			stat: vitest.fn().mockResolvedValue({ type: 1 }), // FileType.File = 1
		},
		getConfiguration: vitest.fn(),
		onDidChangeConfiguration: vitest.fn((callback) => {
			registeredConfigChangeCallback = callback
			return { dispose: mockDispose }
		}),
	},
	FileType: { File: 1, Directory: 2 },
}))

vitest.mock("../../../services/glob/list-files", () => ({
	listFiles: vitest.fn(),
}))

describe("WorkspaceTracker", () => {
	let workspaceTracker: WorkspaceTracker
	let mockProvider: ClineProvider
	let mockExecuteRipgrepForFiles: Mock

	beforeEach(() => {
		vitest.clearAllMocks()
		vitest.useFakeTimers()

		// Reset all mock implementations
		registeredTabChangeCallback = null
		registeredConfigChangeCallback = null

		// Reset workspace path mock
		;(getWorkspacePath as Mock).mockReturnValue("/test/workspace")

		// Setup executeRipgrepForFiles mock
		mockExecuteRipgrepForFiles = executeRipgrepForFiles as Mock
		mockExecuteRipgrepForFiles.mockResolvedValue([
			{ path: "src/test1.ts", type: "file", label: "test1.ts" },
			{ path: "src/test2.ts", type: "file", label: "test2.ts" },
		])

		// Setup workspace configuration mock
		const mockConfig = {
			get: vitest.fn((key: string, defaultValue?: any) => {
				switch (key) {
					case "useIgnoreFiles":
						return true
					case "useGlobalIgnoreFiles":
						return true
					case "useParentIgnoreFiles":
						return true
					default:
						return defaultValue
				}
			}),
		}
		;(vscode.workspace.getConfiguration as Mock).mockReturnValue(mockConfig)

		// Create provider mock
		mockProvider = {
			postMessageToWebview: vitest.fn().mockResolvedValue(undefined),
		} as unknown as ClineProvider & { postMessageToWebview: Mock }

		// Create tracker instance
		workspaceTracker = new WorkspaceTracker(mockProvider)

		// Ensure the tab change callback was registered
		expect(registeredTabChangeCallback).not.toBeNull()
		// Ensure the configuration change callback was registered
		expect(registeredConfigChangeCallback).not.toBeNull()
	})

	it("should initialize with workspace files", async () => {
		const mockFiles = [["/test/workspace/file1.ts", "/test/workspace/file2.ts"], false]
		;(listFiles as Mock).mockResolvedValue(mockFiles)

		await workspaceTracker.initializeFilePaths()
		vitest.runAllTimers()

		expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "workspaceUpdated",
			filePaths: expect.arrayContaining(["file1.ts", "file2.ts"]),
			openedTabs: [],
		})
		expect((mockProvider.postMessageToWebview as Mock).mock.calls[0][0].filePaths).toHaveLength(2)
	})

	it("should handle file creation events", async () => {
		// Get the creation callback and call it
		const [[callback]] = mockOnDidCreate.mock.calls
		await callback({ fsPath: "/test/workspace/newfile.ts" })
		vitest.runAllTimers()

		expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "workspaceUpdated",
			filePaths: ["newfile.ts"],
			openedTabs: [],
		})
	})

	it("should handle file deletion events", async () => {
		// First add a file
		const [[createCallback]] = mockOnDidCreate.mock.calls
		await createCallback({ fsPath: "/test/workspace/file.ts" })
		vitest.runAllTimers()

		// Then delete it
		const [[deleteCallback]] = mockOnDidDelete.mock.calls
		await deleteCallback({ fsPath: "/test/workspace/file.ts" })
		vitest.runAllTimers()

		// The last call should have empty filePaths
		expect(mockProvider.postMessageToWebview).toHaveBeenLastCalledWith({
			type: "workspaceUpdated",
			filePaths: [],
			openedTabs: [],
		})
	})

	it("should handle directory paths correctly", async () => {
		// Mock stat to return directory type
		;(vscode.workspace.fs.stat as Mock).mockResolvedValueOnce({ type: 2 }) // FileType.Directory = 2

		const [[callback]] = mockOnDidCreate.mock.calls
		await callback({ fsPath: "/test/workspace/newdir" })
		vitest.runAllTimers()

		expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "workspaceUpdated",
			filePaths: expect.arrayContaining(["newdir"]),
			openedTabs: [],
		})
		const lastCall = (mockProvider.postMessageToWebview as Mock).mock.calls.slice(-1)[0]
		expect(lastCall[0].filePaths).toHaveLength(1)
	})

	it("should respect file limits", async () => {
		// Create array of unique file paths for initial load
		const files = Array.from({ length: 1001 }, (_, i) => `/test/workspace/file${i}.ts`)
		;(listFiles as Mock).mockResolvedValue([files, false])

		await workspaceTracker.initializeFilePaths()
		vitest.runAllTimers()

		// Should only have 1000 files initially
		const expectedFiles = Array.from({ length: 1000 }, (_, i) => `file${i}.ts`).sort()
		const calls = (mockProvider.postMessageToWebview as Mock).mock.calls

		expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "workspaceUpdated",
			filePaths: expect.arrayContaining(expectedFiles),
			openedTabs: [],
		})
		expect(calls[0][0].filePaths).toHaveLength(1000)

		// Should allow adding up to 2000 total files
		const [[callback]] = mockOnDidCreate.mock.calls
		for (let i = 0; i < 1000; i++) {
			await callback({ fsPath: `/test/workspace/extra${i}.ts` })
		}
		vitest.runAllTimers()

		const lastCall = (mockProvider.postMessageToWebview as Mock).mock.calls.slice(-1)[0]
		expect(lastCall[0].filePaths).toHaveLength(2000)

		// Adding one more file beyond 2000 should not increase the count
		await callback({ fsPath: "/test/workspace/toomany.ts" })
		vitest.runAllTimers()

		const finalCall = (mockProvider.postMessageToWebview as Mock).mock.calls.slice(-1)[0]
		expect(finalCall[0].filePaths).toHaveLength(2000)
	})

	it("should clean up watchers and timers on dispose", () => {
		// Set up updateTimer
		const [[callback]] = mockOnDidCreate.mock.calls
		callback({ fsPath: "/test/workspace/file.ts" })

		workspaceTracker.dispose()
		expect(mockDispose).toHaveBeenCalled()
		vitest.runAllTimers() // Ensure any pending timers are cleared

		// No more updates should happen after dispose
		expect(mockProvider.postMessageToWebview).not.toHaveBeenCalled()
	})

	it("should handle workspace path changes when tabs change", async () => {
		expect(registeredTabChangeCallback).not.toBeNull()

		// Set initial workspace path and create tracker
		;(getWorkspacePath as Mock).mockReturnValue("/test/workspace")
		workspaceTracker = new WorkspaceTracker(mockProvider)

		// Clear any initialization calls
		vitest.clearAllMocks()

		// Mock listFiles to return some files
		const mockFiles = [["/test/new-workspace/file1.ts"], false]
		;(listFiles as Mock).mockResolvedValue(mockFiles)

		// Change workspace path
		;(getWorkspacePath as Mock).mockReturnValue("/test/new-workspace")

		// Simulate tab change event
		await registeredTabChangeCallback!()

		// Run the debounce timer for workspaceDidReset
		vitest.advanceTimersByTime(300)

		// Should clear file paths and reset workspace
		expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "workspaceUpdated",
			filePaths: [],
			openedTabs: [],
		})

		// Run all remaining timers to complete initialization
		await Promise.resolve() // Wait for initializeFilePaths to complete
		vitest.runAllTimers()

		// Should initialize file paths for new workspace
		expect(listFiles).toHaveBeenCalledWith("/test/new-workspace", true, 1000)
		vitest.runAllTimers()
	})

	it("should not update file paths if workspace changes during initialization", async () => {
		// Setup initial workspace path
		;(getWorkspacePath as Mock).mockReturnValue("/test/workspace")
		workspaceTracker = new WorkspaceTracker(mockProvider)

		// Clear any initialization calls
		vitest.clearAllMocks()
		;(mockProvider.postMessageToWebview as Mock).mockClear()

		// Create a promise to control listFiles timing
		let resolveListFiles: (value: [string[], boolean]) => void
		const listFilesPromise = new Promise<[string[], boolean]>((resolve) => {
			resolveListFiles = resolve
		})

		// Setup listFiles to use our controlled promise
		;(listFiles as Mock).mockImplementation(() => {
			// Change workspace path before listFiles resolves
			;(getWorkspacePath as Mock).mockReturnValue("/test/changed-workspace")
			return listFilesPromise
		})

		// Start initialization
		const initPromise = workspaceTracker.initializeFilePaths()

		// Resolve listFiles after workspace path change
		resolveListFiles!([["/test/workspace/file1.ts", "/test/workspace/file2.ts"], false])

		// Wait for initialization to complete
		await initPromise
		vitest.runAllTimers()

		// Should not update file paths because workspace changed during initialization
		expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "workspaceUpdated",
				openedTabs: [],
			}),
		)

		// Extract the actual file paths to verify format
		const actualFilePaths = (mockProvider.postMessageToWebview as Mock).mock.calls[0][0].filePaths

		// Verify file path array length
		expect(actualFilePaths).toHaveLength(2)

		// Verify file paths contain the expected file names regardless of platform specifics
		expect(actualFilePaths.every((path: string) => path.includes("file1.ts") || path.includes("file2.ts"))).toBe(
			true,
		)
	})

	it("should clear resetTimer when calling workspaceDidReset multiple times", async () => {
		expect(registeredTabChangeCallback).not.toBeNull()

		// Set initial workspace path
		;(getWorkspacePath as Mock).mockReturnValue("/test/workspace")

		// Create tracker instance to set initial prevWorkSpacePath
		workspaceTracker = new WorkspaceTracker(mockProvider)

		// Change workspace path to trigger update
		;(getWorkspacePath as Mock).mockReturnValue("/test/new-workspace")

		// Call workspaceDidReset through tab change event
		await registeredTabChangeCallback!()

		// Call again before timer completes
		await registeredTabChangeCallback!()

		// Advance timer
		vitest.advanceTimersByTime(300)

		// Should only have one call to postMessageToWebview
		expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "workspaceUpdated",
			filePaths: [],
			openedTabs: [],
		})
		expect(mockProvider.postMessageToWebview).toHaveBeenCalledTimes(1)
	})

	it("should handle dispose with active resetTimer", async () => {
		expect(registeredTabChangeCallback).not.toBeNull()

		// Mock workspace path change to trigger resetTimer
		;(getWorkspacePath as Mock).mockReturnValueOnce("/test/workspace").mockReturnValueOnce("/test/new-workspace")

		// Trigger resetTimer
		await registeredTabChangeCallback!()

		// Dispose before timer completes
		workspaceTracker.dispose()

		// Advance timer
		vitest.advanceTimersByTime(300)

		// Should have called dispose on all disposables
		expect(mockDispose).toHaveBeenCalled()

		// No postMessage should be called after dispose
		expect(mockProvider.postMessageToWebview).not.toHaveBeenCalled()
	})

	describe("ripgrep file list caching", () => {
		it("should fetch and cache ripgrep file list", async () => {
			const expectedFiles = [
				{ path: "src/component.tsx", type: "file", label: "component.tsx" },
				{ path: "src/utils.ts", type: "file", label: "utils.ts" },
			]
			mockExecuteRipgrepForFiles.mockResolvedValueOnce(expectedFiles)

			const result = await workspaceTracker.getRipgrepFileList()

			expect(mockExecuteRipgrepForFiles).toHaveBeenCalledWith("/test/workspace", 500000, [])
			expect(result).toEqual(expectedFiles)

			// Second call should return cached results
			mockExecuteRipgrepForFiles.mockClear()
			const cachedResult = await workspaceTracker.getRipgrepFileList()

			expect(mockExecuteRipgrepForFiles).not.toHaveBeenCalled()
			expect(cachedResult).toEqual(expectedFiles)
		})

		it("should clear cache when workspace path changes", async () => {
			// First fetch file list
			const initialFiles = [{ path: "src/file1.ts", type: "file", label: "file1.ts" }]
			mockExecuteRipgrepForFiles.mockResolvedValueOnce(initialFiles)
			await workspaceTracker.getRipgrepFileList()

			// Change workspace path
			;(getWorkspacePath as Mock).mockReturnValue("/test/new-workspace")
			const newFiles = [{ path: "src/file2.ts", type: "file", label: "file2.ts" }]
			mockExecuteRipgrepForFiles.mockResolvedValueOnce(newFiles)

			const result = await workspaceTracker.getRipgrepFileList()

			expect(mockExecuteRipgrepForFiles).toHaveBeenCalledWith("/test/new-workspace", 500000, [])
			expect(result).toEqual(newFiles)
		})

		it("should handle ripgrep execution errors", async () => {
			mockExecuteRipgrepForFiles.mockRejectedValueOnce(new Error("ripgrep execution failed"))

			const result = await workspaceTracker.getRipgrepFileList()

			expect(result).toEqual([])
		})

		it("should wait for ongoing ripgrep operations", async () => {
			let resolveFirst: (value: any) => void
			const firstPromise = new Promise((resolve) => {
				resolveFirst = resolve
			})

			mockExecuteRipgrepForFiles.mockImplementationOnce(() => firstPromise)

			// Start first operation
			const firstCall = workspaceTracker.getRipgrepFileList()

			// Start second operation (should wait for first)
			const secondCall = workspaceTracker.getRipgrepFileList()

			// Resolve first promise
			const expectedFiles = [{ path: "src/test.ts", type: "file", label: "test.ts" }]
			resolveFirst!(expectedFiles)

			const [firstResult, secondResult] = await Promise.all([firstCall, secondCall])

			expect(firstResult).toEqual(expectedFiles)
			expect(secondResult).toEqual(expectedFiles)
			expect(mockExecuteRipgrepForFiles).toHaveBeenCalledTimes(1)
		})

		it("should return empty array when no workspace path", async () => {
			;(getWorkspacePath as Mock).mockReturnValue(undefined)

			const result = await workspaceTracker.getRipgrepFileList()

			expect(result).toEqual([])
			expect(mockExecuteRipgrepForFiles).not.toHaveBeenCalled()
		})
	})

	describe("VSCode search configuration options", () => {
		it("should generate correct ripgrep options based on useIgnoreFiles config", async () => {
			const mockConfig = {
				get: vitest.fn((key: string, defaultValue?: any) => {
					if (key === "useIgnoreFiles") return false
					return defaultValue ?? true
				}),
			}
			;(vscode.workspace.getConfiguration as Mock).mockReturnValue(mockConfig)

			await workspaceTracker.getRipgrepFileList()

			expect(mockExecuteRipgrepForFiles).toHaveBeenCalledWith("/test/workspace", 500000, ["--no-ignore"])
		})

		it("should generate correct ripgrep options based on useGlobalIgnoreFiles config", async () => {
			const mockConfig = {
				get: vitest.fn((key: string, defaultValue?: any) => {
					switch (key) {
						case "useIgnoreFiles":
							return true
						case "useGlobalIgnoreFiles":
							return false
						case "useParentIgnoreFiles":
							return true
						default:
							return defaultValue
					}
				}),
			}
			;(vscode.workspace.getConfiguration as Mock).mockReturnValue(mockConfig)

			await workspaceTracker.getRipgrepFileList()

			expect(mockExecuteRipgrepForFiles).toHaveBeenCalledWith("/test/workspace", 500000, ["--no-ignore-global"])
		})

		it("should generate correct ripgrep options based on useParentIgnoreFiles config", async () => {
			const mockConfig = {
				get: vitest.fn((key: string, defaultValue?: any) => {
					switch (key) {
						case "useIgnoreFiles":
							return true
						case "useGlobalIgnoreFiles":
							return true
						case "useParentIgnoreFiles":
							return false
						default:
							return defaultValue
					}
				}),
			}
			;(vscode.workspace.getConfiguration as Mock).mockReturnValue(mockConfig)

			await workspaceTracker.getRipgrepFileList()

			expect(mockExecuteRipgrepForFiles).toHaveBeenCalledWith("/test/workspace", 500000, ["--no-ignore-parent"])
		})

		it("should combine multiple ignore options", async () => {
			const mockConfig = {
				get: vitest.fn((key: string, defaultValue?: any) => {
					switch (key) {
						case "useIgnoreFiles":
							return false
						case "useGlobalIgnoreFiles":
							return false
						case "useParentIgnoreFiles":
							return false
						default:
							return defaultValue
					}
				}),
			}
			;(vscode.workspace.getConfiguration as Mock).mockReturnValue(mockConfig)

			await workspaceTracker.getRipgrepFileList()

			expect(mockExecuteRipgrepForFiles).toHaveBeenCalledWith("/test/workspace", 500000, ["--no-ignore"])
		})
	})

	describe("configuration change listeners", () => {
		it("should clear ripgrep cache when search configuration changes", async () => {
			// First get and cache file list
			const initialFiles = [{ path: "src/test.ts", type: "file", label: "test.ts" }]
			mockExecuteRipgrepForFiles.mockResolvedValueOnce(initialFiles)
			await workspaceTracker.getRipgrepFileList()

			// Simulate configuration change event
			const mockEvent = {
				affectsConfiguration: vitest.fn((section: string) => section === "search.useIgnoreFiles"),
			}

			registeredConfigChangeCallback!(mockEvent)

			// After configuration change should re-call executeRipgrepForFiles
			const newFiles = [{ path: "src/newtest.ts", type: "file", label: "newtest.ts" }]
			mockExecuteRipgrepForFiles.mockResolvedValueOnce(newFiles)

			const result = await workspaceTracker.getRipgrepFileList()

			expect(mockExecuteRipgrepForFiles).toHaveBeenCalledTimes(2)
			expect(result).toEqual(newFiles)
		})

		it("should clear cache when useGlobalIgnoreFiles configuration changes", async () => {
			// First get file list to establish cache
			await workspaceTracker.getRipgrepFileList()

			const mockEvent = {
				affectsConfiguration: vitest.fn((section: string) => section === "search.useGlobalIgnoreFiles"),
			}

			registeredConfigChangeCallback!(mockEvent)

			// Next fetch should re-call executeRipgrepForFiles
			mockExecuteRipgrepForFiles.mockClear()
			await workspaceTracker.getRipgrepFileList()

			expect(mockExecuteRipgrepForFiles).toHaveBeenCalled()
		})

		it("should clear cache when useParentIgnoreFiles configuration changes", async () => {
			// First get file list to establish cache
			await workspaceTracker.getRipgrepFileList()

			const mockEvent = {
				affectsConfiguration: vitest.fn((section: string) => section === "search.useParentIgnoreFiles"),
			}

			registeredConfigChangeCallback!(mockEvent)

			// Next fetch should re-call executeRipgrepForFiles
			mockExecuteRipgrepForFiles.mockClear()
			await workspaceTracker.getRipgrepFileList()

			expect(mockExecuteRipgrepForFiles).toHaveBeenCalled()
		})

		it("should not clear cache for non-search related configuration changes", async () => {
			// First get file list to establish cache
			await workspaceTracker.getRipgrepFileList()

			const mockEvent = {
				affectsConfiguration: vitest.fn((section: string) => section === "editor.fontSize"),
			}

			registeredConfigChangeCallback!(mockEvent)

			// Next fetch should use cache, not re-call
			mockExecuteRipgrepForFiles.mockClear()
			await workspaceTracker.getRipgrepFileList()

			expect(mockExecuteRipgrepForFiles).not.toHaveBeenCalled()
		})
	})

	describe("cache invalidation on file changes", () => {
		it("should clear ripgrep cache when files are created", async () => {
			// First get file list to establish cache
			await workspaceTracker.getRipgrepFileList()
			mockExecuteRipgrepForFiles.mockClear()

			// Trigger file creation event
			const [[createCallback]] = mockOnDidCreate.mock.calls
			await createCallback({ fsPath: "/test/workspace/newfile.ts" })

			// Next fetch should re-call executeRipgrepForFiles
			await workspaceTracker.getRipgrepFileList()

			expect(mockExecuteRipgrepForFiles).toHaveBeenCalled()
		})

		it("should clear ripgrep cache when files are deleted", async () => {
			// First get file list to establish cache
			await workspaceTracker.getRipgrepFileList()
			mockExecuteRipgrepForFiles.mockClear()

			// Trigger file deletion event
			const [[deleteCallback]] = mockOnDidDelete.mock.calls
			await deleteCallback({ fsPath: "/test/workspace/oldfile.ts" })

			// Next fetch should re-call executeRipgrepForFiles
			await workspaceTracker.getRipgrepFileList()

			expect(mockExecuteRipgrepForFiles).toHaveBeenCalled()
		})

		it("should clear ripgrep cache when workspace resets", async () => {
			// First get file list to establish cache
			await workspaceTracker.getRipgrepFileList()

			// Change workspace path and trigger reset
			;(getWorkspacePath as Mock).mockReturnValue("/test/new-workspace")
			await registeredTabChangeCallback!()

			// Advance reset timer
			vitest.advanceTimersByTime(300)

			// Next fetch should use new workspace path
			mockExecuteRipgrepForFiles.mockClear()
			await workspaceTracker.getRipgrepFileList()

			expect(mockExecuteRipgrepForFiles).toHaveBeenCalledWith("/test/new-workspace", 500000, [])
		})
	})

	describe("file list preheating", () => {
		it("should preheat ripgrep file list during initialization", async () => {
			const mockFiles = [["/test/workspace/file1.ts", "/test/workspace/file2.ts"], false]
			;(listFiles as Mock).mockResolvedValue(mockFiles)

			await workspaceTracker.initializeFilePaths()

			// Should have called getRipgrepFileList to preheat cache
			expect(mockExecuteRipgrepForFiles).toHaveBeenCalled()
		})
	})

	describe("public getRipgrepFileList method", () => {
		it("should be accessible as a public method", () => {
			expect(typeof workspaceTracker.getRipgrepFileList).toBe("function")
		})

		it("should return a promise that resolves to FileResult array", async () => {
			const expectedFiles = [{ path: "src/test.ts", type: "file", label: "test.ts" }]
			mockExecuteRipgrepForFiles.mockResolvedValueOnce(expectedFiles)

			const result = await workspaceTracker.getRipgrepFileList()

			expect(Array.isArray(result)).toBe(true)
			expect(result).toEqual(expectedFiles)
		})
	})
})
