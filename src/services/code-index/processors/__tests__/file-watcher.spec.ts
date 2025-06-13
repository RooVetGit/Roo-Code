import { IEmbedder } from "../../interfaces/embedder"
import { IVectorStore } from "../../interfaces/vector-store"
import { FileProcessingResult } from "../../interfaces/file-processor"
import { FileWatcher } from "../file-watcher"

import { createHash } from "crypto"

vi.mock("vscode", () => {
	type Disposable = { dispose: () => void }

	type _Event<T> = (listener: (e: T) => any, thisArgs?: any, disposables?: Disposable[]) => Disposable

	const MOCK_EMITTER_REGISTRY = new Map<object, Set<(data: any) => any>>()

	return {
		EventEmitter: vi.fn().mockImplementation(() => {
			const emitterInstanceKey = {}
			MOCK_EMITTER_REGISTRY.set(emitterInstanceKey, new Set())

			return {
				event: function <T>(listener: (e: T) => any): Disposable {
					const listeners = MOCK_EMITTER_REGISTRY.get(emitterInstanceKey)
					listeners!.add(listener as any)
					return {
						dispose: () => {
							listeners!.delete(listener as any)
						},
					}
				},

				fire: function <T>(data: T): void {
					const listeners = MOCK_EMITTER_REGISTRY.get(emitterInstanceKey)
					listeners!.forEach((fn) => fn(data))
				},

				dispose: () => {
					MOCK_EMITTER_REGISTRY.get(emitterInstanceKey)!.clear()
					MOCK_EMITTER_REGISTRY.delete(emitterInstanceKey)
				},
			}
		}),
		RelativePattern: vi.fn().mockImplementation((base, pattern) => ({
			base,
			pattern,
		})),
		Uri: {
			file: vi.fn().mockImplementation((path) => ({ fsPath: path })),
		},
		window: {
			activeTextEditor: undefined,
		},
		workspace: {
			createFileSystemWatcher: vi.fn().mockReturnValue({
				onDidCreate: vi.fn(),
				onDidChange: vi.fn(),
				onDidDelete: vi.fn(),
				dispose: vi.fn(),
			}),
			fs: {
				stat: vi.fn().mockResolvedValue({ size: 1024, mtime: Date.now() }),
				readFile: vi.fn().mockResolvedValue(Buffer.from("test content")),
			},
			workspaceFolders: [{ uri: { fsPath: "/mock/workspace" } }],
			getWorkspaceFolder: vi.fn((uri) => {
				if (uri && uri.fsPath && uri.fsPath.startsWith("/mock/workspace")) {
					return { uri: { fsPath: "/mock/workspace" } }
				}
				return undefined
			}),
		},
	}
})

import * as vscode from "vscode"

// Explicitly mock the vscode workspace methods
const mockWorkspace = vscode.workspace as any
const mockFsStat = vi.fn().mockResolvedValue({ size: 1024, mtime: Date.now() })
const mockFsReadFile = vi.fn().mockResolvedValue(Buffer.from("test content"))
const mockCreateFileSystemWatcher = vi.fn().mockReturnValue({
	onDidCreate: vi.fn(),
	onDidChange: vi.fn(),
	onDidDelete: vi.fn(),
	dispose: vi.fn(),
})

mockWorkspace.fs.stat = mockFsStat
mockWorkspace.fs.readFile = mockFsReadFile
mockWorkspace.createFileSystemWatcher = mockCreateFileSystemWatcher

vi.mock("crypto", () => ({
	createHash: vi.fn().mockReturnValue({
		update: vi.fn().mockReturnThis(),
		digest: vi.fn().mockReturnValue("mock-hash"),
	}),
}))
vi.mock("uuid", () => ({
	...vi.importActual("uuid"),
	v5: vi.fn().mockReturnValue("mocked-uuid-v5-for-testing"),
}))
vi.mock("../../../../core/ignore/RooIgnoreController", () => ({
	RooIgnoreController: vi.fn().mockImplementation(() => ({
		validateAccess: vi.fn(),
	})),
	mockValidateAccess: vi.fn(),
}))
vi.mock("../../cache-manager")
vi.mock("../parser", () => ({
	codeParser: { parseFile: vi.fn().mockResolvedValue([]) },
	default: { codeParser: { parseFile: vi.fn().mockResolvedValue([]) } },
}))
vi.mock("../../constants/index", () => ({
	INITIAL_RETRY_DELAY_MS: 500,
	MAX_BATCH_RETRIES: 3,
	MAX_FILE_SIZE_BYTES: 1024 * 1024, // 1MB
	BATCH_SEGMENT_THRESHOLD: 100,
	QDRANT_CODE_BLOCK_NAMESPACE: "test-namespace",
	default: {
		INITIAL_RETRY_DELAY_MS: 500,
		MAX_BATCH_RETRIES: 3,
		MAX_FILE_SIZE_BYTES: 1024 * 1024,
		BATCH_SEGMENT_THRESHOLD: 100,
		QDRANT_CODE_BLOCK_NAMESPACE: "test-namespace",
	},
}))
vi.mock("../../../utils/path", () => ({
	getWorkspacePath: vi.fn().mockReturnValue("/mock/workspace"),
}))

// Also mock the get-relative-path module to ensure it uses our mocked getWorkspacePath
vi.mock("../../shared/get-relative-path", async () => {
	const actual = await vi.importActual("../../shared/get-relative-path")
	return {
		...actual,
		generateRelativeFilePath: vi.fn((absolutePath: string) => {
			// Mock the relative path calculation
			const workspaceRoot = "/mock/workspace"
			if (absolutePath.startsWith(workspaceRoot)) {
				return absolutePath.substring(workspaceRoot.length + 1)
			}
			return absolutePath
		}),
	}
})

// Type the mocked functions for proper intellisense
const mockedVscode = vi.mocked(vscode, true)

describe("FileWatcher", () => {
	let fileWatcher: FileWatcher
	let mockEmbedder: IEmbedder
	let mockVectorStore: IVectorStore
	let mockCacheManager: any
	let mockContext: any
	let mockRooIgnoreController: any

	beforeEach(() => {
		mockEmbedder = {
			createEmbeddings: vi.fn().mockResolvedValue({ embeddings: [[0.1, 0.2, 0.3]] }),
			embedderInfo: { name: "openai" },
		}
		mockVectorStore = {
			upsertPoints: vi.fn().mockResolvedValue(undefined),
			deletePointsByFilePath: vi.fn().mockResolvedValue(undefined),
			deletePointsByMultipleFilePaths: vi.fn().mockResolvedValue(undefined),
			initialize: vi.fn().mockResolvedValue(true),
			search: vi.fn().mockResolvedValue([]),
			clearCollection: vi.fn().mockResolvedValue(undefined),
			deleteCollection: vi.fn().mockResolvedValue(undefined),
			collectionExists: vi.fn().mockResolvedValue(true),
		}
		mockCacheManager = {
			getHash: vi.fn(),
			updateHash: vi.fn(),
			deleteHash: vi.fn(),
		}
		mockContext = {
			subscriptions: [],
		}

		// Use the mocked module
		mockRooIgnoreController = {
			validateAccess: vi.fn().mockReturnValue(true),
		}

		fileWatcher = new FileWatcher(
			"/mock/workspace",
			mockContext,
			mockCacheManager,
			mockEmbedder,
			mockVectorStore,
			undefined,
			mockRooIgnoreController,
		)
	})

	describe("constructor", () => {
		it("should initialize with correct properties", () => {
			expect(fileWatcher).toBeDefined()

			mockContext.subscriptions.push({ dispose: vi.fn() }, { dispose: vi.fn() })
			expect(mockContext.subscriptions).toHaveLength(2)
		})
	})

	describe("initialize", () => {
		it("should create file watcher with correct pattern", async () => {
			await fileWatcher.initialize()
			expect(mockedVscode.workspace.createFileSystemWatcher).toHaveBeenCalled()
			const globPattern = vi.mocked(mockedVscode.workspace.createFileSystemWatcher).mock.calls[0][0]
			const patternStr = typeof globPattern === "string" ? globPattern : (globPattern as any).pattern
			expect(patternStr).toMatch(
				/\{tla,js,jsx,ts,vue,tsx,py,rs,go,c,h,cpp,hpp,cs,rb,java,php,swift,sol,kt,kts,ex,exs,el,html,htm,json,css,rdl,ml,mli,lua,scala,toml,zig,elm,ejs,erb\}/,
			)
		})

		it("should register event handlers", async () => {
			await fileWatcher.initialize()
			const watcher = vi.mocked(mockedVscode.workspace.createFileSystemWatcher).mock.results[0].value
			expect(watcher.onDidCreate).toHaveBeenCalled()
			expect(watcher.onDidChange).toHaveBeenCalled()
			expect(watcher.onDidDelete).toHaveBeenCalled()
		})
	})

	describe("dispose", () => {
		it("should dispose all resources", async () => {
			await fileWatcher.initialize()
			fileWatcher.dispose()
			const watcher = vi.mocked(mockedVscode.workspace.createFileSystemWatcher).mock.results[0].value
			expect(watcher.dispose).toHaveBeenCalled()
		})
	})

	describe("handleFileCreated", () => {
		beforeEach(() => {
			vi.useFakeTimers()
		})

		afterEach(() => {
			vi.useRealTimers()
		})

		it("should call processFile with correct path", async () => {
			const mockUri = { fsPath: "/mock/workspace/test.js" }
			const processFileSpy = vi.spyOn(fileWatcher, "processFile").mockResolvedValue({
				path: mockUri.fsPath,
				status: "processed_for_batching",
				newHash: "mock-hash",
				pointsToUpsert: [{ id: "mock-point-id", vector: [0.1], payload: { filePath: mockUri.fsPath } }],
				reason: undefined,
				error: undefined,
			} as FileProcessingResult)

			// Setup a spy for the _onDidFinishBatchProcessing event
			let batchProcessingFinished = false
			const batchFinishedSpy = vi.fn(() => {
				batchProcessingFinished = true
			})
			fileWatcher.onDidFinishBatchProcessing(batchFinishedSpy)

			// Directly accumulate the event and trigger batch processing
			;(fileWatcher as any).accumulatedEvents.set(mockUri.fsPath, { uri: mockUri, type: "create" })
			;(fileWatcher as any).scheduleBatchProcessing()

			// Advance timers to trigger debounced processing
			await vi.advanceTimersByTimeAsync(1000)
			await vi.runAllTicks()

			// Wait for batch processing to complete
			while (!batchProcessingFinished) {
				await vi.runAllTicks()
				await new Promise((resolve) => setImmediate(resolve))
			}

			expect(processFileSpy).toHaveBeenCalledWith(mockUri.fsPath)
		})
	})

	describe("handleFileChanged", () => {
		beforeEach(() => {
			vi.useFakeTimers()
		})

		afterEach(() => {
			vi.useRealTimers()
		})

		it("should call processFile with correct path", async () => {
			const mockUri = { fsPath: "/mock/workspace/test.js" }
			const processFileSpy = vi.spyOn(fileWatcher, "processFile").mockResolvedValue({
				path: mockUri.fsPath,
				status: "processed_for_batching",
				newHash: "mock-hash",
				pointsToUpsert: [{ id: "mock-point-id", vector: [0.1], payload: { filePath: mockUri.fsPath } }],
				reason: undefined,
				error: undefined,
			} as FileProcessingResult)

			// Setup a spy for the _onDidFinishBatchProcessing event
			let batchProcessingFinished = false
			const batchFinishedSpy = vi.fn(() => {
				batchProcessingFinished = true
			})
			fileWatcher.onDidFinishBatchProcessing(batchFinishedSpy)

			// Directly accumulate the event and trigger batch processing
			;(fileWatcher as any).accumulatedEvents.set(mockUri.fsPath, { uri: mockUri, type: "change" })
			;(fileWatcher as any).scheduleBatchProcessing()

			// Advance timers to trigger debounced processing
			await vi.advanceTimersByTimeAsync(1000)
			await vi.runAllTicks()

			// Wait for batch processing to complete
			while (!batchProcessingFinished) {
				await vi.runAllTicks()
				await new Promise((resolve) => setImmediate(resolve))
			}

			expect(processFileSpy).toHaveBeenCalledWith(mockUri.fsPath)
		})
	})

	describe("handleFileDeleted", () => {
		beforeEach(() => {
			vi.useFakeTimers()
		})

		afterEach(() => {
			vi.useRealTimers()
		})

		it("should delete from cache and process deletion in batch", async () => {
			const mockUri = { fsPath: "/mock/workspace/test.js" }

			// Setup a spy for the _onDidFinishBatchProcessing event
			let batchProcessingFinished = false
			const batchFinishedSpy = vi.fn(() => {
				batchProcessingFinished = true
			})
			fileWatcher.onDidFinishBatchProcessing(batchFinishedSpy)

			// Directly accumulate the event and trigger batch processing
			;(fileWatcher as any).accumulatedEvents.set(mockUri.fsPath, { uri: mockUri, type: "delete" })
			;(fileWatcher as any).scheduleBatchProcessing()

			// Advance timers to trigger debounced processing
			await vi.advanceTimersByTimeAsync(1000)
			await vi.runAllTicks()

			// Wait for batch processing to complete
			while (!batchProcessingFinished) {
				await vi.runAllTicks()
				await new Promise((resolve) => setImmediate(resolve))
			}

			expect(mockCacheManager.deleteHash).toHaveBeenCalledWith(mockUri.fsPath)
			expect(mockVectorStore.deletePointsByMultipleFilePaths).toHaveBeenCalledWith(
				expect.arrayContaining([mockUri.fsPath]),
			)
			expect(mockVectorStore.deletePointsByMultipleFilePaths).toHaveBeenCalledTimes(1)
		})

		it("should handle errors during deletePointsByMultipleFilePaths", async () => {
			// Setup mock error
			const mockError = new Error("Failed to delete points from vector store") as Error
			vi.mocked(mockVectorStore.deletePointsByMultipleFilePaths).mockRejectedValueOnce(mockError)

			// Create a spy for the _onDidFinishBatchProcessing event
			let capturedBatchSummary: any = null
			let batchProcessingFinished = false
			const batchFinishedSpy = vi.fn((summary) => {
				capturedBatchSummary = summary
				batchProcessingFinished = true
			})
			fileWatcher.onDidFinishBatchProcessing(batchFinishedSpy)

			// Trigger delete event
			const mockUri = { fsPath: "/mock/workspace/test-error.js" }

			// Directly accumulate the event and trigger batch processing
			;(fileWatcher as any).accumulatedEvents.set(mockUri.fsPath, { uri: mockUri, type: "delete" })
			;(fileWatcher as any).scheduleBatchProcessing()

			// Advance timers to trigger debounced processing
			await vi.advanceTimersByTimeAsync(1000)
			await vi.runAllTicks()

			// Wait for batch processing to complete
			while (!batchProcessingFinished) {
				await vi.runAllTicks()
				await new Promise((resolve) => setImmediate(resolve))
			}

			// Verify that deletePointsByMultipleFilePaths was called
			expect(mockVectorStore.deletePointsByMultipleFilePaths).toHaveBeenCalledWith(
				expect.arrayContaining([mockUri.fsPath]),
			)

			// Verify that cacheManager.deleteHash is not called when vectorStore.deletePointsByMultipleFilePaths fails
			expect(mockCacheManager.deleteHash).not.toHaveBeenCalledWith(mockUri.fsPath)
		})
	})

	describe("processFile", () => {
		it("should skip ignored files", async () => {
			mockRooIgnoreController.validateAccess.mockImplementation((path: string) => {
				if (path === "/mock/workspace/ignored.js") return false
				return true
			})
			const filePath = "/mock/workspace/ignored.js"
			vi.mocked(mockedVscode.Uri.file).mockImplementation((path: string) => ({ fsPath: path }) as any)
			const result = await fileWatcher.processFile(filePath)

			expect(result.status).toBe("skipped")
			expect(result.reason).toBe("File is ignored by .rooignore or .gitignore")
			expect(mockCacheManager.updateHash).not.toHaveBeenCalled()
			expect(mockedVscode.workspace.fs.stat).not.toHaveBeenCalled()
			expect(mockedVscode.workspace.fs.readFile).not.toHaveBeenCalled()
		})

		it("should skip files larger than MAX_FILE_SIZE_BYTES", async () => {
			vi.mocked(mockedVscode.workspace.fs.stat).mockResolvedValue({ size: 2 * 1024 * 1024 } as any)
			vi.mocked(mockedVscode.workspace.fs.readFile).mockResolvedValue(Buffer.from("large file content") as any)
			mockRooIgnoreController.validateAccess.mockReturnValue(true)
			const result = await fileWatcher.processFile("/mock/workspace/large.js")
			expect(mockedVscode.Uri.file).toHaveBeenCalledWith("/mock/workspace/large.js")

			expect(result.status).toBe("skipped")
			expect(result.reason).toBe("File is too large")
			expect(mockCacheManager.updateHash).not.toHaveBeenCalled()
		})

		it("should skip unchanged files", async () => {
			vi.mocked(mockedVscode.workspace.fs.stat).mockResolvedValue({ size: 1024, mtime: Date.now() } as any)
			vi.mocked(mockedVscode.workspace.fs.readFile).mockResolvedValue(Buffer.from("test content") as any)
			mockCacheManager.getHash.mockReturnValue("hash")
			mockRooIgnoreController.validateAccess.mockReturnValue(true)
			vi.mocked(createHash).mockReturnValue({
				update: vi.fn().mockReturnThis(),
				digest: vi.fn().mockReturnValue("hash"),
			} as any)

			const result = await fileWatcher.processFile("/mock/workspace/unchanged.js")

			expect(result.status).toBe("skipped")
			expect(result.reason).toBe("File has not changed")
			expect(mockCacheManager.updateHash).not.toHaveBeenCalled()
		})

		it("should process changed files", async () => {
			vi.mocked(mockedVscode.Uri.file).mockImplementation((path: string) => ({ fsPath: path }) as any)
			vi.mocked(mockedVscode.workspace.fs.stat).mockResolvedValue({ size: 1024, mtime: Date.now() } as any)
			vi.mocked(mockedVscode.workspace.fs.readFile).mockResolvedValue(Buffer.from("test content") as any)
			mockCacheManager.getHash.mockReturnValue("old-hash")
			mockRooIgnoreController.validateAccess.mockReturnValue(true)
			vi.mocked(createHash).mockReturnValue({
				update: vi.fn().mockReturnThis(),
				digest: vi.fn().mockReturnValue("new-hash"),
			} as any)

			const { codeParser: mockCodeParser } = await import("../parser")
			vi.mocked(mockCodeParser.parseFile).mockResolvedValue([
				{
					file_path: "/mock/workspace/test.js",
					content: "test content",
					start_line: 1,
					end_line: 5,
					identifier: "test",
					type: "function",
					fileHash: "new-hash",
					segmentHash: "segment-hash",
				},
			])

			const result = await fileWatcher.processFile("/mock/workspace/test.js")

			expect(result.status).toBe("processed_for_batching")
			expect(result.newHash).toBe("new-hash")
			expect(result.pointsToUpsert).toEqual([
				expect.objectContaining({
					id: "mocked-uuid-v5-for-testing",
					vector: [0.1, 0.2, 0.3],
					payload: {
						filePath: "test.js",
						codeChunk: "test content",
						startLine: 1,
						endLine: 5,
					},
				}),
			])
			expect(mockCodeParser.parseFile).toHaveBeenCalled()
			expect(mockEmbedder.createEmbeddings).toHaveBeenCalled()
		})

		it("should handle processing errors", async () => {
			vi.mocked(mockedVscode.workspace.fs.stat).mockResolvedValue({ size: 1024 } as any)
			vi.mocked(mockedVscode.workspace.fs.readFile).mockRejectedValue(new Error("Read error"))

			const result = await fileWatcher.processFile("/mock/workspace/error.js")

			expect(result.status).toBe("local_error")
			expect(result.error).toBeDefined()
		})
	})

	describe("Batch processing of rapid delete-then-create/change events", () => {
		let onDidDeleteCallback: (uri: any) => void
		let onDidCreateCallback: (uri: any) => void
		let mockUri: { fsPath: string }

		beforeEach(() => {
			vi.useFakeTimers()

			// Clear all relevant mocks
			mockCacheManager.deleteHash.mockClear()
			mockCacheManager.getHash.mockClear()
			mockCacheManager.updateHash.mockClear()
			vi.mocked(mockVectorStore.deletePointsByFilePath).mockClear()
			vi.mocked(mockVectorStore.upsertPoints).mockClear()
			vi.mocked(mockVectorStore.deletePointsByMultipleFilePaths).mockClear()

			// Setup file watcher mocks
			mockCreateFileSystemWatcher.mockReturnValue({
				onDidCreate: vi.fn((callback) => {
					onDidCreateCallback = callback
					return { dispose: vi.fn() }
				}),
				onDidChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
				onDidDelete: vi.fn((callback) => {
					onDidDeleteCallback = callback
					return { dispose: vi.fn() }
				}),
				dispose: vi.fn(),
			})

			fileWatcher.initialize()
			mockUri = { fsPath: "/mock/workspace/test-race.js" }

			// Ensure file access is allowed
			mockRooIgnoreController.validateAccess.mockReturnValue(true)
		})

		afterEach(() => {
			vi.useRealTimers()
		})

		it("should correctly process a file that is deleted and then quickly re-created/changed", async () => {
			// Setup initial file state mocks
			mockFsStat.mockResolvedValue({ size: 100 })
			mockFsReadFile.mockResolvedValue(Buffer.from("new content"))
			mockCacheManager.getHash.mockReturnValue("old-hash")
			vi.mocked(createHash).mockReturnValue({
				update: vi.fn().mockReturnThis(),
				digest: vi.fn().mockReturnValue("new-hash-for-recreated-file"),
			} as any)

			// Setup code parser mock for the re-created file
			const { codeParser } = await import("../parser")
			vi.mocked(codeParser.parseFile).mockResolvedValue([
				{
					file_path: mockUri.fsPath,
					content: "new content",
					start_line: 1,
					end_line: 5,
					identifier: "test",
					type: "function",
					fileHash: "new-hash-for-recreated-file",
					segmentHash: "segment-hash",
				},
			])

			// Setup a spy for the _onDidFinishBatchProcessing event
			let batchProcessingFinished = false
			const batchFinishedSpy = vi.fn(() => {
				batchProcessingFinished = true
			})
			fileWatcher.onDidFinishBatchProcessing(batchFinishedSpy)

			// Simulate delete event by directly calling the private method that accumulates events
			;(fileWatcher as any).accumulatedEvents.set(mockUri.fsPath, { uri: mockUri, type: "delete" })
			;(fileWatcher as any).scheduleBatchProcessing()
			await vi.runAllTicks()

			// For a delete-then-create in same batch, deleteHash should not be called
			expect(mockCacheManager.deleteHash).not.toHaveBeenCalledWith(mockUri.fsPath)

			// Simulate quick re-creation by overriding the delete event with create
			;(fileWatcher as any).accumulatedEvents.set(mockUri.fsPath, { uri: mockUri, type: "create" })
			await vi.runAllTicks()

			// Advance timers to trigger batch processing and wait for completion
			await vi.advanceTimersByTimeAsync(1000)
			await vi.runAllTicks()

			// Wait for batch processing to complete
			while (!batchProcessingFinished) {
				await vi.runAllTicks()
				await new Promise((resolve) => setImmediate(resolve))
			}

			// Verify the deletion operations
			expect(mockVectorStore.deletePointsByMultipleFilePaths).not.toHaveBeenCalledWith(
				expect.arrayContaining([mockUri.fsPath]),
			)

			// Verify the re-creation operations
			expect(mockVectorStore.upsertPoints).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						id: "mocked-uuid-v5-for-testing",
						payload: expect.objectContaining({
							filePath: expect.stringContaining("test-race.js"),
							codeChunk: "new content",
							startLine: 1,
							endLine: 5,
						}),
					}),
				]),
			)

			// Verify final state
			expect(mockCacheManager.updateHash).toHaveBeenCalledWith(mockUri.fsPath, "new-hash-for-recreated-file")
		}, 15000)
	})

	describe("Batch upsert retry logic", () => {
		beforeEach(() => {
			vi.useFakeTimers()

			// Clear all relevant mocks
			mockCacheManager.deleteHash.mockClear()
			mockCacheManager.getHash.mockClear()
			mockCacheManager.updateHash.mockClear()
			vi.mocked(mockVectorStore.upsertPoints).mockClear()
			vi.mocked(mockVectorStore.deletePointsByFilePath).mockClear()
			vi.mocked(mockVectorStore.deletePointsByMultipleFilePaths).mockClear()

			// Ensure file access is allowed
			mockRooIgnoreController.validateAccess.mockReturnValue(true)
		})

		afterEach(() => {
			vi.useRealTimers()
		})

		it("should retry upsert operation when it fails initially and succeed on retry", async () => {
			// Import constants for correct timing
			const { INITIAL_RETRY_DELAY_MS } = await import("../../constants/index")

			// Setup file state mocks
			mockFsStat.mockResolvedValue({ size: 100 })
			mockFsReadFile.mockResolvedValue(Buffer.from("test content for retry"))
			mockCacheManager.getHash.mockReturnValue("old-hash")
			vi.mocked(createHash).mockReturnValue({
				update: vi.fn().mockReturnThis(),
				digest: vi.fn().mockReturnValue("new-hash-for-retry-test"),
			} as any)

			// Setup code parser mock
			const { codeParser } = await import("../parser")
			vi.mocked(codeParser.parseFile).mockResolvedValue([
				{
					file_path: "/mock/workspace/retry-test.js",
					content: "test content for retry",
					start_line: 1,
					end_line: 5,
					identifier: "test",
					type: "function",
					fileHash: "new-hash-for-retry-test",
					segmentHash: "segment-hash",
				},
			])

			// Setup a spy for the _onDidFinishBatchProcessing event
			let capturedBatchSummary: any = null
			let batchProcessingFinished = false
			const batchFinishedSpy = vi.fn((summary) => {
				capturedBatchSummary = summary
				batchProcessingFinished = true
			})
			fileWatcher.onDidFinishBatchProcessing(batchFinishedSpy)

			// Mock vectorStore.upsertPoints to fail on first call and succeed on second call
			const mockError = new Error("Failed to upsert points to vector store")
			vi.mocked(mockVectorStore.upsertPoints)
				.mockRejectedValueOnce(mockError) // First call fails
				.mockResolvedValueOnce(undefined) // Second call succeeds

			// Trigger file change event
			const mockUri = { fsPath: "/mock/workspace/retry-test.js" }

			// Directly accumulate the event and trigger batch processing
			;(fileWatcher as any).accumulatedEvents.set(mockUri.fsPath, { uri: mockUri, type: "change" })
			;(fileWatcher as any).scheduleBatchProcessing()

			// Wait for processing to start
			await vi.runAllTicks()

			// Advance timers to trigger batch processing
			await vi.advanceTimersByTimeAsync(1000) // Advance past debounce delay
			await vi.runAllTicks()

			// Advance timers to trigger retry after initial failure
			// Use correct exponential backoff: INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount - 1)
			// For first retry (retryCount = 1): 500 * Math.pow(2, 0) = 500ms
			const firstRetryDelay = INITIAL_RETRY_DELAY_MS * Math.pow(2, 1 - 1)
			await vi.advanceTimersByTimeAsync(firstRetryDelay)
			await vi.runAllTicks()

			// Wait for batch processing to complete
			while (!batchProcessingFinished) {
				await vi.runAllTicks()
				await new Promise((resolve) => setImmediate(resolve))
			}

			// Verify that upsertPoints was called twice (initial failure + successful retry)
			expect(mockVectorStore.upsertPoints).toHaveBeenCalledTimes(2)

			// Verify that the cache was updated after successful retry
			expect(mockCacheManager.updateHash).toHaveBeenCalledWith(mockUri.fsPath, "new-hash-for-retry-test")

			// Verify the batch summary
			expect(capturedBatchSummary).not.toBeNull()
			expect(capturedBatchSummary.batchError).toBeUndefined()

			// Verify that the processedFiles array includes the file with success status
			const processedFile = capturedBatchSummary.processedFiles.find((file: any) => file.path === mockUri.fsPath)
			expect(processedFile).toBeDefined()
			expect(processedFile.status).toBe("success")
			expect(processedFile.error).toBeUndefined()
		}, 15000)

		it("should handle the case where upsert fails all retries", async () => {
			// Import constants directly for test
			const { MAX_BATCH_RETRIES, INITIAL_RETRY_DELAY_MS } = await import("../../constants/index")

			// Setup file state mocks
			mockFsStat.mockResolvedValue({ size: 100 })
			mockFsReadFile.mockResolvedValue(Buffer.from("test content for failed retries"))
			mockCacheManager.getHash.mockReturnValue("old-hash")
			vi.mocked(createHash).mockReturnValue({
				update: vi.fn().mockReturnThis(),
				digest: vi.fn().mockReturnValue("new-hash-for-failed-retries-test"),
			} as any)

			// Setup code parser mock
			const { codeParser } = await import("../parser")
			vi.mocked(codeParser.parseFile).mockResolvedValue([
				{
					file_path: "/mock/workspace/failed-retries-test.js",
					content: "test content for failed retries",
					start_line: 1,
					end_line: 5,
					identifier: "test",
					type: "function",
					fileHash: "new-hash-for-failed-retries-test",
					segmentHash: "segment-hash",
				},
			])

			// Setup a spy for the _onDidFinishBatchProcessing event
			let capturedBatchSummary: any = null
			let batchProcessingFinished = false
			const batchFinishedSpy = vi.fn((summary) => {
				capturedBatchSummary = summary
				batchProcessingFinished = true
			})
			fileWatcher.onDidFinishBatchProcessing(batchFinishedSpy)

			// Mock vectorStore.upsertPoints to fail consistently for all retry attempts
			const mockError = new Error("Persistent upsert failure")
			vi.mocked(mockVectorStore.upsertPoints).mockRejectedValue(mockError)

			// Trigger file change event
			const mockUri = { fsPath: "/mock/workspace/failed-retries-test.js" }

			// Directly accumulate the event and trigger batch processing
			;(fileWatcher as any).accumulatedEvents.set(mockUri.fsPath, { uri: mockUri, type: "change" })
			;(fileWatcher as any).scheduleBatchProcessing()

			// Wait for processing to start
			await vi.runAllTicks()

			// Advance timers to trigger batch processing
			await vi.advanceTimersByTimeAsync(1000) // Advance past debounce delay
			await vi.runAllTicks()

			// Advance timers for each retry attempt using correct exponential backoff
			for (let i = 1; i <= MAX_BATCH_RETRIES; i++) {
				// Use correct exponential backoff: INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount - 1)
				const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, i - 1)
				await vi.advanceTimersByTimeAsync(delay)
				await vi.runAllTicks()
			}

			// Wait for batch processing to complete
			while (!batchProcessingFinished) {
				await vi.runAllTicks()
				await new Promise((resolve) => setImmediate(resolve))
			}

			// Verify that upsertPoints was called exactly MAX_BATCH_RETRIES times
			expect(mockVectorStore.upsertPoints).toHaveBeenCalledTimes(MAX_BATCH_RETRIES)

			// Verify that the cache was NOT updated after failed retries
			expect(mockCacheManager.updateHash).not.toHaveBeenCalledWith(
				mockUri.fsPath,
				"new-hash-for-failed-retries-test",
			)

			// Verify the batch summary
			expect(capturedBatchSummary).not.toBeNull()
			expect(capturedBatchSummary.batchError).toBeDefined()
			expect(capturedBatchSummary.batchError.message).toContain(
				`Failed to upsert batch after ${MAX_BATCH_RETRIES} retries`,
			)

			// Verify that the processedFiles array includes the file with error status
			const processedFile = capturedBatchSummary.processedFiles.find((file: any) => file.path === mockUri.fsPath)
			expect(processedFile).toBeDefined()
			expect(processedFile.status).toBe("error")
			expect(processedFile.error).toBeDefined()
			expect(processedFile.error.message).toContain(`Failed to upsert batch after ${MAX_BATCH_RETRIES} retries`)
		}, 15000)
	})

	describe("Pre-existing batch error propagation", () => {
		let onDidDeleteCallback: (uri: any) => void
		let onDidCreateCallback: (uri: any) => void
		let onDidChangeCallback: (uri: any) => void
		let deleteUri: { fsPath: string }
		let createUri: { fsPath: string }
		let changeUri: { fsPath: string }

		beforeEach(() => {
			vi.useFakeTimers()

			// Clear all relevant mocks
			mockCacheManager.deleteHash.mockClear()
			mockCacheManager.getHash.mockClear()
			mockCacheManager.updateHash.mockClear()
			vi.mocked(mockVectorStore.upsertPoints).mockClear()
			vi.mocked(mockVectorStore.deletePointsByFilePath).mockClear()
			vi.mocked(mockVectorStore.deletePointsByMultipleFilePaths).mockClear()

			// Setup file watcher mocks
			mockCreateFileSystemWatcher.mockReturnValue({
				onDidCreate: vi.fn((callback) => {
					onDidCreateCallback = callback
					return { dispose: vi.fn() }
				}),
				onDidChange: vi.fn((callback) => {
					onDidChangeCallback = callback
					return { dispose: vi.fn() }
				}),
				onDidDelete: vi.fn((callback) => {
					onDidDeleteCallback = callback
					return { dispose: vi.fn() }
				}),
				dispose: vi.fn(),
			})

			fileWatcher.initialize()
			deleteUri = { fsPath: "/mock/workspace/to-be-deleted.js" }
			createUri = { fsPath: "/mock/workspace/to-be-created.js" }
			changeUri = { fsPath: "/mock/workspace/to-be-changed.js" }

			// Ensure file access is allowed
			mockRooIgnoreController.validateAccess.mockReturnValue(true)
		})

		afterEach(() => {
			vi.useRealTimers()
		})

		it("should not execute upsert operations when an overallBatchError pre-exists from deletion phase", async () => {
			// Setup file state mocks for the files to be processed
			mockFsStat.mockResolvedValue({ size: 100 })
			mockFsReadFile.mockResolvedValue(Buffer.from("test content"))
			mockCacheManager.getHash.mockReturnValue("old-hash")
			vi.mocked(createHash).mockReturnValue({
				update: vi.fn().mockReturnThis(),
				digest: vi.fn().mockReturnValue("new-hash"),
			} as any)

			// Setup code parser mock for the files to be processed
			const { codeParser } = await import("../parser")
			vi.mocked(codeParser.parseFile).mockResolvedValue([
				{
					file_path: createUri.fsPath,
					content: "test content",
					start_line: 1,
					end_line: 5,
					identifier: "test",
					type: "function",
					fileHash: "new-hash",
					segmentHash: "segment-hash",
				},
			])

			// Setup a spy for the _onDidFinishBatchProcessing event
			let capturedBatchSummary: any = null
			let batchProcessingFinished = false
			const batchFinishedSpy = vi.fn((summary) => {
				capturedBatchSummary = summary
				batchProcessingFinished = true
			})
			fileWatcher.onDidFinishBatchProcessing(batchFinishedSpy)

			// Mock deletePointsByMultipleFilePaths to throw an error
			const mockDeletionError = new Error("Failed to delete points from vector store")
			vi.mocked(mockVectorStore.deletePointsByMultipleFilePaths).mockRejectedValueOnce(mockDeletionError)

			// Simulate delete event by directly adding to accumulated events
			;(fileWatcher as any).accumulatedEvents.set(deleteUri.fsPath, { uri: deleteUri, type: "delete" })
			;(fileWatcher as any).scheduleBatchProcessing()
			await vi.runAllTicks()

			// Simulate create event in the same batch
			;(fileWatcher as any).accumulatedEvents.set(createUri.fsPath, { uri: createUri, type: "create" })
			await vi.runAllTicks()

			// Simulate change event in the same batch
			;(fileWatcher as any).accumulatedEvents.set(changeUri.fsPath, { uri: changeUri, type: "change" })
			await vi.runAllTicks()

			// Advance timers to trigger batch processing
			await vi.advanceTimersByTimeAsync(1000) // Advance past debounce delay
			await vi.runAllTicks()

			// Wait for batch processing to complete
			while (!batchProcessingFinished) {
				await vi.runAllTicks()
				await new Promise((resolve) => setImmediate(resolve))
			}

			// Verify that deletePointsByMultipleFilePaths was called
			expect(mockVectorStore.deletePointsByMultipleFilePaths).toHaveBeenCalled()

			// Verify that upsertPoints was NOT called due to pre-existing error
			expect(mockVectorStore.upsertPoints).not.toHaveBeenCalled()

			// Verify that the cache was NOT updated for the created/changed files
			expect(mockCacheManager.updateHash).not.toHaveBeenCalledWith(createUri.fsPath, expect.any(String))
			expect(mockCacheManager.updateHash).not.toHaveBeenCalledWith(changeUri.fsPath, expect.any(String))

			// Verify the batch summary
			expect(capturedBatchSummary).not.toBeNull()
			expect(capturedBatchSummary.batchError).toBe(mockDeletionError)

			// Verify that the processedFiles array includes all files with appropriate status
			const deletedFile = capturedBatchSummary.processedFiles.find((file: any) => file.path === deleteUri.fsPath)
			expect(deletedFile).toBeDefined()
			expect(deletedFile.status).toBe("error")
			expect(deletedFile.error).toBe(mockDeletionError)

			// Verify that the create/change files also have error status with the same error
			const createdFile = capturedBatchSummary.processedFiles.find((file: any) => file.path === createUri.fsPath)
			expect(createdFile).toBeDefined()
			expect(createdFile.status).toBe("error")
			expect(createdFile.error).toBe(mockDeletionError)

			const changedFile = capturedBatchSummary.processedFiles.find((file: any) => file.path === changeUri.fsPath)
			expect(changedFile).toBeDefined()
			expect(changedFile.status).toBe("error")
			expect(changedFile.error).toBe(mockDeletionError)
		}, 15000)
	})
})
