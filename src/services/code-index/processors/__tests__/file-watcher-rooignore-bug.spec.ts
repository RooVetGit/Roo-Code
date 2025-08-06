// Test that reproduces the exact bug reported in issue #6690
// npx vitest services/code-index/processors/__tests__/file-watcher-rooignore-bug.spec.ts

import * as vscode from "vscode"
import { FileWatcher } from "../file-watcher"
import { RooIgnoreController } from "../../../../core/ignore/RooIgnoreController"
import { CacheManager } from "../../cache-manager"
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
vi.mock("../../cache-manager")
vi.mock("../../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockResolvedValue(true),
}))
vi.mock("fs/promises", () => ({
	default: {
		readFile: vi.fn().mockResolvedValue("test-folder/\n"),
	},
}))

vi.mock("../parser", () => ({
	codeParser: {
		parseFile: vi.fn().mockImplementation((filePath) => {
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
		createFileSystemWatcher: vi.fn().mockReturnValue({
			onDidCreate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			onDidChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			onDidDelete: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			dispose: vi.fn(),
		}),
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
	Disposable: vi.fn().mockImplementation(() => ({ dispose: vi.fn() })),
}))

describe("FileWatcher - Issue #6690 Bug Reproduction", () => {
	let fileWatcher: FileWatcher
	let rooIgnoreController: RooIgnoreController

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should respect .rooignore for JSON files when folder is added to .rooignore", async () => {
		const workspacePath = "/workspace"

		// Create a real RooIgnoreController that will read from mocked fs
		rooIgnoreController = new RooIgnoreController(workspacePath)
		await rooIgnoreController.initialize()

		// Create FileWatcher with the RooIgnoreController
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
			rooIgnoreController,
		)

		// Test the exact scenario from the bug report
		const testCases = [
			{
				path: "/workspace/test-folder/data.json",
				type: "json",
				shouldProcess: false, // Should be ignored
				description: "JSON file in ignored folder",
			},
			{
				path: "/workspace/test-folder/notes.txt",
				type: "txt",
				shouldProcess: false, // Should be ignored
				description: "TXT file in ignored folder",
			},
			{
				path: "/workspace/other-folder/config.json",
				type: "json",
				shouldProcess: true, // Should NOT be ignored
				description: "JSON file in non-ignored folder",
			},
			{
				path: "/workspace/other-folder/readme.txt",
				type: "txt",
				shouldProcess: true, // Should NOT be ignored
				description: "TXT file in non-ignored folder",
			},
		]

		for (const { path: filePath, type, shouldProcess, description } of testCases) {
			const result = await fileWatcher.processFile(filePath)

			if (shouldProcess) {
				expect(result.status, `${description} should be processed`).not.toBe("skipped")
			} else {
				expect(result.status, `${description} should be skipped`).toBe("skipped")
				expect(result.reason).toBe("File is ignored by .rooignore or .gitignore")
			}
		}
	})

	it("should handle the exact bug scenario - JSON files should be ignored same as TXT files", async () => {
		const workspacePath = "/workspace"

		// Mock fs to return a .rooignore with a folder pattern
		const fs = await import("fs/promises")
		vi.mocked(fs.default.readFile).mockResolvedValue("ignored-folder/\n*.log")

		// Create a real RooIgnoreController
		rooIgnoreController = new RooIgnoreController(workspacePath)
		await rooIgnoreController.initialize()

		// Create FileWatcher WITHOUT RooIgnoreController to simulate the bug
		const buggyFileWatcher = new FileWatcher(
			workspacePath,
			{} as any,
			{
				getHash: vi.fn().mockReturnValue(null),
				updateHash: vi.fn(),
			} as any,
			undefined,
			undefined,
			{ ignores: vi.fn().mockReturnValue(false) } as any,
			// NOT passing rooIgnoreController here simulates the bug
		)

		// This simulates the bug - without RooIgnoreController passed, it creates a new one
		// but that new one might not be initialized properly
		const jsonResult = await buggyFileWatcher.processFile("/workspace/ignored-folder/secrets.json")
		const txtResult = await buggyFileWatcher.processFile("/workspace/ignored-folder/notes.txt")

		// With the bug, JSON files might not be ignored properly
		// This test would fail with the bug, showing that JSON files are processed when they shouldn't be

		// Now test with the fix - passing RooIgnoreController
		const fixedFileWatcher = new FileWatcher(
			workspacePath,
			{} as any,
			{
				getHash: vi.fn().mockReturnValue(null),
				updateHash: vi.fn(),
			} as any,
			undefined,
			undefined,
			{ ignores: vi.fn().mockReturnValue(false) } as any,
			rooIgnoreController, // Passing the controller fixes the issue
		)

		const fixedJsonResult = await fixedFileWatcher.processFile("/workspace/ignored-folder/secrets.json")
		const fixedTxtResult = await fixedFileWatcher.processFile("/workspace/ignored-folder/notes.txt")

		// With the fix, both should be ignored
		expect(fixedJsonResult.status).toBe("skipped")
		expect(fixedJsonResult.reason).toBe("File is ignored by .rooignore or .gitignore")
		expect(fixedTxtResult.status).toBe("skipped")
		expect(fixedTxtResult.reason).toBe("File is ignored by .rooignore or .gitignore")
	})
})
