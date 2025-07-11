// npx vitest services/code-index/processors/__tests__/file-watcher.spec.ts

import * as vscode from "vscode"

import { FileWatcher } from "../file-watcher"
import { TelemetryService } from "@roo-code/telemetry"
import { TelemetryEventName } from "@roo-code/types"

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
vi.mock("../../../core/ignore/RooIgnoreController")
vi.mock("ignore")
vi.mock("../parser", () => ({
	codeParser: {
		parseFile: vi.fn().mockResolvedValue([]),
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
			readFile: vi.fn().mockResolvedValue(Buffer.from("test content")),
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

describe("FileWatcher", () => {
	let fileWatcher: FileWatcher
	let mockWatcher: any
	let mockOnDidCreate: any
	let mockOnDidChange: any
	let mockOnDidDelete: any
	let mockContext: any
	let mockCacheManager: any
	let mockEmbedder: any
	let mockVectorStore: any
	let mockIgnoreInstance: any

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()

		// Create mock event handlers
		mockOnDidCreate = vi.fn()
		mockOnDidChange = vi.fn()
		mockOnDidDelete = vi.fn()

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
			onDidDelete: vi.fn().mockImplementation((handler) => {
				mockOnDidDelete = handler
				return { dispose: vi.fn() }
			}),
			dispose: vi.fn(),
		}

		// Mock createFileSystemWatcher to return our mock watcher
		vi.mocked(vscode.workspace.createFileSystemWatcher).mockReturnValue(mockWatcher)

		// Create mock dependencies
		mockContext = {
			subscriptions: [],
		}

		mockCacheManager = {
			getHash: vi.fn(),
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

		fileWatcher = new FileWatcher(
			"/mock/workspace",
			mockContext,
			mockCacheManager,
			mockEmbedder,
			mockVectorStore,
			mockIgnoreInstance,
		)
	})

	describe("file filtering", () => {
		it("should ignore files in hidden directories on create events", async () => {
			// Initialize the file watcher
			await fileWatcher.initialize()

			// Spy on the vector store to see which files are actually processed
			const processedFiles: string[] = []
			mockVectorStore.upsertPoints.mockImplementation(async (points: any[]) => {
				points.forEach((point) => {
					if (point.payload?.file_path) {
						processedFiles.push(point.payload.file_path)
					}
				})
			})

			// Simulate file creation events
			const testCases = [
				{ path: "/mock/workspace/src/file.ts", shouldProcess: true },
				{ path: "/mock/workspace/.git/config", shouldProcess: false },
				{ path: "/mock/workspace/.hidden/file.ts", shouldProcess: false },
				{ path: "/mock/workspace/src/.next/static/file.js", shouldProcess: false },
				{ path: "/mock/workspace/node_modules/package/index.js", shouldProcess: false },
				{ path: "/mock/workspace/normal/file.js", shouldProcess: true },
			]

			// Trigger file creation events
			for (const { path } of testCases) {
				await mockOnDidCreate({ fsPath: path })
			}

			// Wait for batch processing
			await new Promise((resolve) => setTimeout(resolve, 600))

			// Check that files in hidden directories were not processed
			expect(processedFiles).not.toContain("src/.next/static/file.js")
			expect(processedFiles).not.toContain(".git/config")
			expect(processedFiles).not.toContain(".hidden/file.ts")
		})

		it("should ignore files in hidden directories on change events", async () => {
			// Initialize the file watcher
			await fileWatcher.initialize()

			// Track which files are processed
			const processedFiles: string[] = []
			mockVectorStore.upsertPoints.mockImplementation(async (points: any[]) => {
				points.forEach((point) => {
					if (point.payload?.file_path) {
						processedFiles.push(point.payload.file_path)
					}
				})
			})

			// Simulate file change events
			const testCases = [
				{ path: "/mock/workspace/src/file.ts", shouldProcess: true },
				{ path: "/mock/workspace/.vscode/settings.json", shouldProcess: false },
				{ path: "/mock/workspace/src/.cache/data.json", shouldProcess: false },
				{ path: "/mock/workspace/dist/bundle.js", shouldProcess: false },
			]

			// Trigger file change events
			for (const { path } of testCases) {
				await mockOnDidChange({ fsPath: path })
			}

			// Wait for batch processing
			await new Promise((resolve) => setTimeout(resolve, 600))

			// Check that files in hidden directories were not processed
			expect(processedFiles).not.toContain(".vscode/settings.json")
			expect(processedFiles).not.toContain("src/.cache/data.json")
		})

		it("should ignore files in hidden directories on delete events", async () => {
			// Initialize the file watcher
			await fileWatcher.initialize()

			// Track which files are deleted
			const deletedFiles: string[] = []
			mockVectorStore.deletePointsByFilePath.mockImplementation(async (filePath: string) => {
				deletedFiles.push(filePath)
			})

			// Simulate file deletion events
			const testCases = [
				{ path: "/mock/workspace/src/file.ts", shouldProcess: true },
				{ path: "/mock/workspace/.git/objects/abc123", shouldProcess: false },
				{ path: "/mock/workspace/.DS_Store", shouldProcess: false },
				{ path: "/mock/workspace/build/.cache/temp.js", shouldProcess: false },
			]

			// Trigger file deletion events
			for (const { path } of testCases) {
				await mockOnDidDelete({ fsPath: path })
			}

			// Wait for batch processing
			await new Promise((resolve) => setTimeout(resolve, 600))

			// Check that files in hidden directories were not processed
			expect(deletedFiles).not.toContain(".git/objects/abc123")
			expect(deletedFiles).not.toContain(".DS_Store")
			expect(deletedFiles).not.toContain("build/.cache/temp.js")
		})

		it("should handle nested hidden directories correctly", async () => {
			// Initialize the file watcher
			await fileWatcher.initialize()

			// Track which files are processed
			const processedFiles: string[] = []
			mockVectorStore.upsertPoints.mockImplementation(async (points: any[]) => {
				points.forEach((point) => {
					if (point.payload?.file_path) {
						processedFiles.push(point.payload.file_path)
					}
				})
			})

			// Test deeply nested hidden directories
			const testCases = [
				{ path: "/mock/workspace/src/components/Button.tsx", shouldProcess: true },
				{ path: "/mock/workspace/src/.hidden/components/Button.tsx", shouldProcess: false },
				{ path: "/mock/workspace/.hidden/src/components/Button.tsx", shouldProcess: false },
				{ path: "/mock/workspace/src/components/.hidden/Button.tsx", shouldProcess: false },
			]

			// Trigger file creation events
			for (const { path } of testCases) {
				await mockOnDidCreate({ fsPath: path })
			}

			// Wait for batch processing
			await new Promise((resolve) => setTimeout(resolve, 600))

			// Check that files in hidden directories were not processed
			expect(processedFiles).not.toContain("src/.hidden/components/Button.tsx")
			expect(processedFiles).not.toContain(".hidden/src/components/Button.tsx")
			expect(processedFiles).not.toContain("src/components/.hidden/Button.tsx")
		})
	})

	describe("dispose", () => {
		it("should dispose of the watcher when disposed", async () => {
			await fileWatcher.initialize()
			fileWatcher.dispose()

			expect(mockWatcher.dispose).toHaveBeenCalled()
		})
	})

	describe("error aggregation", () => {
		beforeEach(() => {
			// Reset telemetry mock
			vi.mocked(TelemetryService.instance.captureEvent).mockClear()
		})

		it("should aggregate file processing errors and send a single telemetry event", async () => {
			// Initialize the file watcher
			await fileWatcher.initialize()

			// Mock processFile to throw errors for some files
			const processFileSpy = vi.spyOn(fileWatcher, "processFile")
			processFileSpy
				.mockRejectedValueOnce(new Error("File read error"))
				.mockRejectedValueOnce(new Error("Parse error"))
				.mockResolvedValueOnce({ path: "/mock/workspace/file3.ts", status: "skipped", reason: "Too large" })

			// Trigger file creation events
			await mockOnDidCreate({ fsPath: "/mock/workspace/file1.ts" })
			await mockOnDidCreate({ fsPath: "/mock/workspace/file2.ts" })
			await mockOnDidCreate({ fsPath: "/mock/workspace/file3.ts" })

			// Wait for batch processing
			await new Promise((resolve) => setTimeout(resolve, 600))

			// Verify that only one aggregated telemetry event was sent
			const telemetryCalls = vi.mocked(TelemetryService.instance.captureEvent).mock.calls
			const codeIndexErrorCalls = telemetryCalls.filter((call) => call[0] === TelemetryEventName.CODE_INDEX_ERROR)

			// Should have exactly one aggregated error event
			expect(codeIndexErrorCalls).toHaveLength(1)

			const aggregatedEvent = codeIndexErrorCalls[0][1]
			expect(aggregatedEvent).toMatchObject({
				error: expect.stringContaining("Batch processing completed with 2 errors"),
				errorCount: 2,
				errorTypes: expect.objectContaining({
					Error: 2,
				}),
				sampleErrors: expect.arrayContaining([
					expect.objectContaining({
						path: expect.any(String),
						error: expect.any(String),
						location: "_processFilesAndPrepareUpserts",
					}),
				]),
				location: "processBatch_aggregated",
			})
		})

		it("should not send telemetry event when no errors occur", async () => {
			// Initialize the file watcher
			await fileWatcher.initialize()

			// Mock processFile to succeed for all files
			const processFileSpy = vi.spyOn(fileWatcher, "processFile")
			processFileSpy.mockResolvedValue({
				path: "/mock/workspace/file.ts",
				status: "processed_for_batching",
				pointsToUpsert: [],
			})

			// Trigger file creation events
			await mockOnDidCreate({ fsPath: "/mock/workspace/file1.ts" })
			await mockOnDidCreate({ fsPath: "/mock/workspace/file2.ts" })

			// Wait for batch processing
			await new Promise((resolve) => setTimeout(resolve, 600))

			// Verify no telemetry events were sent
			const telemetryCalls = vi.mocked(TelemetryService.instance.captureEvent).mock.calls
			const codeIndexErrorCalls = telemetryCalls.filter((call) => call[0] === TelemetryEventName.CODE_INDEX_ERROR)

			expect(codeIndexErrorCalls).toHaveLength(0)
		})

		it("should include deletion errors in aggregated telemetry", async () => {
			// Initialize the file watcher
			await fileWatcher.initialize()

			// Mock vector store to fail on deletion
			mockVectorStore.deletePointsByMultipleFilePaths.mockRejectedValueOnce(
				new Error("Database connection error"),
			)

			// Trigger file deletion events
			await mockOnDidDelete({ fsPath: "/mock/workspace/file1.ts" })
			await mockOnDidDelete({ fsPath: "/mock/workspace/file2.ts" })

			// Wait for batch processing
			await new Promise((resolve) => setTimeout(resolve, 600))

			// Verify aggregated telemetry event includes deletion errors
			const telemetryCalls = vi.mocked(TelemetryService.instance.captureEvent).mock.calls
			const codeIndexErrorCalls = telemetryCalls.filter((call) => call[0] === TelemetryEventName.CODE_INDEX_ERROR)

			expect(codeIndexErrorCalls).toHaveLength(1)

			const aggregatedEvent = codeIndexErrorCalls[0][1]
			expect(aggregatedEvent).toMatchObject({
				error: expect.stringContaining("Batch processing completed with 2 errors"),
				errorCount: 2,
				sampleErrors: expect.arrayContaining([
					expect.objectContaining({
						location: "_handleBatchDeletions",
					}),
				]),
			})
		})

		it("should include upsert errors in aggregated telemetry", async () => {
			// Initialize the file watcher
			await fileWatcher.initialize()

			// Spy on processFile to make it return points for upserting
			const processFileSpy = vi.spyOn(fileWatcher, "processFile")
			processFileSpy.mockResolvedValue({
				path: "/mock/workspace/file.ts",
				status: "processed_for_batching",
				newHash: "abc123",
				pointsToUpsert: [
					{
						id: "test-id",
						vector: [0.1, 0.2, 0.3],
						payload: {
							filePath: "file.ts",
							codeChunk: "test code",
							startLine: 1,
							endLine: 10,
						},
					},
				],
			})

			// Mock vector store to fail on upsert
			mockVectorStore.upsertPoints.mockRejectedValue(new Error("Vector dimension mismatch"))

			// Trigger file creation event
			await mockOnDidCreate({ fsPath: "/mock/workspace/file.ts" })

			// Wait for batch processing
			await new Promise((resolve) => setTimeout(resolve, 700))

			// Verify aggregated telemetry event includes upsert errors
			const telemetryCalls = vi.mocked(TelemetryService.instance.captureEvent).mock.calls
			const codeIndexErrorCalls = telemetryCalls.filter((call) => call[0] === TelemetryEventName.CODE_INDEX_ERROR)

			expect(codeIndexErrorCalls).toHaveLength(1)

			const aggregatedEvent = codeIndexErrorCalls[0][1]
			expect(aggregatedEvent).toMatchObject({
				error: expect.stringContaining("Batch processing completed with 1 errors"),
				errorCount: 1,
				sampleErrors: expect.arrayContaining([
					expect.objectContaining({
						location: "_executeBatchUpsertOperations",
					}),
				]),
			})
		})

		it("should limit sample errors to 3 in telemetry", async () => {
			// Initialize the file watcher
			await fileWatcher.initialize()

			// Mock processFile to throw different errors
			const processFileSpy = vi.spyOn(fileWatcher, "processFile")
			for (let i = 0; i < 10; i++) {
				processFileSpy.mockRejectedValueOnce(new Error(`Error ${i + 1}`))
			}

			// Trigger many file creation events
			for (let i = 0; i < 10; i++) {
				await mockOnDidCreate({ fsPath: `/mock/workspace/file${i + 1}.ts` })
			}

			// Wait for batch processing
			await new Promise((resolve) => setTimeout(resolve, 600))

			// Verify telemetry event has limited sample errors
			const telemetryCalls = vi.mocked(TelemetryService.instance.captureEvent).mock.calls
			const codeIndexErrorCalls = telemetryCalls.filter((call) => call[0] === TelemetryEventName.CODE_INDEX_ERROR)

			expect(codeIndexErrorCalls).toHaveLength(1)

			const aggregatedEvent = codeIndexErrorCalls[0][1]
			expect(aggregatedEvent).toBeDefined()
			expect(aggregatedEvent!.errorCount).toBe(10)
			expect(aggregatedEvent!.sampleErrors).toHaveLength(3) // Limited to 3 samples
		})
	})
})
