import type { Mock } from "vitest"
import * as vscode from "vscode"
import WorkspaceTracker from "../WorkspaceTracker"
import { ClineProvider } from "../../../core/webview/ClineProvider"
import { listFiles } from "../../../services/glob/list-files"
import { getWorkspacePath } from "../../../utils/path"
import { RipgrepResultCache } from "../RipgrepResultCache"

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

// Mock ignore utils
vitest.mock("../../../services/glob/ignore-utils", () => ({
	isPathInIgnoredDirectory: vitest.fn().mockReturnValue(false),
}))

// Mock RipgrepResultCache
vitest.mock("../RipgrepResultCache", () => ({
	RipgrepResultCache: vitest.fn().mockImplementation(() => ({
		getTree: vitest.fn().mockResolvedValue({}),
		fileAdded: vitest.fn(),
		fileRemoved: vitest.fn(),
		targetPath: "/test/workspace",
	})),
}))

// Mock ripgrep getBinPath
vitest.mock("../../../services/ripgrep", () => ({
	getBinPath: vitest.fn().mockResolvedValue("/usr/local/bin/rg"),
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
	env: {
		appRoot: "/test/vscode",
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

	beforeEach(() => {
		vitest.clearAllMocks()
		vitest.useFakeTimers()

		// Reset all mock implementations
		registeredTabChangeCallback = null
		registeredConfigChangeCallback = null

		// Reset workspace path mock
		;(getWorkspacePath as Mock).mockReturnValue("/test/workspace")

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
					case "maximumIndexedFilesForFileSearch":
						return 200000
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

	describe("RipgrepCache integration", () => {
		let mockRipgrepCache: any
		let createCallback: any
		let deleteCallback: any

		beforeEach(async () => {
			// Setup mock before creating WorkspaceTracker
			mockRipgrepCache = {
				getTree: vitest.fn().mockResolvedValue({}),
				fileAdded: vitest.fn(),
				fileRemoved: vitest.fn(),
				targetPath: "/test/workspace",
				isMock: true,
			}
			;(RipgrepResultCache as Mock).mockImplementation(() => mockRipgrepCache)

			// Get the callbacks before clearing mocks
			createCallback = mockOnDidCreate.mock.calls[0][0]
			deleteCallback = mockOnDidDelete.mock.calls[0][0]
		})

		it("should provide getRipgrepFileTree method", () => {
			expect(typeof workspaceTracker.getRipgrepFileTree).toBe("function")
		})

		it("should return empty tree when no workspace path", async () => {
			;(getWorkspacePath as Mock).mockReturnValue(undefined)

			const result = await workspaceTracker.getRipgrepFileTree()

			expect(result).toEqual({})
		})

		it("should notify ripgrep cache when non-ignored file is added", async () => {
			const testPath = "/test/workspace/src/file.ts"

			;(workspaceTracker as any).ripgrepCache = mockRipgrepCache

			await createCallback({ fsPath: testPath })

			// Verify the cache method was called
			expect(mockRipgrepCache.fileAdded).toHaveBeenCalledWith(testPath)
		})

		it("should not notify ripgrep cache when ignored file is added", async () => {
			const testPath = "/test/workspace/node_modules/file.ts"

			;(workspaceTracker as any).ripgrepCache = mockRipgrepCache

			await createCallback({ fsPath: testPath })

			// Since the file is ignored, fileAdded should not be called
			expect(mockRipgrepCache.fileAdded).not.toHaveBeenCalled()
		})

		it("should notify ripgrep cache when non-ignored file is deleted", async () => {
			const testPath = "/test/workspace/src/file.ts"

			;(workspaceTracker as any).ripgrepCache = mockRipgrepCache

			await deleteCallback({ fsPath: testPath })

			// Verify the cache method was called
			expect(mockRipgrepCache.fileRemoved).toHaveBeenCalledWith(testPath)
		})

		it("should not notify ripgrep cache when ignored file is deleted", async () => {
			const testPath = "/test/workspace/node_modules/file.ts"

			;(workspaceTracker as any).ripgrepCache = mockRipgrepCache

			await deleteCallback({ fsPath: testPath })

			// Since the file is ignored, fileRemoved should not be called
			expect(mockRipgrepCache.fileRemoved).not.toHaveBeenCalled()
		})
	})

	describe("VSCode configuration support", () => {
		beforeEach(async () => {
			// Setup mock before creating WorkspaceTracker
			const mockRipgrepCache = {
				getTree: vitest.fn().mockResolvedValue({}),
				fileAdded: vitest.fn(),
				fileRemoved: vitest.fn(),
				targetPath: "/test/workspace",
			}
			;(RipgrepResultCache as Mock).mockImplementation(() => mockRipgrepCache)
		})

		it("should generate correct ripgrep options based on useIgnoreFiles config", async () => {
			const mockConfig = {
				get: vitest.fn((key: string, defaultValue?: any) => {
					if (key === "useIgnoreFiles") return false
					return defaultValue ?? true
				}),
			}
			;(vscode.workspace.getConfiguration as Mock).mockReturnValue(mockConfig)

			let args = await (workspaceTracker as any).getRipgrepArgs()

			expect(args.includes("--no-ignore")).toBe(true)
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

			let args = await (workspaceTracker as any).getRipgrepArgs()

			expect(args.includes("--no-ignore-global")).toBe(true)
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

			let args = await (workspaceTracker as any).getRipgrepArgs()

			expect(args.includes("--no-ignore-parent")).toBe(true)
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

			let args = await (workspaceTracker as any).getRipgrepArgs()

			expect(args.includes("--no-ignore")).toBe(true)
		})

		it("should clear ripgrep cache when roo-cline configuration changes", async () => {
			// Initialize cache by calling getRipgrepFileTree to trigger cache creation
			await workspaceTracker.getRipgrepFileTree()
			expect(RipgrepResultCache).toHaveBeenCalledTimes(1)

			// Simulate configuration change event for roo-cline config
			const mockEvent = {
				affectsConfiguration: vitest.fn(
					(section: string) => section === "roo-cline.maximumIndexedFilesForFileSearch",
				),
			}

			// This should trigger cache clearing
			registeredConfigChangeCallback!(mockEvent)

			// Verify all related configurations were checked
			expect(mockEvent.affectsConfiguration).toHaveBeenCalledWith("search.useIgnoreFiles")
			expect(mockEvent.affectsConfiguration).toHaveBeenCalledWith("search.useGlobalIgnoreFiles")
			expect(mockEvent.affectsConfiguration).toHaveBeenCalledWith("search.useParentIgnoreFiles")
			expect(mockEvent.affectsConfiguration).toHaveBeenCalledWith("roo-cline.maximumIndexedFilesForFileSearch")

			// Call getRipgrepFileTree again to trigger new cache creation
			await workspaceTracker.getRipgrepFileTree()
			expect(RipgrepResultCache).toHaveBeenCalledTimes(2)
		})

		it("should clear ripgrep cache when search configuration changes", async () => {
			// Initialize cache by calling getRipgrepFileTree to trigger cache creation
			await workspaceTracker.getRipgrepFileTree()
			expect(RipgrepResultCache).toHaveBeenCalledTimes(1)

			// Simulate configuration change event for search config
			// Note: the OR condition will short-circuit on the first true result
			const mockEvent = {
				affectsConfiguration: vitest.fn((section: string) => section === "search.useIgnoreFiles"),
			}

			// This should trigger cache clearing
			registeredConfigChangeCallback!(mockEvent)

			// Since OR conditions short-circuit, only the first matching config is checked
			expect(mockEvent.affectsConfiguration).toHaveBeenCalledWith("search.useIgnoreFiles")
			// The following calls won't happen due to short-circuit evaluation
			// expect(mockEvent.affectsConfiguration).toHaveBeenCalledWith("search.useGlobalIgnoreFiles")
			// expect(mockEvent.affectsConfiguration).toHaveBeenCalledWith("search.useParentIgnoreFiles")
			// expect(mockEvent.affectsConfiguration).toHaveBeenCalledWith("roo-cline.maximumIndexedFilesForFileSearch")

			// Call getRipgrepFileTree again to trigger new cache creation
			await workspaceTracker.getRipgrepFileTree()
			expect(RipgrepResultCache).toHaveBeenCalledTimes(2)
		})

		it("should not clear cache for non-search related configuration changes", async () => {
			// Initialize cache by calling getRipgrepFileTree to trigger cache creation
			await workspaceTracker.getRipgrepFileTree()
			expect(RipgrepResultCache).toHaveBeenCalledTimes(1)

			// Simulate configuration change event for non-search config
			const mockEvent = {
				affectsConfiguration: vitest.fn((section: string) => section === "editor.fontSize"),
			}

			// This should not trigger cache clearing
			registeredConfigChangeCallback!(mockEvent)

			// All related configurations should be checked since none match
			expect(mockEvent.affectsConfiguration).toHaveBeenCalledWith("search.useIgnoreFiles")
			expect(mockEvent.affectsConfiguration).toHaveBeenCalledWith("search.useGlobalIgnoreFiles")
			expect(mockEvent.affectsConfiguration).toHaveBeenCalledWith("search.useParentIgnoreFiles")
			expect(mockEvent.affectsConfiguration).toHaveBeenCalledWith("roo-cline.maximumIndexedFilesForFileSearch")

			// Call getRipgrepFileTree again - should not create new cache
			await workspaceTracker.getRipgrepFileTree()
			expect(RipgrepResultCache).toHaveBeenCalledTimes(1) // No additional calls
		})

		it("should handle configuration change during ripgrep tree building", async () => {
			let triggersConfigChange = true

			const mockDelayedRipgrepCache = {
				getTree: vitest.fn().mockImplementation(() => {
					if (triggersConfigChange) {
						// Trigger configuration change while ripgrep is building
						const mockEvent = {
							affectsConfiguration: vitest.fn((section: string) => section === "search.useIgnoreFiles"),
						}
						registeredConfigChangeCallback!(mockEvent)
					}
					return { src: { "file1.ts": true } }
				}),
				fileAdded: vitest.fn(),
				fileRemoved: vitest.fn(),
				targetPath: "/test/workspace",
			}
			;(RipgrepResultCache as Mock).mockImplementation(() => mockDelayedRipgrepCache)

			// Start getRipgrepFileTree (this will hang until we resolve it)
			const result = await workspaceTracker.getRipgrepFileTree()

			// Should return the result from the ongoing build
			expect(result).toEqual({ src: { "file1.ts": true } })
			expect(RipgrepResultCache).toHaveBeenCalledTimes(1)

			// Next call should create a new cache because config changed
			await workspaceTracker.getRipgrepFileTree()
			expect(RipgrepResultCache).toHaveBeenCalledTimes(2)
		})

		it("should create new cache after configuration change even if old cache exists", async () => {
			// Initialize first cache
			await workspaceTracker.getRipgrepFileTree()
			expect(RipgrepResultCache).toHaveBeenCalledTimes(1)

			// Simulate configuration change
			const mockEvent = {
				affectsConfiguration: vitest.fn(
					(section: string) => section === "roo-cline.maximumIndexedFilesForFileSearch",
				),
			}
			registeredConfigChangeCallback!(mockEvent)

			// Verify cache was cleared (access private property for testing)
			expect((workspaceTracker as any).ripgrepCache).toBeNull()

			// Next call should create new cache
			await workspaceTracker.getRipgrepFileTree()
			expect(RipgrepResultCache).toHaveBeenCalledTimes(2)
		})
	})

	describe("isPathIgnoredByRipgrep", () => {
		beforeEach(() => {
			// Reset mocks for clean test state
			vitest.clearAllMocks()
			mockProvider = {
				postMessageToWebview: vitest.fn().mockResolvedValue(undefined),
			} as unknown as ClineProvider & { postMessageToWebview: Mock }
			workspaceTracker = new WorkspaceTracker(mockProvider)
		})

		it("should ignore node_modules directory", async () => {
			const testPaths = [
				"/test/workspace/node_modules/package/file.js",
				"/test/workspace/src/node_modules/file.ts",
				"/test/workspace/deep/nested/node_modules/lib/index.js",
			]

			for (const path of testPaths) {
				const isIgnored = (workspaceTracker as any).isPathIgnoredByRipgrep(path)
				expect(isIgnored).toBe(true)
			}
		})

		it("should ignore .git directory", async () => {
			const testPaths = [
				"/test/workspace/.git/config",
				"/test/workspace/subproject/.git/hooks/pre-commit",
				"/test/workspace/nested/.git/objects/abc123",
			]

			for (const path of testPaths) {
				const isIgnored = (workspaceTracker as any).isPathIgnoredByRipgrep(path)
				expect(isIgnored).toBe(true)
			}
		})

		it("should ignore out and dist directories", async () => {
			const testPaths = [
				"/test/workspace/out/main.js",
				"/test/workspace/dist/bundle.js",
				"/test/workspace/packages/lib/out/index.js",
				"/test/workspace/apps/web/dist/assets/main.css",
			]

			for (const path of testPaths) {
				const isIgnored = (workspaceTracker as any).isPathIgnoredByRipgrep(path)
				expect(isIgnored).toBe(true)
			}
		})

		it("should not ignore files with ignored directory names in filename", async () => {
			const testPaths = [
				"/test/workspace/src/node_modules.ts", // file named node_modules
				"/test/workspace/git_utils.js", // file containing git
				"/test/workspace/output.txt", // file containing out
				"/test/workspace/distant.js", // file containing dist
			]

			for (const path of testPaths) {
				const isIgnored = (workspaceTracker as any).isPathIgnoredByRipgrep(path)
				expect(isIgnored).toBe(false)
			}
		})

		it("should handle Windows-style paths correctly", async () => {
			const testPaths = [
				"C:\\test\\workspace\\node_modules\\package\\file.js",
				"C:\\test\\workspace\\src\\.git\\config",
				"C:\\test\\workspace\\out\\main.js",
			]

			for (const path of testPaths) {
				const isIgnored = (workspaceTracker as any).isPathIgnoredByRipgrep(path)
				expect(isIgnored).toBe(true)
			}
		})

		it("should not ignore legitimate paths", async () => {
			const testPaths = [
				"/test/workspace/src/components/Button.tsx",
				"/test/workspace/lib/utils/helper.ts",
				"/test/workspace/docs/README.md",
				"/test/workspace/tests/unit/parser.spec.ts",
				"/test/workspace/scripts/build.sh",
			]

			for (const path of testPaths) {
				const isIgnored = (workspaceTracker as any).isPathIgnoredByRipgrep(path)
				expect(isIgnored).toBe(false)
			}
		})

		it("should handle edge cases correctly", async () => {
			const testCases = [
				{ path: "/test/workspace/node_modules", expected: false }, // directory itself, not inside
				{ path: "/test/workspace/.git", expected: false }, // directory itself, not inside
				{ path: "/test/workspace/", expected: false }, // root workspace
				{ path: "", expected: false }, // empty path
				{ path: "/test/workspace/node_modules/", expected: true }, // with trailing slash
				{ path: "/test/workspace/.git/", expected: true }, // with trailing slash
			]

			for (const testCase of testCases) {
				const isIgnored = (workspaceTracker as any).isPathIgnoredByRipgrep(testCase.path)
				expect(isIgnored).toBe(testCase.expected)
			}
		})
	})
})
