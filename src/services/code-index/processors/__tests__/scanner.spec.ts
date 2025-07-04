// npx vitest services/code-index/processors/__tests__/scanner.spec.ts

import { DirectoryScanner } from "../scanner"
import { stat } from "fs/promises"

vi.mock("fs/promises", () => ({
	default: {
		readFile: vi.fn(),
		writeFile: vi.fn(),
		mkdir: vi.fn(),
		access: vi.fn(),
		rename: vi.fn(),
		constants: {},
	},
	stat: vi.fn(),
}))

// Create a simple mock for vscode since we can't access the real one
vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [
			{
				uri: {
					fsPath: "/mock/workspace",
				},
			},
		],
		getWorkspaceFolder: vi.fn().mockReturnValue({
			uri: {
				fsPath: "/mock/workspace",
			},
		}),
		fs: {
			readFile: vi.fn().mockResolvedValue(Buffer.from("test content")),
		},
	},
	Uri: {
		file: vi.fn().mockImplementation((path) => path),
	},
	window: {
		activeTextEditor: {
			document: {
				uri: {
					fsPath: "/mock/workspace",
				},
			},
		},
	},
}))

vi.mock("../../../../core/ignore/RooIgnoreController")
vi.mock("ignore")

// Override the Jest-based mock with a vitest-compatible version
vi.mock("../../../glob/list-files", () => ({
	listFiles: vi.fn(),
}))

describe("DirectoryScanner", () => {
	let scanner: DirectoryScanner
	let mockEmbedder: any
	let mockVectorStore: any
	let mockCodeParser: any
	let mockCacheManager: any
	let mockIgnoreInstance: any
	let mockStats: any

	beforeEach(async () => {
		mockEmbedder = {
			createEmbeddings: vi.fn().mockResolvedValue({ embeddings: [[0.1, 0.2, 0.3]] }),
			embedderInfo: { name: "mock-embedder", dimensions: 384 },
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
		mockCodeParser = {
			parseFile: vi.fn().mockResolvedValue([]),
		}
		mockCacheManager = {
			getHash: vi.fn().mockReturnValue(undefined),
			getAllHashes: vi.fn().mockReturnValue({}),
			updateHash: vi.fn().mockResolvedValue(undefined),
			deleteHash: vi.fn().mockResolvedValue(undefined),
			initialize: vi.fn().mockResolvedValue(undefined),
			clearCacheFile: vi.fn().mockResolvedValue(undefined),
		}
		mockIgnoreInstance = {
			ignores: vi.fn().mockReturnValue(false),
		}

		scanner = new DirectoryScanner(
			mockEmbedder,
			mockVectorStore,
			mockCodeParser,
			mockCacheManager,
			mockIgnoreInstance,
		)

		// Mock default implementations - create proper Stats object
		mockStats = {
			size: 1024,
			isFile: () => true,
			isDirectory: () => false,
			isBlockDevice: () => false,
			isCharacterDevice: () => false,
			isSymbolicLink: () => false,
			isFIFO: () => false,
			isSocket: () => false,
			dev: 0,
			ino: 0,
			mode: 0,
			nlink: 0,
			uid: 0,
			gid: 0,
			rdev: 0,
			blksize: 0,
			blocks: 0,
			atimeMs: 0,
			mtimeMs: 0,
			ctimeMs: 0,
			birthtimeMs: 0,
			atime: new Date(),
			mtime: new Date(),
			ctime: new Date(),
			birthtime: new Date(),
			atimeNs: BigInt(0),
			mtimeNs: BigInt(0),
			ctimeNs: BigInt(0),
			birthtimeNs: BigInt(0),
		}
		vi.mocked(stat).mockResolvedValue(mockStats)

		// Get and mock the listFiles function
		const { listFiles } = await import("../../../glob/list-files")
		vi.mocked(listFiles).mockResolvedValue([["test/file1.js", "test/file2.js"], false])
	})

	describe("scanDirectory", () => {
		it("should skip files larger than MAX_FILE_SIZE_BYTES", async () => {
			const { listFiles } = await import("../../../glob/list-files")
			vi.mocked(listFiles).mockResolvedValue([["test/file1.js"], false])

			// Create large file mock stats
			const largeFileStats = {
				...mockStats,
				size: 2 * 1024 * 1024, // 2MB > 1MB limit
			}
			vi.mocked(stat).mockResolvedValueOnce(largeFileStats)

			const result = await scanner.scanDirectory("/test")
			expect(result.stats.skipped).toBe(1)
			expect(mockCodeParser.parseFile).not.toHaveBeenCalled()
		})

		it("should parse changed files and return code blocks", async () => {
			const { listFiles } = await import("../../../glob/list-files")
			vi.mocked(listFiles).mockResolvedValue([["test/file1.js"], false])
			const mockBlocks: any[] = [
				{
					file_path: "test/file1.js",
					content: "test content",
					start_line: 1,
					end_line: 5,
					identifier: "test",
					type: "function",
					fileHash: "hash",
					segmentHash: "segment-hash",
				},
			]
			;(mockCodeParser.parseFile as any).mockResolvedValue(mockBlocks)

			const result = await scanner.scanDirectory("/test")
			expect(result.codeBlocks).toEqual(mockBlocks)
			expect(result.stats.processed).toBe(1)
		})

		it("should process embeddings for new/changed files", async () => {
			const mockBlocks: any[] = [
				{
					file_path: "test/file1.js",
					content: "test content",
					start_line: 1,
					end_line: 5,
					identifier: "test",
					type: "function",
					fileHash: "hash",
					segmentHash: "segment-hash",
				},
			]
			;(mockCodeParser.parseFile as any).mockResolvedValue(mockBlocks)

			await scanner.scanDirectory("/test")
			expect(mockEmbedder.createEmbeddings).toHaveBeenCalled()
			expect(mockVectorStore.upsertPoints).toHaveBeenCalled()
		})

		it("should delete points for removed files", async () => {
			;(mockCacheManager.getAllHashes as any).mockReturnValue({ "old/file.js": "old-hash" })

			await scanner.scanDirectory("/test")
			expect(mockVectorStore.deletePointsByFilePath).toHaveBeenCalledWith("old/file.js")
			expect(mockCacheManager.deleteHash).toHaveBeenCalledWith("old/file.js")
		})

		it("should filter out files in hidden directories", async () => {
			const { listFiles } = await import("../../../glob/list-files")
			// Mock listFiles to return files including some in hidden directories
			vi.mocked(listFiles).mockResolvedValue([
				[
					"test/file1.js",
					"test/.hidden/file2.js",
					".git/config",
					"src/.next/static/file3.js",
					"normal/file4.js",
				],
				false,
			])

			// Mock parseFile to track which files are actually processed
			const processedFiles: string[] = []
			;(mockCodeParser.parseFile as any).mockImplementation((filePath: string) => {
				processedFiles.push(filePath)
				return []
			})

			await scanner.scanDirectory("/test")

			// Verify that only non-hidden files were processed
			expect(processedFiles).toEqual(["test/file1.js", "normal/file4.js"])
			expect(processedFiles).not.toContain("test/.hidden/file2.js")
			expect(processedFiles).not.toContain(".git/config")
			expect(processedFiles).not.toContain("src/.next/static/file3.js")

			// Verify the stats
			expect(mockCodeParser.parseFile).toHaveBeenCalledTimes(2)
		})

		it("should handle multi-workspace scenarios with consistent workspace context", async () => {
			const { listFiles } = await import("../../../glob/list-files")
			// Mock a multi-workspace scenario where listFiles returns paths from different workspaces
			vi.mocked(listFiles).mockResolvedValue([
				["/workspace1/src/file1.js", "/workspace2/admin/.prettierrc.json"],
				false,
			])

			// Mock vscode to simulate multi-workspace
			const vscode = await import("vscode")
			vi.mocked(vscode.workspace.getWorkspaceFolder).mockImplementation((uri: any) => {
				if (uri && uri.includes("/workspace1")) {
					return { uri: { fsPath: "/workspace1" } } as any
				}
				if (uri && uri.includes("/workspace2")) {
					return { uri: { fsPath: "/workspace2" } } as any
				}
				return null
			})

			const mockBlocks: any[] = [
				{
					file_path: "/workspace1/src/file1.js",
					content: "test content",
					start_line: 1,
					end_line: 5,
					identifier: "test",
					type: "function",
					fileHash: "hash1",
					segmentHash: "segment-hash1",
				},
			]
			;(mockCodeParser.parseFile as any).mockResolvedValue(mockBlocks)

			// This should not throw the "path should be a 'path.relative()'d string" error
			const result = await scanner.scanDirectory("/workspace1")
			expect(result.stats.processed).toBeGreaterThan(0)
			expect(mockVectorStore.upsertPoints).toHaveBeenCalled()
		})

		it("should handle workspace switching during indexing without errors", async () => {
			const { listFiles } = await import("../../../glob/list-files")
			// Mock files from multiple workspaces
			vi.mocked(listFiles).mockResolvedValue([
				[
					"/workspace1/src/file1.js",
					"/workspace1/src/file2.js",
					"/workspace2/admin/config.json",
					"/workspace2/admin/.prettierrc.json",
					"/workspace3/lib/utils.ts",
				],
				false,
			])

			// Mock vscode to simulate workspace switching during indexing
			const vscode = await import("vscode")
			let callCount = 0
			vi.mocked(vscode.workspace.getWorkspaceFolder).mockImplementation((uri: any) => {
				callCount++
				// Simulate active workspace changing during scan
				if (callCount < 3) {
					// First few calls return workspace1
					if (uri && uri.includes("/workspace1")) {
						return { uri: { fsPath: "/workspace1" } } as any
					}
				} else if (callCount < 5) {
					// Next calls simulate switch to workspace2
					if (uri && uri.includes("/workspace2")) {
						return { uri: { fsPath: "/workspace2" } } as any
					}
				} else {
					// Final calls simulate switch to workspace3
					if (uri && uri.includes("/workspace3")) {
						return { uri: { fsPath: "/workspace3" } } as any
					}
				}
				// Handle specific workspace resolution
				if (uri && uri.includes("/workspace1")) {
					return { uri: { fsPath: "/workspace1" } } as any
				}
				if (uri && uri.includes("/workspace2")) {
					return { uri: { fsPath: "/workspace2" } } as any
				}
				if (uri && uri.includes("/workspace3")) {
					return { uri: { fsPath: "/workspace3" } } as any
				}
				return null
			})

			// Mock code blocks for processed files
			const mockBlocks: any[] = [
				{
					file_path: "src/file1.js",
					content: "test content 1",
					start_line: 1,
					end_line: 5,
					identifier: "test1",
					type: "function",
					fileHash: "hash1",
					segmentHash: "segment-hash1",
				},
			]
			;(mockCodeParser.parseFile as any).mockResolvedValue(mockBlocks)

			// Mock embedding creation with multiple embeddings
			mockEmbedder.createEmbeddings.mockResolvedValue({
				embeddings: [
					[0.1, 0.2, 0.3],
					[0.2, 0.3, 0.4],
					[0.3, 0.4, 0.5],
					[0.4, 0.5, 0.6],
					[0.5, 0.6, 0.7],
				],
			})

			// Run scan from workspace1
			const result = await scanner.scanDirectory("/workspace1")

			// Verify no errors occurred despite workspace switching
			expect(result.stats.processed).toBeGreaterThan(0)
			expect(mockVectorStore.upsertPoints).toHaveBeenCalled()

			// Verify that points were created with proper relative paths
			const upsertCalls = mockVectorStore.upsertPoints.mock.calls
			expect(upsertCalls.length).toBeGreaterThan(0)

			// Check that all paths in the upserted points are properly relative
			const allPoints = upsertCalls.flatMap((call: any[]) => call[0])
			allPoints.forEach((point: any) => {
				// Ensure no paths start with ../ (which would indicate wrong workspace context)
				expect(point.payload.filePath).not.toMatch(/^\.\.\//)
				// Ensure paths don't contain absolute paths
				expect(point.payload.filePath).not.toMatch(/^\//)
			})
		})
	})
})
