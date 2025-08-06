// npx vitest services/code-index/processors/__tests__/file-watcher-rooignore.spec.ts

import * as vscode from "vscode"
import { FileWatcher } from "../file-watcher"
import { RooIgnoreController } from "../../../../core/ignore/RooIgnoreController"
import { CacheManager } from "../../cache-manager"
import ignore from "ignore"

// Mock TelemetryService
vi.mock("../../../../../packages/telemetry/src/TelemetryService", () => ({
	TelemetryService: {
		instance: {
			captureEvent: vi.fn(),
		},
	},
}))

// Mock dependencies
vi.mock("../../cache-manager")
vi.mock("../../../../core/ignore/RooIgnoreController", () => ({
	RooIgnoreController: vi.fn(),
}))
vi.mock("ignore")
vi.mock("../parser", () => ({
	codeParser: {
		parseFile: vi.fn().mockResolvedValue([
			{
				content: "test content",
				file_path: "/mock/workspace/test.json",
				start_line: 1,
				end_line: 10,
				segmentHash: "test-hash",
			},
		]),
	},
}))
vi.mock("../../../glob/ignore-utils", () => ({
	isPathInIgnoredDirectory: vi.fn().mockReturnValue(false),
}))

// Mock vscode module
vi.mock("vscode", () => ({
	workspace: {
		createFileSystemWatcher: vi.fn(),
		workspaceFolders: [
			{
				uri: {
					fsPath: "/mock/workspace",
				},
			},
		],
		fs: {
			stat: vi.fn().mockResolvedValue({ size: 1000 }),
			readFile: vi.fn().mockResolvedValue(Buffer.from('{"test": "content"}')),
		},
	},
	RelativePattern: vi.fn().mockImplementation((base, pattern) => ({ base, pattern })),
	Uri: {
		file: vi.fn().mockImplementation((path) => ({ fsPath: path })),
	},
	EventEmitter: vi.fn().mockImplementation(() => ({
		event: vi.fn(),
		fire: vi.fn(),
		dispose: vi.fn(),
	})),
	ExtensionContext: vi.fn(),
}))

describe("FileWatcher - RooIgnore Integration", () => {
	let fileWatcher: FileWatcher
	let mockWatcher: any
	let mockOnDidCreate: any
	let mockOnDidChange: any
	let mockContext: any
	let mockCacheManager: any
	let mockEmbedder: any
	let mockVectorStore: any
	let mockIgnoreInstance: any
	let mockRooIgnoreController: any

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()

		// Create mock event handlers
		mockOnDidCreate = vi.fn()
		mockOnDidChange = vi.fn()

		// Create mock watcher
		mockWatcher = {
			onDidCreate: vi.fn().mockImplementation((handler) => {
				mockOnDidCreate = handler
				return { dispose: vi.fn() }
			}),
			onDidChange: vi.fn().mockImplementation((handler) => {
				mockOnDidChange = handler
				return { dispose: vi.fn() }
			}),
			onDidDelete: vi.fn().mockImplementation(() => ({ dispose: vi.fn() })),
			dispose: vi.fn(),
		}

		// Mock createFileSystemWatcher to return our mock watcher
		vi.mocked(vscode.workspace.createFileSystemWatcher).mockReturnValue(mockWatcher)

		// Create mock dependencies
		mockContext = {
			subscriptions: [],
		}

		mockCacheManager = {
			getHash: vi.fn().mockReturnValue(null), // File is new
			updateHash: vi.fn(),
			deleteHash: vi.fn(),
		}

		mockEmbedder = {
			createEmbeddings: vi.fn().mockResolvedValue({ embeddings: [[0.1, 0.2, 0.3]] }),
		}

		mockVectorStore = {
			upsertPoints: vi.fn().mockResolvedValue(undefined),
			deletePointsByFilePath: vi.fn().mockResolvedValue(undefined),
			deletePointsByMultipleFilePaths: vi.fn().mockResolvedValue(undefined),
		}

		mockIgnoreInstance = {
			ignores: vi.fn().mockReturnValue(false),
		}

		// Create mock RooIgnoreController
		mockRooIgnoreController = {
			validateAccess: vi.fn(),
			initialize: vi.fn().mockResolvedValue(undefined),
			filterPaths: vi.fn().mockImplementation((paths) => paths),
		}
		vi.mocked(RooIgnoreController).mockImplementation(() => mockRooIgnoreController)
	})

	describe("JSON file handling with .rooignore", () => {
		it("should respect .rooignore for JSON files during file creation", async () => {
			// Setup RooIgnoreController to block JSON files in a specific folder
			mockRooIgnoreController.validateAccess.mockImplementation((path: string) => {
				// Block files in 'ignored-folder'
				return !path.includes("ignored-folder")
			})

			fileWatcher = new FileWatcher(
				"/mock/workspace",
				mockContext,
				mockCacheManager,
				mockEmbedder,
				mockVectorStore,
				mockIgnoreInstance,
				mockRooIgnoreController,
			)

			// Initialize the file watcher
			await fileWatcher.initialize()

			// Track which files are processed
			const processedFiles: string[] = []
			mockVectorStore.upsertPoints.mockImplementation(async (points: any[]) => {
				points.forEach((point) => {
					if (point.payload?.filePath) {
						processedFiles.push(point.payload.filePath)
					}
				})
			})

			// Simulate file creation events
			const testCases = [
				{ path: "/mock/workspace/config.json", shouldProcess: true },
				{ path: "/mock/workspace/ignored-folder/settings.json", shouldProcess: false },
				{ path: "/mock/workspace/src/data.json", shouldProcess: true },
				{ path: "/mock/workspace/ignored-folder/nested/data.json", shouldProcess: false },
			]

			// Trigger file creation events
			for (const { path } of testCases) {
				await mockOnDidCreate({ fsPath: path })
			}

			// Wait for batch processing
			await new Promise((resolve) => setTimeout(resolve, 600))

			// Verify RooIgnoreController was called for each file
			expect(mockRooIgnoreController.validateAccess).toHaveBeenCalledWith("/mock/workspace/config.json")
			expect(mockRooIgnoreController.validateAccess).toHaveBeenCalledWith(
				"/mock/workspace/ignored-folder/settings.json",
			)
			expect(mockRooIgnoreController.validateAccess).toHaveBeenCalledWith("/mock/workspace/src/data.json")
			expect(mockRooIgnoreController.validateAccess).toHaveBeenCalledWith(
				"/mock/workspace/ignored-folder/nested/data.json",
			)

			// Check that ignored JSON files were not processed
			expect(processedFiles).toContain("config.json")
			expect(processedFiles).toContain("src/data.json")
			expect(processedFiles).not.toContain("ignored-folder/settings.json")
			expect(processedFiles).not.toContain("ignored-folder/nested/data.json")
		})

		it("should respect .rooignore for JSON files during file changes", async () => {
			// Setup RooIgnoreController to block specific JSON files
			mockRooIgnoreController.validateAccess.mockImplementation((path: string) => {
				// Block files matching pattern
				return !path.includes("secrets") && !path.includes("private")
			})

			fileWatcher = new FileWatcher(
				"/mock/workspace",
				mockContext,
				mockCacheManager,
				mockEmbedder,
				mockVectorStore,
				mockIgnoreInstance,
				mockRooIgnoreController,
			)

			// Initialize the file watcher
			await fileWatcher.initialize()

			// Track which files are processed
			const processedFiles: string[] = []
			mockVectorStore.upsertPoints.mockImplementation(async (points: any[]) => {
				points.forEach((point) => {
					if (point.payload?.filePath) {
						processedFiles.push(point.payload.filePath)
					}
				})
			})

			// Simulate file change events
			const testCases = [
				{ path: "/mock/workspace/public-config.json", shouldProcess: true },
				{ path: "/mock/workspace/secrets.json", shouldProcess: false },
				{ path: "/mock/workspace/data/private-keys.json", shouldProcess: false },
				{ path: "/mock/workspace/app-settings.json", shouldProcess: true },
			]

			// Trigger file change events
			for (const { path } of testCases) {
				await mockOnDidChange({ fsPath: path })
			}

			// Wait for batch processing
			await new Promise((resolve) => setTimeout(resolve, 600))

			// Verify RooIgnoreController was called for each file
			testCases.forEach(({ path }) => {
				expect(mockRooIgnoreController.validateAccess).toHaveBeenCalledWith(path)
			})

			// Check that ignored JSON files were not processed
			expect(processedFiles).toContain("public-config.json")
			expect(processedFiles).toContain("app-settings.json")
			expect(processedFiles).not.toContain("secrets.json")
			expect(processedFiles).not.toContain("data/private-keys.json")
		})

		it("should handle mixed file types with .rooignore correctly", async () => {
			// Setup RooIgnoreController to block all files in 'ignored' folder
			mockRooIgnoreController.validateAccess.mockImplementation((path: string) => {
				return !path.includes("/ignored/")
			})

			fileWatcher = new FileWatcher(
				"/mock/workspace",
				mockContext,
				mockCacheManager,
				mockEmbedder,
				mockVectorStore,
				mockIgnoreInstance,
				mockRooIgnoreController,
			)

			// Initialize the file watcher
			await fileWatcher.initialize()

			// Track processed files
			const processedFiles: string[] = []
			mockVectorStore.upsertPoints.mockImplementation(async (points: any[]) => {
				points.forEach((point) => {
					if (point.payload?.filePath) {
						processedFiles.push(point.payload.filePath)
					}
				})
			})

			// Simulate mixed file type events
			const testCases = [
				{ path: "/mock/workspace/src/app.ts", shouldProcess: true },
				{ path: "/mock/workspace/config.json", shouldProcess: true },
				{ path: "/mock/workspace/ignored/data.json", shouldProcess: false },
				{ path: "/mock/workspace/ignored/script.ts", shouldProcess: false },
				{ path: "/mock/workspace/README.md", shouldProcess: true },
			]

			// Trigger file creation events
			for (const { path } of testCases) {
				await mockOnDidCreate({ fsPath: path })
			}

			// Wait for batch processing
			await new Promise((resolve) => setTimeout(resolve, 600))

			// Verify all files were checked against RooIgnoreController
			testCases.forEach(({ path }) => {
				expect(mockRooIgnoreController.validateAccess).toHaveBeenCalledWith(path)
			})

			// Verify only non-ignored files were processed
			expect(processedFiles).toContain("src/app.ts")
			expect(processedFiles).toContain("config.json")
			expect(processedFiles).toContain("README.md")
			expect(processedFiles).not.toContain("ignored/data.json")
			expect(processedFiles).not.toContain("ignored/script.ts")
		})
	})
})
