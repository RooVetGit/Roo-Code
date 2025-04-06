import * as vscode from "vscode"
import * as path from "path"
import { CodeIndexFileWatcher } from "../file-watcher"
import { RooIgnoreController } from "../../../core/ignore/RooIgnoreController"
import { parseCodeFileBySize, CodeBlock } from "../parser"
import { CodeIndexOpenAiEmbedder } from "../openai-embedder"
import { CodeIndexQdrantClient } from "../qdrant-client"
import { getWorkspacePath } from "../../../utils/path"

// --- Mocks ---
const mockVscode = jest.mocked(vscode)
jest.mock("vscode", () => {
	const mockDisposable = { dispose: jest.fn() }
	const mockEventEmitter = {
		event: jest.fn(),
		fire: jest.fn(),
	}

	return {
		workspace: {
			createFileSystemWatcher: jest.fn(() => ({
				onDidCreate: jest.fn(() => mockDisposable),
				onDidChange: jest.fn(() => mockDisposable),
				onDidDelete: jest.fn(() => mockDisposable),
				dispose: jest.fn(),
			})),
			fs: {
				stat: jest.fn().mockResolvedValue({ size: 0 }),
			},
		},
		Uri: {
			joinPath: jest.fn((base, ...paths) => ({ fsPath: path.join(base.fsPath, ...paths) })),
			file: jest.fn((p) => ({ fsPath: p })),
		},
		EventEmitter: jest.fn().mockImplementation(() => mockEventEmitter),
		Disposable: {
			from: jest.fn(() => mockDisposable),
		},
		FileSystemError: class FileSystemError extends Error {
			code: string
			constructor(message: string, code: string) {
				super(message)
				this.name = "FileSystemError"
				this.code = code
			}
			static FileNotFound(uri: string) {
				return new FileSystemError(`File not found: ${uri}`, "FileNotFound")
			}
		},
		RelativePattern: jest.fn().mockImplementation((base, pattern) => ({ base, pattern })),
	}
})

jest.mock("../../../core/ignore/RooIgnoreController", () => ({
	RooIgnoreController: jest.fn(),
}))
jest.mock("../parser")
jest.mock("../openai-embedder")
jest.mock("../qdrant-client")
jest.mock("../../../utils/path")
// RooIgnoreController is now directly the mock constructor from the factory
const mockParseCodeFileBySize = parseCodeFileBySize as jest.MockedFunction<typeof parseCodeFileBySize>
const MockCodeIndexOpenAiEmbedder = CodeIndexOpenAiEmbedder as jest.MockedClass<typeof CodeIndexOpenAiEmbedder>
const MockCodeIndexQdrantClient = CodeIndexQdrantClient as jest.MockedClass<typeof CodeIndexQdrantClient>
const mockGetWorkspacePath = getWorkspacePath as jest.MockedFunction<typeof getWorkspacePath>

// --- Test Suite ---
describe("CodeIndexFileWatcher", () => {
	let watcherInstance: CodeIndexFileWatcher
	let mockQdrantClientInstance: jest.Mocked<CodeIndexQdrantClient>
	let mockIgnoreControllerInstance: jest.Mocked<RooIgnoreController>
	// Store handlers captured during setup
	let capturedCreateHandler: (uri: vscode.Uri) => any
	let capturedChangeHandler: (uri: vscode.Uri) => any
	let capturedDeleteHandler: (uri: vscode.Uri) => any
	const workspaceRoot = "/workspace"
	const mockContext = {
		globalStorageUri: { fsPath: "/globalStorage" },
	} as unknown as vscode.ExtensionContext

	beforeEach(() => {
		jest.clearAllMocks()
		jest.useFakeTimers() // For debounce

		// Mock implementations using jest.spyOn
		mockGetWorkspacePath.mockReturnValue(workspaceRoot)
		// Mock fs.readFile conditionally
		jest.spyOn(vscode.workspace.fs, "readFile").mockImplementation(async (uri: vscode.Uri): Promise<Buffer> => {
			if (uri.fsPath.includes("roo-index-cache-")) {
				// Return empty JSON for cache reads to prevent parsing errors
				return Buffer.from(JSON.stringify({}))
			}
			// Default content for other file reads (e.g., during change events)
			return Buffer.from("file content")
		})
		mockParseCodeFileBySize.mockResolvedValue([]) // Default to no blocks

		// Mock RooIgnoreController instance
		mockIgnoreControllerInstance = {
			initialize: jest.fn().mockResolvedValue(undefined),
			filterPaths: jest.fn((paths) => paths), // Default: allow all
		} as unknown as jest.Mocked<RooIgnoreController>
		// Configure the mock constructor (jest.fn() from the factory) to return the instance
		;(RooIgnoreController as jest.Mock).mockImplementation(() => {
			return mockIgnoreControllerInstance
		})

		// Mock QdrantClient instance methods
		MockCodeIndexQdrantClient.mockImplementation(() => {
			mockQdrantClientInstance = {
				initialize: jest.fn().mockResolvedValue(undefined),
				upsertPoints: jest.fn().mockResolvedValue(undefined),
				deletePointsByFilePath: jest.fn().mockResolvedValue(undefined),
			} as unknown as jest.Mocked<CodeIndexQdrantClient>
			return mockQdrantClientInstance
		})

		// Mock Embedder (optional, only needed if testing embedding path)
		MockCodeIndexOpenAiEmbedder.mockImplementation(
			() =>
				({
					createEmbeddings: jest.fn().mockResolvedValue({ embeddings: [[0.1, 0.2]] }),
				}) as any,
		)

		// Create mock embedder instance explicitly
		const mockEmbedderInstance = new MockCodeIndexOpenAiEmbedder({} as any)

		// Instantiate the watcher with updated constructor signature
		watcherInstance = new CodeIndexFileWatcher(
			workspaceRoot,
			mockContext,
			mockEmbedderInstance,
			mockQdrantClientInstance,
		)

		// Capture the handlers from the watcher mock
		const mockWatcher = mockVscode.workspace.createFileSystemWatcher.mock.results[0].value
		capturedCreateHandler = mockWatcher.onDidCreate.mock.calls[0][0]
		capturedChangeHandler = mockWatcher.onDidChange.mock.calls[0][0]
		capturedDeleteHandler = mockWatcher.onDidDelete.mock.calls[0][0]

		// Need to manually call initialize as it's async
		// await watcherInstance.initialize(); // Call this within tests if needed after setup
	})

	afterEach(() => {
		jest.useRealTimers()
	})

	it("should initialize correctly", async () => {
		await watcherInstance.initialize()
		expect(RooIgnoreController).toHaveBeenCalledWith(workspaceRoot)
		expect(mockIgnoreControllerInstance.initialize).toHaveBeenCalled()
		expect(MockCodeIndexQdrantClient).toHaveBeenCalledWith(workspaceRoot, "http://test-qdrant")
		expect(mockQdrantClientInstance.initialize).toHaveBeenCalled()
		// Check cache loading attempt (mocked fs.readFile)
		expect(vscode.workspace.fs.readFile).toHaveBeenCalledWith(
			expect.objectContaining({ fsPath: expect.stringContaining("roo-index-cache-") }),
		)
	})

	// --- Test Cases for Path Normalization ---

	it("should use absolute, normalized path for upsert on file create", async () => {
		await watcherInstance.initialize()
		// Use the captured handler
		const createHandler = capturedCreateHandler
		const relativeFilePath = "src/newFile.ts"
		const absoluteFilePath = path.join(workspaceRoot, relativeFilePath)
		const normalizedAbsolutePath = path.normalize(absoluteFilePath) // Expected path

		const mockBlock: CodeBlock = {
			file_path: relativeFilePath, // Parser might return relative
			identifier: "testFunc",
			type: "function",
			start_line: 1,
			end_line: 2,
			content: "test",
			fileHash: "h1",
			segmentHash: "h2",
		}
		mockParseCodeFileBySize.mockResolvedValue([mockBlock])

		// Simulate file creation event
		createHandler(vscode.Uri.file(absoluteFilePath))
		await jest.advanceTimersByTimeAsync(600) // Advance past debounce

		expect(mockQdrantClientInstance.upsertPoints).toHaveBeenCalledTimes(1)
		const upsertArgs = mockQdrantClientInstance.upsertPoints.mock.calls[0][0]
		expect(upsertArgs).toHaveLength(1)
		expect(upsertArgs[0].payload.filePath).toBe(normalizedAbsolutePath)
	})

	it("should use absolute, normalized path for delete/upsert on file change", async () => {
		await watcherInstance.initialize()
		// Use the captured handler
		const changeHandler = capturedChangeHandler
		const relativeFilePath = "src/subdir/changedFile.js"
		const absoluteFilePath = path.join(workspaceRoot, relativeFilePath)
		const normalizedAbsolutePath = path.normalize(absoluteFilePath) // Expected path

		// Pre-populate cache to simulate existing file
		;(watcherInstance as any).hashCache[absoluteFilePath] = "oldHash"

		const mockBlock: CodeBlock = {
			file_path: relativeFilePath, // Parser might return relative
			identifier: "testFunc",
			type: "function",
			start_line: 1,
			end_line: 2,
			content: "test",
			fileHash: "newHash",
			segmentHash: "h3",
		}
		mockParseCodeFileBySize.mockResolvedValue([mockBlock])
		// No longer need specific readFile mock here, beforeEach handles it

		// Simulate file change event
		changeHandler(vscode.Uri.file(absoluteFilePath))
		await jest.advanceTimersByTimeAsync(600) // Advance past debounce

		// Verify delete call (qdrant client handles normalization internally)
		expect(mockQdrantClientInstance.deletePointsByFilePath).toHaveBeenCalledTimes(1)
		expect(mockQdrantClientInstance.deletePointsByFilePath).toHaveBeenCalledWith(absoluteFilePath) // Passes the fsPath

		// Verify upsert call
		expect(mockQdrantClientInstance.upsertPoints).toHaveBeenCalledTimes(1)
		const upsertArgs = mockQdrantClientInstance.upsertPoints.mock.calls[0][0]
		expect(upsertArgs).toHaveLength(1)
		expect(upsertArgs[0].payload.filePath).toBe(normalizedAbsolutePath)
	})

	it("should use absolute, normalized path for delete on file delete", async () => {
		await watcherInstance.initialize()
		// Use the captured handler
		const deleteHandler = capturedDeleteHandler
		const relativeFilePath = "toDelete.py"
		const absoluteFilePath = path.join(workspaceRoot, relativeFilePath)
		const normalizedAbsolutePath = path.normalize(absoluteFilePath) // Expected path

		// Pre-populate cache to simulate indexed file
		;(watcherInstance as any).hashCache[absoluteFilePath] = "someHash"

		// Simulate file delete event
		deleteHandler(vscode.Uri.file(absoluteFilePath))
		await jest.advanceTimersByTimeAsync(600) // Advance past debounce

		// Verify delete call (file-watcher normalizes before calling)
		expect(mockQdrantClientInstance.deletePointsByFilePath).toHaveBeenCalledTimes(1)
		expect(mockQdrantClientInstance.deletePointsByFilePath).toHaveBeenCalledWith(normalizedAbsolutePath)
	})

	// --- Add more tests for edge cases, filtering, errors etc. ---

	it("should ignore files based on RooIgnoreController", async () => {
		mockIgnoreControllerInstance.filterPaths.mockReturnValue([]) // Simulate ignoring the file
		await watcherInstance.initialize()
		// Use the captured handler
		const createHandler = capturedCreateHandler
		const filePath = path.join(workspaceRoot, "ignored.ts")

		createHandler(vscode.Uri.file(filePath))
		await jest.advanceTimersByTimeAsync(600)

		expect(mockParseCodeFileBySize).not.toHaveBeenCalled()
		expect(mockQdrantClientInstance.upsertPoints).not.toHaveBeenCalled()
	})

	it("should ignore files based on extension", async () => {
		await watcherInstance.initialize()
		// Use the captured handler
		const createHandler = capturedCreateHandler
		const filePath = path.join(workspaceRoot, "document.txt") // Unsupported extension

		createHandler(vscode.Uri.file(filePath))
		await jest.advanceTimersByTimeAsync(600)

		expect(mockParseCodeFileBySize).not.toHaveBeenCalled()
		expect(mockQdrantClientInstance.upsertPoints).not.toHaveBeenCalled()
	})

	it("should ignore files based on size", async () => {
		// Override stat mock for this specific test
		jest.spyOn(vscode.workspace.fs, "stat").mockResolvedValue({
			size: 2 * 1024 * 1024,
		} as vscode.FileStat) // > 1MB
		await watcherInstance.initialize()
		// Use the captured handler
		const createHandler = capturedCreateHandler
		const filePath = path.join(workspaceRoot, "largeFile.ts")

		createHandler(vscode.Uri.file(filePath))
		await jest.advanceTimersByTimeAsync(600)

		expect(mockParseCodeFileBySize).not.toHaveBeenCalled()
		expect(mockQdrantClientInstance.upsertPoints).not.toHaveBeenCalled()
	})
})
