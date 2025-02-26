import * as vscode from "vscode"
import { WebviewMessageHandlers } from "../WebviewMessageHandlers"
import { ClineProviderInterface } from "../ClineProviderInterface"
import { WebviewMessage } from "../../../shared/WebviewMessage"
import { experimentDefault } from "../../../shared/experiments"

// Mock dependencies
jest.mock("vscode")
jest.mock("../../../integrations/theme/getTheme", () => ({
	getTheme: jest.fn().mockResolvedValue({ name: "Default Dark Modern", type: "dark" }),
}))

describe("WebviewMessageHandlers", () => {
	let mockProvider: ClineProviderInterface
	let handlers: WebviewMessageHandlers

	beforeEach(() => {
		// Create a mock provider that implements ClineProviderInterface
		mockProvider = {
			context: {} as vscode.ExtensionContext,
			outputChannel: {} as vscode.OutputChannel,
			experimentDefault,
			isViewLaunched: false,
			latestAnnouncementId: "test-announcement",

			// Methods
			postStateToWebview: jest.fn(),
			postMessageToWebview: jest.fn(),
			getMcpHub: jest.fn().mockReturnValue({
				getAllServers: jest.fn().mockReturnValue([]),
			}),
			getState: jest.fn().mockResolvedValue({
				apiConfiguration: {},
				customModePrompts: {},
				customInstructions: "",
				preferredLanguage: "English",
				browserViewportSize: "900x600",
				diffEnabled: true,
				mcpEnabled: true,
				fuzzyMatchThreshold: 1.0,
				experiments: {},
				enableMcpServerCreation: true,
			}),
			updateApiConfiguration: jest.fn(),
			initClineWithTask: jest.fn(),
			initClineWithHistoryItem: jest.fn(),
			clearTask: jest.fn(),
			cancelTask: jest.fn(),
			updateCustomInstructions: jest.fn(),
			handleModeSwitch: jest.fn(),
			resetState: jest.fn(),
			getDiffStrategy: jest.fn(),
			getSystemPrompt: jest.fn().mockResolvedValue("System prompt"),

			// Managers
			settingsManager: {
				updateGlobalState: jest.fn(),
				getGlobalState: jest.fn(),
			} as any,
			customModesManager: {
				getCustomModes: jest.fn().mockResolvedValue([]),
				getCustomModesFilePath: jest.fn().mockResolvedValue("path/to/custom/modes"),
			} as any,
			modelManager: {
				readOpenRouterModels: jest.fn().mockResolvedValue({}),
				refreshOpenRouterModels: jest.fn().mockResolvedValue({}),
				readGlamaModels: jest.fn().mockResolvedValue({}),
				refreshGlamaModels: jest.fn().mockResolvedValue({}),
				readUnboundModels: jest.fn().mockResolvedValue({}),
				refreshUnboundModels: jest.fn().mockResolvedValue({}),
				readRequestyModels: jest.fn().mockResolvedValue({}),
				refreshRequestyModels: jest.fn().mockResolvedValue({}),
			} as any,
			configManager: {
				listConfig: jest.fn().mockResolvedValue([]),
				hasConfig: jest.fn().mockResolvedValue(true),
				loadConfig: jest.fn().mockResolvedValue({}),
				saveConfig: jest.fn(),
				deleteConfig: jest.fn(),
			} as any,
			taskHistoryManager: {
				getTaskWithId: jest.fn().mockResolvedValue({ historyItem: {} }),
				showTaskWithId: jest.fn(),
				exportTaskWithId: jest.fn(),
				deleteTaskWithId: jest.fn(),
			} as any,

			// Optional properties
			cline: undefined,
			view: undefined,
			workspaceTracker: undefined,
			browserManager: {
				urlContentFetcher: {
					launchBrowser: jest.fn(),
					closeBrowser: jest.fn(),
					urlToMarkdown: jest.fn(),
				},
				fetchUrlContent: jest.fn(),
			} as any,
		}

		// Create the handlers instance
		handlers = new WebviewMessageHandlers(mockProvider)
	})

	describe("handleWebviewInitialization", () => {
		it("should handle webviewDidLaunch message", async () => {
			const message: WebviewMessage = { type: "webviewDidLaunch" }

			await handlers.handleWebviewInitialization(message)

			expect(mockProvider.customModesManager.getCustomModes).toHaveBeenCalled()
			expect(mockProvider.settingsManager.updateGlobalState).toHaveBeenCalledWith("customModes", [])
			expect(mockProvider.postStateToWebview).toHaveBeenCalled()
		})

		it("should handle didShowAnnouncement message", async () => {
			const message: WebviewMessage = { type: "didShowAnnouncement" }
			mockProvider.latestAnnouncementId = "test-announcement"

			await handlers.handleWebviewInitialization(message)

			expect(mockProvider.settingsManager.updateGlobalState).toHaveBeenCalledWith(
				"lastShownAnnouncementId",
				"test-announcement",
			)
			expect(mockProvider.postStateToWebview).toHaveBeenCalled()
		})
	})

	describe("handleTaskMessages", () => {
		it("should handle newTask message", async () => {
			const message: WebviewMessage = {
				type: "newTask",
				text: "Test task",
				images: ["image1.png"],
			}
			mockProvider.initClineWithTask = jest.fn()

			await handlers.handleTaskMessages(message)

			expect(mockProvider.initClineWithTask).toHaveBeenCalledWith("Test task", ["image1.png"])
		})

		it("should handle clearTask message", async () => {
			const message: WebviewMessage = { type: "clearTask" }
			mockProvider.clearTask = jest.fn()

			await handlers.handleTaskMessages(message)

			expect(mockProvider.clearTask).toHaveBeenCalled()
			expect(mockProvider.postStateToWebview).toHaveBeenCalled()
		})
	})

	describe("handleSettingsMessages", () => {
		it("should handle customInstructions message", async () => {
			const message: WebviewMessage = {
				type: "customInstructions",
				text: "Custom instructions",
			}
			mockProvider.updateCustomInstructions = jest.fn()

			await handlers.handleSettingsMessages(message)

			expect(mockProvider.updateCustomInstructions).toHaveBeenCalledWith("Custom instructions")
		})

		it("should handle alwaysAllowReadOnly message", async () => {
			const message: WebviewMessage = {
				type: "alwaysAllowReadOnly",
				bool: true,
			}

			await handlers.handleSettingsMessages(message)

			expect(mockProvider.settingsManager.updateGlobalState).toHaveBeenCalledWith("alwaysAllowReadOnly", true)
			expect(mockProvider.postStateToWebview).toHaveBeenCalled()
		})
	})

	// Add more test cases for other handler methods as needed
})
