// Test specifically for the JSON file .rooignore issue
// npx vitest services/code-index/processors/__tests__/file-watcher-json-rooignore.spec.ts

import { FileWatcher } from "../file-watcher"
import { RooIgnoreController } from "../../../../core/ignore/RooIgnoreController"
import * as vscode from "vscode"
import * as path from "path"

// Mock TelemetryService
vi.mock("../../../../../packages/telemetry/src/TelemetryService", () => ({
	TelemetryService: {
		instance: {
			captureEvent: vi.fn(),
		},
	},
}))

// Mock dependencies
vi.mock("../../cache-manager", () => ({
	CacheManager: vi.fn().mockImplementation(() => ({
		getHash: vi.fn().mockReturnValue(null),
		updateHash: vi.fn(),
		deleteHash: vi.fn(),
	})),
}))

vi.mock("../parser", () => ({
	codeParser: {
		parseFile: vi.fn().mockImplementation((filePath) => {
			// Return blocks based on the actual file path
			return [
				{
					content: `content from ${path.basename(filePath)}`,
					file_path: filePath,
					start_line: 1,
					end_line: 10,
					segmentHash: `hash-${path.basename(filePath)}`,
				},
			]
		}),
	},
}))

vi.mock("../../../glob/ignore-utils", () => ({
	isPathInIgnoredDirectory: vi.fn().mockReturnValue(false),
}))

vi.mock("../shared/get-relative-path", () => ({
	generateRelativeFilePath: vi.fn().mockImplementation((filePath, workspacePath) => {
		return path.relative(workspacePath, filePath)
	}),
	generateNormalizedAbsolutePath: vi.fn().mockImplementation((filePath) => filePath),
}))

// Mock vscode
vi.mock("vscode", () => ({
	workspace: {
		createFileSystemWatcher: vi.fn(),
		fs: {
			stat: vi.fn().mockResolvedValue({ size: 1000 }),
			readFile: vi.fn().mockResolvedValue(Buffer.from('{"test": "data"}')),
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
}))

describe("FileWatcher - JSON .rooignore bug", () => {
	let fileWatcher: FileWatcher
	let mockRooIgnoreController: any
	let processFileResult: any

	beforeEach(() => {
		vi.clearAllMocks()

		// Create a simple mock RooIgnoreController
		mockRooIgnoreController = {
			validateAccess: vi.fn(),
		}
	})

	it("should call RooIgnoreController.validateAccess with correct paths for JSON files", async () => {
		const workspacePath = "/workspace"

		// Setup RooIgnoreController to block files in 'ignored' folder
		mockRooIgnoreController.validateAccess.mockImplementation((filePath: string) => {
			// This should receive the full file path
			return !filePath.includes("ignored/")
		})

		// Create FileWatcher with minimal dependencies
		fileWatcher = new FileWatcher(
			workspacePath,
			{} as any, // context
			{
				getHash: vi.fn().mockReturnValue(null),
				updateHash: vi.fn(),
			} as any, // cacheManager
			undefined, // embedder
			undefined, // vectorStore
			{ ignores: vi.fn().mockReturnValue(false) } as any, // ignoreInstance
			mockRooIgnoreController,
		)

		// Test processFile directly with different JSON files
		const testCases = [
			{ path: "/workspace/config.json", shouldProcess: true },
			{ path: "/workspace/ignored/secrets.json", shouldProcess: false },
			{ path: "/workspace/src/data.json", shouldProcess: true },
			{ path: "/workspace/ignored/private.json", shouldProcess: false },
		]

		for (const { path: filePath, shouldProcess } of testCases) {
			const result = await fileWatcher.processFile(filePath)

			// Verify validateAccess was called with the correct path
			expect(mockRooIgnoreController.validateAccess).toHaveBeenCalledWith(filePath)

			if (shouldProcess) {
				expect(result.status).not.toBe("skipped")
				expect(result.reason).not.toBe("File is ignored by .rooignore or .gitignore")
			} else {
				expect(result.status).toBe("skipped")
				expect(result.reason).toBe("File is ignored by .rooignore or .gitignore")
			}
		}

		// Verify validateAccess was called for all test files
		expect(mockRooIgnoreController.validateAccess).toHaveBeenCalledTimes(4)
	})

	it("should handle both .txt and .json files consistently with .rooignore", async () => {
		const workspacePath = "/workspace"

		// Setup RooIgnoreController to block all files in 'blocked' folder
		mockRooIgnoreController.validateAccess.mockImplementation((filePath: string) => {
			return !filePath.includes("/blocked/")
		})

		fileWatcher = new FileWatcher(
			workspacePath,
			{} as any,
			{
				getHash: vi.fn().mockReturnValue(null),
				updateHash: vi.fn(),
			} as any,
			undefined,
			undefined,
			{ ignores: vi.fn().mockReturnValue(false) } as any,
			mockRooIgnoreController,
		)

		// Test with mixed file types
		const mixedFiles = [
			{ path: "/workspace/allowed/data.json", type: "json", shouldProcess: true },
			{ path: "/workspace/allowed/notes.txt", type: "txt", shouldProcess: true },
			{ path: "/workspace/blocked/config.json", type: "json", shouldProcess: false },
			{ path: "/workspace/blocked/readme.txt", type: "txt", shouldProcess: false },
		]

		const results: Record<string, any> = {}

		for (const { path: filePath, type, shouldProcess } of mixedFiles) {
			const result = await fileWatcher.processFile(filePath)
			results[filePath] = result

			// Both JSON and TXT files should be handled the same way
			if (shouldProcess) {
				expect(result.status).not.toBe("skipped")
			} else {
				expect(result.status).toBe("skipped")
				expect(result.reason).toBe("File is ignored by .rooignore or .gitignore")
			}
		}

		// Verify that JSON files are not treated differently than TXT files
		expect(results["/workspace/blocked/config.json"].status).toBe(results["/workspace/blocked/readme.txt"].status)
		expect(results["/workspace/allowed/data.json"].status).toBe(results["/workspace/allowed/notes.txt"].status)
	})
})
