import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as vscode from "vscode"
import WorkspaceTracker from "../WorkspaceTracker"
import { ClineProvider } from "../../../core/webview/ClineProvider"

// Mock vscode module
vi.mock("vscode", () => ({
	workspace: {
		createFileSystemWatcher: vi.fn(),
		fs: {
			stat: vi.fn(),
		},
	},
	window: {
		tabGroups: {
			all: [],
			onDidChangeTabs: vi.fn(() => ({ dispose: vi.fn() })),
		},
	},
	FileType: {
		Directory: 2,
	},
	Uri: {
		file: vi.fn((path) => ({ fsPath: path })),
	},
}))

// Mock dependencies
vi.mock("../../../services/glob/list-files", () => ({
	listFiles: vi.fn().mockResolvedValue([[], false]),
}))

vi.mock("../../../utils/path", () => ({
	toRelativePath: vi.fn((path) => path),
	getWorkspacePath: vi.fn().mockReturnValue(""), // Empty workspace path
}))

describe("WorkspaceTracker with no workspace", () => {
	let mockProvider: ClineProvider
	let workspaceTracker: WorkspaceTracker

	beforeEach(() => {
		vi.clearAllMocks()
		vi.useFakeTimers()
		mockProvider = {
			postMessageToWebview: vi.fn(),
		} as any
	})

	afterEach(() => {
		if (workspaceTracker) {
			workspaceTracker.dispose()
		}
		vi.useRealTimers()
	})

	it("should not create file watcher when workspace is empty", () => {
		// Create tracker with empty workspace
		workspaceTracker = new WorkspaceTracker(mockProvider)

		// Verify that createFileSystemWatcher was NOT called
		expect(vscode.workspace.createFileSystemWatcher).not.toHaveBeenCalled()
	})

	it("should handle initialization without hanging", async () => {
		// Create tracker
		workspaceTracker = new WorkspaceTracker(mockProvider)

		// Initialize file paths (should return early)
		await workspaceTracker.initializeFilePaths()

		// Verify no workspace update was sent
		expect(mockProvider.postMessageToWebview).not.toHaveBeenCalled()
	})

	it("should still register tab change listener even without workspace", () => {
		// Create tracker
		workspaceTracker = new WorkspaceTracker(mockProvider)

		// Verify tab change listener was registered
		expect(vscode.window.tabGroups.onDidChangeTabs).toHaveBeenCalled()
	})

	it("should handle workspaceDidUpdate gracefully when workspace is empty", () => {
		// Create tracker
		workspaceTracker = new WorkspaceTracker(mockProvider)

		// Manually trigger workspaceDidUpdate (simulating internal call)
		// This is a private method, so we need to trigger it indirectly
		const tabChangeCallback = (vscode.window.tabGroups.onDidChangeTabs as any).mock.calls[0][0]
		tabChangeCallback()

		// Wait for debounce
		vi.advanceTimersByTime(300)

		// Verify no message was sent (because workspace is empty)
		expect(mockProvider.postMessageToWebview).not.toHaveBeenCalled()
	})
})
