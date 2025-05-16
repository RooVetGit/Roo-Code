import { IEmbedder } from "../../interfaces/embedder"
import { IVectorStore } from "../../interfaces/vector-store"
import { FileProcessingResult } from "../../interfaces/file-processor"
import { FileWatcher } from "../file-watcher"

import { createHash } from "crypto"

jest.mock("vscode", () => {
	type Disposable = { dispose: () => void }

	type _Event<T> = (listener: (e: T) => any, thisArgs?: any, disposables?: Disposable[]) => Disposable

	const MOCK_EMITTER_REGISTRY = new Map<object, Set<(data: any) => any>>()

	return {
		EventEmitter: jest.fn().mockImplementation(() => {
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
		RelativePattern: jest.fn().mockImplementation((base, pattern) => ({
			base,
			pattern,
		})),
		Uri: {
			file: jest.fn().mockImplementation((path) => ({ fsPath: path })),
		},
		window: {
			activeTextEditor: undefined,
		},
		workspace: {
			createFileSystemWatcher: jest.fn().mockReturnValue({
				onDidCreate: jest.fn(),
				onDidChange: jest.fn(),
				onDidDelete: jest.fn(),
				dispose: jest.fn(),
			}),
			fs: {
				stat: jest.fn(),
				readFile: jest.fn(),
			},
			workspaceFolders: [{ uri: { fsPath: "/mock/workspace" } }],
			getWorkspaceFolder: jest.fn((uri) => {
				if (uri && uri.fsPath && uri.fsPath.startsWith("/mock/workspace")) {
					return { uri: { fsPath: "/mock/workspace" } }
				}
				return undefined
			}),
		},
	}
})

const vscode = require("vscode")
jest.mock("crypto")
jest.mock("uuid", () => ({
	...jest.requireActual("uuid"),
	v5: jest.fn().mockReturnValue("mocked-uuid-v5-for-testing"),
}))
jest.mock("../../../../core/ignore/RooIgnoreController", () => ({
	RooIgnoreController: jest.fn().mockImplementation(() => ({
		validateAccess: jest.fn(),
	})),
	mockValidateAccess: jest.fn(),
}))
jest.mock("../../cache-manager")
jest.mock("../parser", () => ({ codeParser: { parseFile: jest.fn() } }))

describe("FileWatcher", () => {
	let fileWatcher: FileWatcher
	let mockEmbedder: IEmbedder
	let mockVectorStore: IVectorStore
	let mockCacheManager: any
	let mockContext: any
	let mockRooIgnoreController: any

	beforeEach(() => {
		mockEmbedder = {
			createEmbeddings: jest.fn().mockResolvedValue({ embeddings: [[0.1, 0.2, 0.3]] }),
			embedderInfo: { name: "openai" },
		}
		mockVectorStore = {
			upsertPoints: jest.fn().mockResolvedValue(undefined),
			deletePointsByFilePath: jest.fn().mockResolvedValue(undefined),
			deletePointsByMultipleFilePaths: jest.fn().mockResolvedValue(undefined),
			initialize: jest.fn().mockResolvedValue(true),
			search: jest.fn().mockResolvedValue([]),
			clearCollection: jest.fn().mockResolvedValue(undefined),
			deleteCollection: jest.fn().mockResolvedValue(undefined),
			collectionExists: jest.fn().mockResolvedValue(true),
		}
		mockCacheManager = {
			getHash: jest.fn(),
			updateHash: jest.fn(),
			deleteHash: jest.fn(),
		}
		mockContext = {
			subscriptions: [],
		}

		const { RooIgnoreController, mockValidateAccess } = require("../../../../core/ignore/RooIgnoreController")
		mockRooIgnoreController = new RooIgnoreController()
		mockRooIgnoreController.validateAccess = mockValidateAccess.mockReturnValue(true)

		fileWatcher = new FileWatcher(
			"/mock/workspace",
			mockContext,
			mockCacheManager,
			mockEmbedder,
			mockVectorStore,
			mockRooIgnoreController,
		)
	})

	describe("constructor", () => {
		it("should initialize with correct properties", () => {
			expect(fileWatcher).toBeDefined()

			mockContext.subscriptions.push({ dispose: jest.fn() }, { dispose: jest.fn() })
			expect(mockContext.subscriptions).toHaveLength(2)
		})
	})

	describe("initialize", () => {
		it("should create file watcher with correct pattern", async () => {
			await fileWatcher.initialize()
			expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalled()
			expect(vscode.workspace.createFileSystemWatcher.mock.calls[0][0].pattern).toMatch(
				/\{tla,js,jsx,ts,vue,tsx,py,rs,go,c,h,cpp,hpp,cs,rb,java,php,swift,sol,kt,kts,ex,exs,el,html,htm,json,css,rdl,ml,mli,lua,scala,toml,zig,elm,ejs,erb\}/,
			)
		})

		it("should register event handlers", async () => {
			await fileWatcher.initialize()
			const watcher = vscode.workspace.createFileSystemWatcher.mock.results[0].value
			expect(watcher.onDidCreate).toHaveBeenCalled()
			expect(watcher.onDidChange).toHaveBeenCalled()
			expect(watcher.onDidDelete).toHaveBeenCalled()
		})
	})

	describe("dispose", () => {
		it("should dispose all resources", async () => {
			await fileWatcher.initialize()
			fileWatcher.dispose()
			const watcher = vscode.workspace.createFileSystemWatcher.mock.results[0].value
			expect(watcher.dispose).toHaveBeenCalled()
		})
	})

	describe("handleFileCreated", () => {
		it("should call processFile with correct path", async () => {
			const mockUri = { fsPath: "/mock/workspace/test.js" }
			const processFileSpy = jest.spyOn(fileWatcher, "processFile").mockResolvedValue({
				path: mockUri.fsPath,
				status: "processed_for_batching",
				newHash: "mock-hash",
				pointsToUpsert: [],
				reason: undefined,
				error: undefined,
			} as FileProcessingResult)

			// Access private method using type assertion
			await (fileWatcher as any).handleFileCreated(mockUri)
			expect(processFileSpy).toHaveBeenCalledWith(mockUri.fsPath)
		})
	})

	describe("handleFileChanged", () => {
		it("should call processFile with correct path", async () => {
			const mockUri = { fsPath: "/mock/workspace/test.js" }
			const processFileSpy = jest.spyOn(fileWatcher, "processFile").mockResolvedValue({
				path: mockUri.fsPath,
				status: "processed_for_batching",
				newHash: "mock-hash",
				pointsToUpsert: [],
				reason: undefined,
				error: undefined,
			} as FileProcessingResult)

			// Access private method using type assertion
			await (fileWatcher as any).handleFileChanged(mockUri)
			expect(processFileSpy).toHaveBeenCalledWith(mockUri.fsPath)
		})
	})

	describe("handleFileDeleted", () => {
		beforeEach(() => {
			jest.useFakeTimers()
		})

		afterEach(() => {
			jest.useRealTimers()
		})

		it("should delete from cache and vector store", async () => {
			const mockUri = { fsPath: "/mock/workspace/test.js" }

			// Access private method using type assertion
			await (fileWatcher as any).handleFileDeleted(mockUri)
			expect(mockCacheManager.deleteHash).toHaveBeenCalledWith(mockUri.fsPath)

			await jest.advanceTimersByTime(500)

			expect(mockVectorStore.deletePointsByMultipleFilePaths).toHaveBeenCalledWith([mockUri.fsPath])
		})
	})

	describe("processFile", () => {
		it("should skip ignored files", async () => {
			mockRooIgnoreController.validateAccess.mockImplementation((path: string) => {
				if (path === "/mock/workspace/ignored.js") return false
				return true
			})
			const filePath = "/mock/workspace/ignored.js"
			vscode.Uri.file.mockImplementation((path: string) => ({ fsPath: path }))
			const result = await fileWatcher.processFile(filePath)

			expect(result.status).toBe("skipped")
			expect(result.reason).toBe("File is ignored by .rooignore")
			expect(mockCacheManager.updateHash).not.toHaveBeenCalled()
			expect(vscode.workspace.fs.stat).not.toHaveBeenCalled()
			expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled()
			expect(mockCacheManager.updateHash).not.toHaveBeenCalled()
			expect(vscode.workspace.fs.stat).not.toHaveBeenCalled()
			expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled()
		})

		it("should skip files larger than MAX_FILE_SIZE_BYTES", async () => {
			vscode.workspace.fs.stat.mockResolvedValue({ size: 2 * 1024 * 1024 })
			vscode.workspace.fs.readFile.mockResolvedValue(Buffer.from("large file content"))
			mockRooIgnoreController.validateAccess.mockReturnValue(true)
			const result = await fileWatcher.processFile("/mock/workspace/large.js")
			expect(vscode.Uri.file).toHaveBeenCalledWith("/mock/workspace/large.js")

			expect(result.status).toBe("skipped")
			expect(result.reason).toBe("File is too large")
			expect(mockCacheManager.updateHash).not.toHaveBeenCalled()
		})

		it("should skip unchanged files", async () => {
			vscode.workspace.fs.stat.mockResolvedValue({ size: 1024, mtime: Date.now() })
			vscode.workspace.fs.readFile.mockResolvedValue(Buffer.from("test content"))
			mockCacheManager.getHash.mockReturnValue("hash")
			mockRooIgnoreController.validateAccess.mockReturnValue(true)
			;(createHash as jest.Mock).mockReturnValue({
				update: jest.fn().mockReturnThis(),
				digest: jest.fn().mockReturnValue("hash"),
			})

			const result = await fileWatcher.processFile("/mock/workspace/unchanged.js")

			expect(result.status).toBe("skipped")
			expect(result.reason).toBe("File has not changed")
			expect(mockCacheManager.updateHash).not.toHaveBeenCalled()
		})

		it("should process changed files", async () => {
			vscode.Uri.file.mockImplementation((path: string) => ({ fsPath: path }))
			vscode.workspace.fs.stat.mockResolvedValue({ size: 1024, mtime: Date.now() })
			vscode.workspace.fs.readFile.mockResolvedValue(Buffer.from("test content"))
			mockCacheManager.getHash.mockReturnValue("old-hash")
			mockRooIgnoreController.validateAccess.mockReturnValue(true)
			;(createHash as jest.Mock).mockReturnValue({
				update: jest.fn().mockReturnThis(),
				digest: jest.fn().mockReturnValue("new-hash"),
			})

			const { codeParser: mockCodeParser } = require("../parser")
			mockCodeParser.parseFile.mockResolvedValue([
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

			// No need to mock again, it's already mocked in the setup

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
			vscode.workspace.fs.stat.mockResolvedValue({ size: 1024 })
			vscode.workspace.fs.readFile.mockRejectedValue(new Error("Read error"))

			const result = await fileWatcher.processFile("/mock/workspace/error.js")

			expect(result.status).toBe("local_error")
			expect(result.error).toBeDefined()
		})
	})

	describe("delete then create race condition", () => {
		let onDidDeleteCallback: (uri: any) => void
		let onDidCreateCallback: (uri: any) => void
		let mockUri: { fsPath: string }

		beforeEach(() => {
			jest.useFakeTimers()

			mockCacheManager.deleteHash.mockClear()
			;(mockVectorStore.deletePointsByFilePath as jest.Mock).mockClear()
			;(mockVectorStore.upsertPoints as jest.Mock).mockClear()
			;(mockVectorStore.deletePointsByMultipleFilePaths as jest.Mock).mockClear()

			vscode.workspace.createFileSystemWatcher.mockReturnValue({
				onDidCreate: jest.fn((callback) => {
					onDidCreateCallback = callback
					return { dispose: jest.fn() }
				}),
				onDidChange: jest.fn().mockReturnValue({ dispose: jest.fn() }),
				onDidDelete: jest.fn((callback) => {
					onDidDeleteCallback = callback
					return { dispose: jest.fn() }
				}),
				dispose: jest.fn(),
			})

			fileWatcher.initialize()

			mockUri = { fsPath: "/mock/workspace/test-race.js" }
		})

		afterEach(() => {
			jest.useRealTimers()
		})

		const waitForFileProcessingToFinish = (fw: FileWatcher, filePath: string) => {
			return new Promise<void>((resolve) => {
				const listener = fw.onDidFinishProcessing((result) => {
					if (result.path === filePath) {
						listener.dispose()
						resolve()
					}
				})
			})
		}

		it("should handle rapid delete-then-create sequence correctly", async () => {
			vscode.workspace.fs.stat.mockResolvedValue({ size: 100 })
			vscode.workspace.fs.readFile.mockResolvedValue(Buffer.from("new content"))
			mockCacheManager.getHash.mockReturnValue("old-hash")
			;(createHash as jest.Mock).mockReturnValue({
				update: jest.fn().mockReturnThis(),
				digest: jest.fn().mockReturnValue("new-hash"),
			})

			const { codeParser: mockCodeParser } = require("../parser")
			mockCodeParser.parseFile.mockResolvedValue([
				{
					file_path: mockUri.fsPath,
					content: "new content",
					start_line: 1,
					end_line: 5,
					fileHash: "new-hash",
				},
			])

			onDidDeleteCallback(mockUri)

			await jest.runAllTicks()

			expect(mockCacheManager.deleteHash).toHaveBeenCalledWith(mockUri.fsPath)
			expect((fileWatcher as any).deletedFilesBuffer).toContain(mockUri.fsPath)

			const processingPromise = waitForFileProcessingToFinish(fileWatcher, mockUri.fsPath)

			onDidCreateCallback(mockUri)

			await jest.runAllTicks()

			await processingPromise

			expect(mockVectorStore.deletePointsByFilePath).toHaveBeenCalledWith(mockUri.fsPath)
			expect(mockVectorStore.deletePointsByFilePath).toHaveBeenCalledTimes(1)
			expect(mockVectorStore.deletePointsByMultipleFilePaths).toHaveBeenCalledWith(
				expect.arrayContaining([mockUri.fsPath]),
			)

			expect((fileWatcher as any).deletedFilesBuffer).not.toContain(mockUri.fsPath)

			const otherFilePath = "/mock/workspace/other-file.js"
			;(fileWatcher as any).deletedFilesBuffer.push(otherFilePath)

			await jest.advanceTimersByTimeAsync(500)
			await jest.runAllTicks()

			expect((mockVectorStore.deletePointsByMultipleFilePaths as jest.Mock).mock.calls[0][0]).toEqual(
				expect.arrayContaining([mockUri.fsPath]),
			)

			expect(mockVectorStore.deletePointsByMultipleFilePaths).toHaveBeenCalledTimes(2)

			const flushedDeletedPaths = (mockVectorStore.deletePointsByMultipleFilePaths as jest.Mock).mock.calls[1][0]
			expect(flushedDeletedPaths).toContain(otherFilePath)
			expect(flushedDeletedPaths).not.toContain(mockUri.fsPath)

			expect(mockCacheManager.updateHash).toHaveBeenCalledWith(mockUri.fsPath, "new-hash")
		})
	})
})
