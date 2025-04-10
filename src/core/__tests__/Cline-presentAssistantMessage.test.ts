// npx jest src/core/__tests__/Cline-presentAssistantMessage.test.ts

import { describe, expect, it, jest, beforeEach } from "@jest/globals"
import { Cline } from "../Cline"
import { ToolExecutor } from "../tools/ToolExecutor"
import { formatResponse } from "../prompts/responses"
import { validateToolUse } from "../mode-validator"
import { ClineProvider } from "../webview/ClineProvider"
import * as vscode from "vscode"

// Mock dependencies
jest.mock("../tools/ToolExecutor")
jest.mock("../prompts/responses")
jest.mock("../mode-validator")
jest.mock("../webview/ClineProvider")
jest.mock("delay", () => jest.fn().mockResolvedValue(undefined))

describe("Cline presentAssistantMessage with ToolExecutor", () => {
	let cline: Cline
	let mockProvider: jest.Mocked<ClineProvider>
	let mockOutputChannel: any
	let mockExtensionContext: vscode.ExtensionContext
	let mockToolExecutor: jest.Mocked<ToolExecutor>

	beforeEach(() => {
		// Reset mocks
		jest.clearAllMocks()

		// Setup mock extension context
		mockExtensionContext = {
			subscriptions: [],
			extensionUri: { fsPath: "/test" },
			extensionPath: "/test",
			storageUri: { fsPath: "/test/storage" },
			globalStorageUri: { fsPath: "/test/global-storage" },
			logUri: { fsPath: "/test/log" },
			extensionMode: vscode.ExtensionMode.Development,
			environmentVariableCollection: {} as any,
			asAbsolutePath: jest.fn().mockImplementation((relativePath) => `/test/${relativePath}`),
			storagePath: "/test/storage",
			globalStoragePath: "/test/global-storage",
			logPath: "/test/log",
			workspaceState: {
				get: jest.fn(),
				update: jest.fn(),
				keys: jest.fn().mockReturnValue([]),
			} as any,
			globalState: {
				get: jest.fn(),
				update: jest.fn(),
				setKeysForSync: jest.fn(),
				keys: jest.fn().mockReturnValue([]),
			} as any,
			secrets: {
				get: jest.fn(),
				store: jest.fn(),
				delete: jest.fn(),
			} as any,
		}

		// Setup mock output channel
		mockOutputChannel = { appendLine: jest.fn() } as unknown as vscode.OutputChannel

		// Setup mock provider
		mockProvider = new ClineProvider(mockExtensionContext, mockOutputChannel) as jest.Mocked<ClineProvider>
		mockProvider.getState = jest.fn().mockResolvedValue({
			apiConfiguration: {
				apiProvider: "anthropic",
				apiModelId: "claude-3-5-sonnet-20241022",
				apiKey: "test-api-key",
			},
			mode: "code",
			customModes: [],
		})
		mockProvider.postMessageToWebview = jest.fn().mockResolvedValue(undefined)
		mockProvider.postStateToWebview = jest.fn().mockResolvedValue(undefined)

		// Setup mock ToolExecutor
		mockToolExecutor = new ToolExecutor() as jest.Mocked<ToolExecutor>
		mockToolExecutor.executeToolUse = jest.fn().mockResolvedValue(true)
		;(ToolExecutor as unknown as jest.Mock).mockImplementation(() => mockToolExecutor)

		// Create Cline instance with minimal required properties
		cline = new Cline({
			provider: mockProvider,
			apiConfiguration: {
				apiProvider: "anthropic",
				apiModelId: "claude-3-5-sonnet-20241022",
				apiKey: "test-api-key",
			},
			task: "test task",
			startTask: false,
		})

		// Mock methods and properties needed for presentAssistantMessage
		cline.say = jest.fn().mockResolvedValue(undefined)
		cline.ask = jest.fn().mockResolvedValue({ response: "yesButtonClicked" })
		cline.userMessageContent = []
		cline.assistantMessageContent = []
		cline.didRejectTool = false
		cline.didAlreadyUseTool = false
		cline.userMessageContentReady = false
		cline.presentAssistantMessageLocked = false
		cline.presentAssistantMessageHasPendingUpdates = false
		cline.currentStreamingContentIndex = 0
		cline.didCompleteReadingStream = false
		cline.browserSession = {
			closeBrowser: jest.fn().mockResolvedValue(undefined),
		} as any
		cline.checkpointSave = jest.fn()
	})

	describe("presentAssistantMessage", () => {
		it("should handle text content blocks", async () => {
			// Setup
			cline.assistantMessageContent = [
				{
					type: "text",
					content: "Test message",
					partial: false,
				},
			]

			// Execute
			await cline.presentAssistantMessage()

			// Verify
			expect(cline.say).toHaveBeenCalledWith("text", "Test message", undefined, false)
			expect(cline.userMessageContentReady).toBe(true)
			expect(cline.currentStreamingContentIndex).toBe(1)
		})

		it("should use ToolExecutor for tool_use blocks", async () => {
			// Setup
			const toolUseBlock = {
				type: "tool_use",
				name: "read_file",
				params: {
					path: "test.txt",
				},
				partial: false,
			}
			cline.assistantMessageContent = [toolUseBlock]

			// Execute
			await cline.presentAssistantMessage()

			// Verify
			expect(mockToolExecutor.executeToolUse).toHaveBeenCalledWith(
				cline,
				toolUseBlock,
				expect.any(Function), // askApproval
				expect.any(Function), // handleError
				expect.any(Function), // pushToolResult
				expect.any(Function), // removeClosingTag
				expect.any(Function), // toolDescription
				expect.any(Function), // askFinishSubTaskApproval
			)
			expect(cline.userMessageContentReady).toBe(true)
			expect(cline.currentStreamingContentIndex).toBe(1)
			expect(cline.browserSession.closeBrowser).toHaveBeenCalled()
		})

		it("should skip tool execution if a tool was already used", async () => {
			// Setup
			cline.didAlreadyUseTool = true
			cline.assistantMessageContent = [
				{
					type: "tool_use",
					name: "read_file",
					params: {
						path: "test.txt",
					},
					partial: false,
				},
			]

			// Execute
			await cline.presentAssistantMessage()

			// Verify
			expect(mockToolExecutor.executeToolUse).not.toHaveBeenCalled()
			expect(cline.userMessageContent).toHaveLength(1)
			expect(cline.userMessageContent[0]).toEqual({
				type: "text",
				text: expect.stringContaining("Tool [read_file] was not executed because a tool has already been used"),
			})
		})

		it("should skip tool execution if a tool was rejected", async () => {
			// Setup
			cline.didRejectTool = true
			cline.assistantMessageContent = [
				{
					type: "tool_use",
					name: "read_file",
					params: {
						path: "test.txt",
					},
					partial: false,
				},
			]

			// Execute
			await cline.presentAssistantMessage()

			// Verify
			expect(mockToolExecutor.executeToolUse).not.toHaveBeenCalled()
			expect(cline.userMessageContent).toHaveLength(1)
			expect(cline.userMessageContent[0]).toEqual({
				type: "text",
				text: expect.stringContaining("Skipping tool"),
			})
		})

		it("should call checkpointSave when a tool is executed", async () => {
			// Setup
			cline.assistantMessageContent = [
				{
					type: "tool_use",
					name: "read_file",
					params: {
						path: "test.txt",
					},
					partial: false,
				},
			]

			// Mock pushToolResult to set isCheckpointPossible to true
			mockToolExecutor.executeToolUse.mockImplementation(
				async (cline, block, askApproval, handleError, pushToolResult) => {
					pushToolResult("Tool result")
					return true
				},
			)

			// Execute
			await cline.presentAssistantMessage()

			// Verify
			expect(cline.checkpointSave).toHaveBeenCalled()
		})

		it("should handle partial tool_use blocks", async () => {
			// Setup
			cline.assistantMessageContent = [
				{
					type: "tool_use",
					name: "read_file",
					params: {
						path: "test.txt",
					},
					partial: true,
				},
			]

			// Execute
			await cline.presentAssistantMessage()

			// Verify
			expect(mockToolExecutor.executeToolUse).toHaveBeenCalled()
			expect(cline.userMessageContentReady).toBe(false)
			expect(cline.currentStreamingContentIndex).toBe(0)
		})

		it("should handle multiple content blocks", async () => {
			// Setup
			cline.assistantMessageContent = [
				{
					type: "text",
					content: "First message",
					partial: false,
				},
				{
					type: "tool_use",
					name: "read_file",
					params: {
						path: "test.txt",
					},
					partial: false,
				},
			]

			// Execute
			await cline.presentAssistantMessage()

			// Verify
			expect(cline.say).toHaveBeenCalledWith("text", "First message", undefined, false)
			expect(cline.currentStreamingContentIndex).toBe(1)
			expect(cline.userMessageContentReady).toBe(false)

			// Execute again to process the second block
			await cline.presentAssistantMessage()

			// Verify
			expect(mockToolExecutor.executeToolUse).toHaveBeenCalled()
			expect(cline.currentStreamingContentIndex).toBe(2)
			expect(cline.userMessageContentReady).toBe(true)
		})
	})
})
