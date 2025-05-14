// @ts-nocheck
import { FileWatcher } from "../file-watcher"
import { IEmbedder, IVectorStore } from "../../../../core/interfaces"
import { createHash } from "crypto"

jest.mock("vscode", () => ({
	EventEmitter: jest.fn().mockImplementation(() => ({
		event: jest.fn(),
		fire: jest.fn(),
		dispose: jest.fn(),
	})),
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
}))

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
			embedderInfo: { name: "mock-embedder", dimensions: 384 },
		}
		mockVectorStore = {
			upsertPoints: jest.fn().mockResolvedValue(undefined),
			deletePointsByFilePath: jest.fn().mockResolvedValue(undefined),
			deletePointsByMultipleFilePaths: jest.fn().mockResolvedValue(undefined),
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
			// Push mock event emitters to subscriptions array
			mockContext.subscriptions.push({ dispose: jest.fn() }, { dispose: jest.fn() })
			expect(mockContext.subscriptions).toHaveLength(2) // onDidStartProcessing and onDidFinishProcessing
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
			await fileWatcher.initialize() // Initialize first to create watcher
			fileWatcher.dispose()
			const watcher = vscode.workspace.createFileSystemWatcher.mock.results[0].value
			expect(watcher.dispose).toHaveBeenCalled()
		})
	})

	describe("handleFileCreated", () => {
		it("should call processFile with correct path", async () => {
			const mockUri = { fsPath: "/mock/workspace/test.js" }
			const processFileSpy = jest.spyOn(fileWatcher, "processFile").mockResolvedValue({ status: "success" })

			await fileWatcher.handleFileCreated(mockUri)
			expect(processFileSpy).toHaveBeenCalledWith(mockUri.fsPath)
		})
	})

	describe("handleFileChanged", () => {
		it("should call processFile with correct path", async () => {
			const mockUri = { fsPath: "/mock/workspace/test.js" }
			const processFileSpy = jest.spyOn(fileWatcher, "processFile").mockResolvedValue({ status: "success" })

			await fileWatcher.handleFileChanged(mockUri)
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

			await fileWatcher.handleFileDeleted(mockUri)
			expect(mockCacheManager.deleteHash).toHaveBeenCalledWith(mockUri.fsPath)

			// Advance timers to trigger the batched deletion
			await jest.advanceTimersByTime(500)

			// Verify the batched deletion call
			expect(mockVectorStore.deletePointsByMultipleFilePaths).toHaveBeenCalledWith([mockUri.fsPath])
		})
	})

	describe("processFile", () => {
		it("should skip ignored files", async () => {
			mockRooIgnoreController.validateAccess.mockImplementation((path) => {
				if (path === "/mock/workspace/ignored.js") return false
				return true
			})
			const filePath = "/mock/workspace/ignored.js"
			vscode.Uri.file.mockImplementation((path) => ({ fsPath: path }))
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
			vscode.workspace.fs.stat.mockResolvedValue({ size: 2 * 1024 * 1024 }) // 2MB > 1MB limit
			vscode.workspace.fs.readFile.mockResolvedValue(Buffer.from("large file content"))
			mockRooIgnoreController.validateAccess.mockReturnValue(true) // Ensure file isn't ignored
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
			mockRooIgnoreController.validateAccess.mockReturnValue(true) // Ensure file isn't ignored
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
			vscode.Uri.file.mockImplementation((path) => ({ fsPath: path }))
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

			mockEmbedder.createEmbeddings.mockResolvedValue({
				embeddings: [[0.1, 0.2, 0.3]],
			})

			const result = await fileWatcher.processFile("/mock/workspace/test.js")

			expect(result.status).toBe("success")
			expect(mockVectorStore.deletePointsByFilePath).toHaveBeenCalled()
			expect(mockCodeParser.parseFile).toHaveBeenCalled()
			expect(mockEmbedder.createEmbeddings).toHaveBeenCalled()
			expect(mockVectorStore.upsertPoints).toHaveBeenCalled()
			expect(mockCacheManager.updateHash).toHaveBeenCalledWith("/mock/workspace/test.js", "new-hash")
		})

		it("should handle processing errors", async () => {
			vscode.workspace.fs.stat.mockResolvedValue({ size: 1024 })
			vscode.workspace.fs.readFile.mockRejectedValue(new Error("Read error"))

			const result = await fileWatcher.processFile("/mock/workspace/error.js")

			expect(result.status).toBe("error")
			expect(result.error).toBeDefined()
		})
	})
})
