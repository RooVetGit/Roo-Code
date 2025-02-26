import * as vscode from "vscode"
import * as path from "path"
import fs from "fs/promises"
import { Anthropic } from "@anthropic-ai/sdk"
import simpleGit from "simple-git"

import { TaskHistoryManager, GlobalFileNames } from "../TaskHistoryManager"
import { SettingsManager } from "../../settings/SettingsManager"
import { HistoryItem } from "../../../shared/HistoryItem"
import { fileExistsAtPath } from "../../../utils/fs"
import { downloadTask } from "../../../integrations/misc/export-markdown"

// Mock dependencies
jest.mock("vscode")
jest.mock("fs/promises")
jest.mock("simple-git")
jest.mock("../../../utils/fs")
jest.mock("../../../integrations/misc/export-markdown")
jest.mock("../../../utils/logging", () => ({
	logger: {
		debug: jest.fn(),
		error: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
	},
}))

describe("TaskHistoryManager", () => {
	let taskHistoryManager: TaskHistoryManager
	let mockContext: vscode.ExtensionContext
	let mockSettingsManager: SettingsManager
	let mockOutputChannel: vscode.OutputChannel

	beforeEach(() => {
		// Reset mocks
		jest.clearAllMocks()

		// Mock context
		mockContext = {
			extensionPath: "/test/path",
			extensionUri: {} as vscode.Uri,
			globalState: {
				get: jest.fn(),
				update: jest.fn(),
				keys: jest.fn().mockReturnValue([]),
			},
			secrets: {
				get: jest.fn(),
				store: jest.fn(),
				delete: jest.fn(),
			},
			subscriptions: [],
			extension: {
				packageJSON: { version: "1.0.0" },
			},
			globalStorageUri: {
				fsPath: "/test/storage/path",
			},
		} as unknown as vscode.ExtensionContext

		// Mock SettingsManager
		mockSettingsManager = {
			getGlobalState: jest.fn(),
			updateGlobalState: jest.fn(),
			updateTaskHistory: jest.fn(),
		} as unknown as SettingsManager

		// Mock output channel
		mockOutputChannel = {
			appendLine: jest.fn(),
			clear: jest.fn(),
			dispose: jest.fn(),
		} as unknown as vscode.OutputChannel

		// Create TaskHistoryManager instance
		taskHistoryManager = new TaskHistoryManager(mockContext, mockSettingsManager, mockOutputChannel)
	})

	describe("getTaskWithId", () => {
		it("should return task information when task exists", async () => {
			// Mock task history
			const mockTaskHistory: HistoryItem[] = [
				{
					id: "test-task-id",
					ts: 123456789,
					task: "Test task",
					tokensIn: 100,
					tokensOut: 200,
					totalCost: 0.01,
				},
			]
			;(mockSettingsManager.getGlobalState as jest.Mock).mockResolvedValue(mockTaskHistory)

			// Mock file existence check
			;(fileExistsAtPath as jest.Mock).mockResolvedValue(true)

			// Mock file read
			const mockApiConversationHistory = [{ role: "user" as const, content: "Test message" }]
			;(fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockApiConversationHistory))

			// Call the method
			const result = await taskHistoryManager.getTaskWithId("test-task-id")

			// Verify result
			expect(result).toEqual({
				historyItem: mockTaskHistory[0],
				taskDirPath: path.join("/test/storage/path", "tasks", "test-task-id"),
				apiConversationHistoryFilePath: path.join(
					"/test/storage/path",
					"tasks",
					"test-task-id",
					GlobalFileNames.apiConversationHistory,
				),
				uiMessagesFilePath: path.join(
					"/test/storage/path",
					"tasks",
					"test-task-id",
					GlobalFileNames.uiMessages,
				),
				apiConversationHistory: mockApiConversationHistory,
			})

			// Verify mocks were called correctly
			expect(mockSettingsManager.getGlobalState).toHaveBeenCalledWith("taskHistory")
			expect(fileExistsAtPath).toHaveBeenCalledWith(
				path.join("/test/storage/path", "tasks", "test-task-id", GlobalFileNames.apiConversationHistory),
			)
			expect(fs.readFile).toHaveBeenCalledWith(
				path.join("/test/storage/path", "tasks", "test-task-id", GlobalFileNames.apiConversationHistory),
				"utf8",
			)
		})

		it("should throw error and delete task from state when task file doesn't exist", async () => {
			// Mock task history
			const mockTaskHistory: HistoryItem[] = [
				{
					id: "test-task-id",
					ts: 123456789,
					task: "Test task",
					tokensIn: 100,
					tokensOut: 200,
					totalCost: 0.01,
				},
			]
			;(mockSettingsManager.getGlobalState as jest.Mock).mockResolvedValue(mockTaskHistory)

			// Mock file existence check to return false
			;(fileExistsAtPath as jest.Mock).mockResolvedValue(false)

			// Mock deleteTaskFromState
			jest.spyOn(taskHistoryManager, "deleteTaskFromState").mockResolvedValue()

			// Call the method and expect it to throw
			await expect(taskHistoryManager.getTaskWithId("test-task-id")).rejects.toThrow("Task not found")

			// Verify deleteTaskFromState was called
			expect(taskHistoryManager.deleteTaskFromState).toHaveBeenCalledWith("test-task-id")
		})

		it("should throw error when task doesn't exist in history", async () => {
			// Mock empty task history
			;(mockSettingsManager.getGlobalState as jest.Mock).mockResolvedValue([] as HistoryItem[])

			// Mock deleteTaskFromState
			jest.spyOn(taskHistoryManager, "deleteTaskFromState").mockResolvedValue()

			// Call the method and expect it to throw
			await expect(taskHistoryManager.getTaskWithId("test-task-id")).rejects.toThrow("Task not found")

			// Verify deleteTaskFromState was called
			expect(taskHistoryManager.deleteTaskFromState).toHaveBeenCalledWith("test-task-id")
		})
	})

	describe("showTaskWithId", () => {
		it("should return history item for the task", async () => {
			// Mock getTaskWithId
			const mockHistoryItem: HistoryItem = {
				id: "test-task-id",
				ts: 123456789,
				task: "Test task",
				tokensIn: 100,
				tokensOut: 200,
				totalCost: 0.01,
			}
			jest.spyOn(taskHistoryManager, "getTaskWithId").mockResolvedValue({
				historyItem: mockHistoryItem,
				taskDirPath: "/test/path",
				apiConversationHistoryFilePath: "/test/path/api_conversation_history.json",
				uiMessagesFilePath: "/test/path/ui_messages.json",
				apiConversationHistory: [],
			})

			// Call the method
			const result = await taskHistoryManager.showTaskWithId("test-task-id")

			// Verify result
			expect(result).toEqual(mockHistoryItem)

			// Verify getTaskWithId was called
			expect(taskHistoryManager.getTaskWithId).toHaveBeenCalledWith("test-task-id")
		})
	})

	describe("exportTaskWithId", () => {
		it("should export task with the specified ID", async () => {
			// Mock getTaskWithId
			const mockHistoryItem: HistoryItem = {
				id: "test-task-id",
				ts: 123456789,
				task: "Test task",
				tokensIn: 100,
				tokensOut: 200,
				totalCost: 0.01,
			}
			const mockApiConversationHistory = [{ role: "user" as const, content: "Test message" }]
			jest.spyOn(taskHistoryManager, "getTaskWithId").mockResolvedValue({
				historyItem: mockHistoryItem,
				taskDirPath: "/test/path",
				apiConversationHistoryFilePath: "/test/path/api_conversation_history.json",
				uiMessagesFilePath: "/test/path/ui_messages.json",
				apiConversationHistory: mockApiConversationHistory,
			})

			// Call the method
			await taskHistoryManager.exportTaskWithId("test-task-id")

			// Verify downloadTask was called
			expect(downloadTask).toHaveBeenCalledWith(mockHistoryItem.ts, mockApiConversationHistory)
		})
	})

	describe("deleteTaskWithId", () => {
		it("should delete task files and remove from state", async () => {
			// Mock getTaskWithId
			const taskDirPath = "/test/path"
			const apiConversationHistoryFilePath = "/test/path/api_conversation_history.json"
			const uiMessagesFilePath = "/test/path/ui_messages.json"
			jest.spyOn(taskHistoryManager, "getTaskWithId").mockResolvedValue({
				historyItem: {
					id: "test-task-id",
					ts: 123456789,
					task: "Test task",
					tokensIn: 100,
					tokensOut: 200,
					totalCost: 0.01,
				},
				taskDirPath,
				apiConversationHistoryFilePath,
				uiMessagesFilePath,
				apiConversationHistory: [],
			})

			// Mock deleteTaskFromState
			jest.spyOn(taskHistoryManager, "deleteTaskFromState").mockResolvedValue()

			// Mock file existence checks
			;(fileExistsAtPath as jest.Mock).mockImplementation((filePath) => {
				if (filePath === apiConversationHistoryFilePath || filePath === uiMessagesFilePath) {
					return Promise.resolve(true)
				}
				if (filePath === path.join(taskDirPath, "claude_messages.json")) {
					return Promise.resolve(false)
				}
				if (filePath === path.join(taskDirPath, "checkpoints")) {
					return Promise.resolve(false)
				}
				return Promise.resolve(false)
			})

			// Mock settings
			;(mockSettingsManager.getGlobalState as jest.Mock).mockResolvedValue(false) // checkpointsEnabled

			// Call the method
			await taskHistoryManager.deleteTaskWithId("test-task-id")

			// Verify deleteTaskFromState was called
			expect(taskHistoryManager.deleteTaskFromState).toHaveBeenCalledWith("test-task-id")

			// Verify file operations
			expect(fs.unlink).toHaveBeenCalledWith(apiConversationHistoryFilePath)
			expect(fs.unlink).toHaveBeenCalledWith(uiMessagesFilePath)
			expect(fs.rmdir).toHaveBeenCalledWith(taskDirPath)
		})

		it("should delete checkpoints when enabled", async () => {
			// Mock getTaskWithId
			const taskDirPath = "/test/path"
			const apiConversationHistoryFilePath = "/test/path/api_conversation_history.json"
			const uiMessagesFilePath = "/test/path/ui_messages.json"
			const checkpointsDir = path.join(taskDirPath, "checkpoints")
			jest.spyOn(taskHistoryManager, "getTaskWithId").mockResolvedValue({
				historyItem: {
					id: "test-task-id",
					ts: 123456789,
					task: "Test task",
					tokensIn: 100,
					tokensOut: 200,
					totalCost: 0.01,
				},
				taskDirPath,
				apiConversationHistoryFilePath,
				uiMessagesFilePath,
				apiConversationHistory: [],
			})

			// Mock deleteTaskFromState
			jest.spyOn(taskHistoryManager, "deleteTaskFromState").mockResolvedValue()

			// Mock file existence checks
			;(fileExistsAtPath as jest.Mock).mockImplementation((filePath) => {
				if (filePath === apiConversationHistoryFilePath || filePath === uiMessagesFilePath) {
					return Promise.resolve(true)
				}
				if (filePath === path.join(taskDirPath, "claude_messages.json")) {
					return Promise.resolve(false)
				}
				if (filePath === checkpointsDir) {
					return Promise.resolve(true)
				}
				return Promise.resolve(false)
			})

			// Mock settings
			;(mockSettingsManager.getGlobalState as jest.Mock).mockResolvedValue(true) // checkpointsEnabled

			// Mock workspace folders
			;(vscode.workspace.workspaceFolders as any) = [{ uri: { fsPath: "/workspace" } }]

			// Mock simpleGit
			;(simpleGit as jest.Mock).mockReturnValue({
				branch: jest.fn().mockResolvedValue({ all: [] }),
			})

			// Call the method
			await taskHistoryManager.deleteTaskWithId("test-task-id")

			// Verify deleteTaskFromState was called
			expect(taskHistoryManager.deleteTaskFromState).toHaveBeenCalledWith("test-task-id")

			// Verify file operations
			expect(fs.unlink).toHaveBeenCalledWith(apiConversationHistoryFilePath)
			expect(fs.unlink).toHaveBeenCalledWith(uiMessagesFilePath)
			expect(fs.rm).toHaveBeenCalledWith(checkpointsDir, { recursive: true, force: true })
			expect(fs.rmdir).toHaveBeenCalledWith(taskDirPath)

			// Verify git operations
			expect(simpleGit).toHaveBeenCalledWith("/workspace")
			expect(simpleGit().branch).toHaveBeenCalledWith(["-D", "roo-code-checkpoints-test-task-id"])
		})
	})

	describe("deleteTaskFromState", () => {
		it("should remove task from history state", async () => {
			// Mock task history
			const mockTaskHistory: HistoryItem[] = [
				{
					id: "test-task-id",
					ts: 123456789,
					task: "Test task",
					tokensIn: 100,
					tokensOut: 200,
					totalCost: 0.01,
				},
				{
					id: "other-task-id",
					ts: 987654321,
					task: "Other task",
					tokensIn: 150,
					tokensOut: 250,
					totalCost: 0.02,
				},
			]
			;(mockSettingsManager.getGlobalState as jest.Mock).mockResolvedValue(mockTaskHistory)

			// Call the method
			await taskHistoryManager.deleteTaskFromState("test-task-id")

			// Verify updateGlobalState was called with filtered history
			expect(mockSettingsManager.updateGlobalState).toHaveBeenCalledWith("taskHistory", [
				{
					id: "other-task-id",
					ts: 987654321,
					task: "Other task",
					tokensIn: 150,
					tokensOut: 250,
					totalCost: 0.02,
				},
			])
		})
	})

	describe("updateTaskHistory", () => {
		it("should delegate to settingsManager.updateTaskHistory", async () => {
			// Mock history item
			const mockHistoryItem: HistoryItem = {
				id: "test-task-id",
				ts: 123456789,
				task: "Test task",
				tokensIn: 100,
				tokensOut: 200,
				totalCost: 0.01,
			}

			// Mock updateTaskHistory
			const mockUpdatedHistory: HistoryItem[] = [mockHistoryItem]
			;(mockSettingsManager.updateTaskHistory as jest.Mock).mockResolvedValue(mockUpdatedHistory)

			// Call the method
			const result = await taskHistoryManager.updateTaskHistory(mockHistoryItem)

			// Verify result
			expect(result).toEqual(mockUpdatedHistory)

			// Verify updateTaskHistory was called
			expect(mockSettingsManager.updateTaskHistory).toHaveBeenCalledWith(mockHistoryItem)
		})
	})
})
