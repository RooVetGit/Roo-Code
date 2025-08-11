import { exportTask, importTask, exportTaskToCloud } from "../sharing"
import { vi, describe, it, expect, beforeEach } from "vitest"
import * as vscode from "vscode"

vi.mock("vscode", () => ({
	window: {
		showSaveDialog: vi.fn(),
		showOpenDialog: vi.fn(),
		showInformationMessage: vi.fn(),
		showErrorMessage: vi.fn(),
	},
	workspace: {
		fs: {
			writeFile: vi.fn(),
			readFile: vi.fn(),
		},
	},
	Uri: {
		file: vi.fn((path) => ({ fsPath: path })),
	},
}))

describe("Task Sharing Service", () => {
	const mockTask = {
		id: "test-task-id",
		task: "Test Task",
		number: 1,
		ts: Date.now(),
		tokensIn: 10,
		tokensOut: 20,
		totalCost: 0.01,
	}
	const mockGlobalStoragePath = "/fake/storage/path"

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("exportTask", () => {
		it("should export a task to a JSON file", async () => {
			const mockUri = vscode.Uri.file("/fake/export/path.json")
			vi.mocked(vscode.window.showSaveDialog).mockResolvedValue(mockUri)

			await exportTask(mockTask, mockGlobalStoragePath)

			expect(vscode.window.showSaveDialog).toHaveBeenCalled()
			expect(vscode.workspace.fs.writeFile).toHaveBeenCalled()
			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(`Task exported to ${mockUri.fsPath}`)
		})

		it("should handle cancellation of save dialog", async () => {
			vi.mocked(vscode.window.showSaveDialog).mockResolvedValue(undefined)

			await exportTask(mockTask, mockGlobalStoragePath)

			expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled()
		})
	})

	describe("importTask", () => {
		it("should import a task from a JSON file", async () => {
			const mockUri = vscode.Uri.file("/fake/import/path.json")
			const mockSession = {
				version: "1.0.0",
				task: mockTask,
				messages: [],
			}
			vi.mocked(vscode.window.showOpenDialog).mockResolvedValue([mockUri])
			vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(Buffer.from(JSON.stringify(mockSession)))

			await importTask(mockGlobalStoragePath)

			expect(vscode.window.showOpenDialog).toHaveBeenCalled()
			expect(vscode.workspace.fs.readFile).toHaveBeenCalledWith(mockUri)
			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
				`Task "${mockTask.task}" imported successfully.`,
			)
		})

		it("should handle cancellation of open dialog", async () => {
			vi.mocked(vscode.window.showOpenDialog).mockResolvedValue(undefined)

			await importTask(mockGlobalStoragePath)

			expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled()
		})

		it("should show error for invalid file format", async () => {
			const mockUri = vscode.Uri.file("/fake/import/path.json")
			vi.mocked(vscode.window.showOpenDialog).mockResolvedValue([mockUri])
			vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(Buffer.from(JSON.stringify({ invalid: "data" })))

			await importTask(mockGlobalStoragePath)

			expect(vscode.window.showErrorMessage).toHaveBeenCalled()
		})
	})

	describe("exportTaskToCloud", () => {
		beforeEach(() => {
			// Mock the global fetch function
			global.fetch = vi.fn(() =>
				Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve({ id: "test-session-id", url: "https://example.com/s/test-session-id" }),
					text: () => Promise.resolve(""),
				}),
			) as any

			// Mock VS Code configuration
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
				get: vi.fn().mockReturnValue("https://test.syntx.dev"),
			} as any)
		})

		it("should include Syntx-Api-Key header when a token is provided", async () => {
			const token = "test-api-key"

			await exportTaskToCloud(mockTask, mockGlobalStoragePath, { token })

			expect(global.fetch).toHaveBeenCalledWith(
				"https://test.syntx.dev/api/sessions",
				expect.objectContaining({
					headers: expect.objectContaining({
						"Syntx-Api-Key": token,
					}),
				}),
			)
		})
	})
})
