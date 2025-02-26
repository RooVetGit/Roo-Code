import * as vscode from "vscode"
import { ClineProviderFactory } from "../ClineProviderFactory"
import { ClineProvider } from "../ClineProvider"
import { ServiceLocator } from "../../ServiceLocator"

// Mock dependencies
jest.mock("vscode")
jest.mock("../ClineProvider")
jest.mock("../../settings/SettingsManager")
jest.mock("../../models/ModelManager")
jest.mock("../../tasks/TaskHistoryManager")
jest.mock("../WebviewManager")
jest.mock("../WebviewMessageHandlers")
jest.mock("../commands/WebviewCommandRegistry")
jest.mock("../../prompts/SystemPromptGenerator")
jest.mock("../../browser/BrowserManager")
jest.mock("../../config/ConfigManager")
jest.mock("../../config/CustomModesManager")
jest.mock("../../ServiceLocator")

describe("ClineProviderFactory", () => {
	let mockContext: vscode.ExtensionContext
	let mockOutputChannel: vscode.OutputChannel
	let mockServiceLocator: any

	beforeEach(() => {
		// Reset mocks
		jest.clearAllMocks()

		// Mock context
		mockContext = {
			extensionPath: "/test/path",
			subscriptions: [],
		} as unknown as vscode.ExtensionContext

		// Mock output channel
		mockOutputChannel = {
			appendLine: jest.fn(),
			clear: jest.fn(),
			dispose: jest.fn(),
		} as unknown as vscode.OutputChannel

		// Mock ServiceLocator
		mockServiceLocator = {
			register: jest.fn(),
		}
		;(ServiceLocator.getInstance as jest.Mock).mockReturnValue(mockServiceLocator)
	})

	test("create returns a ClineProvider instance", () => {
		// Mock ClineProvider constructor
		const mockProvider = {} as ClineProvider
		const mockedClineProvider = ClineProvider as jest.MockedClass<typeof ClineProvider>
		mockedClineProvider.mockImplementation(() => mockProvider)

		// Call the factory method
		const result = ClineProviderFactory.create(mockContext, mockOutputChannel)

		// Verify result
		expect(result).toBe(mockProvider)
		expect(mockedClineProvider).toHaveBeenCalledWith(mockContext, mockOutputChannel)
	})

	test("create registers all dependencies with ServiceLocator", () => {
		// Call the factory method
		ClineProviderFactory.create(mockContext, mockOutputChannel)

		// Verify ServiceLocator.getInstance was called
		expect(ServiceLocator.getInstance).toHaveBeenCalled()

		// Verify all dependencies were registered
		expect(mockServiceLocator.register).toHaveBeenCalledWith("context", mockContext)
		expect(mockServiceLocator.register).toHaveBeenCalledWith("outputChannel", mockOutputChannel)
		expect(mockServiceLocator.register).toHaveBeenCalledWith("settingsManager", expect.anything())
		expect(mockServiceLocator.register).toHaveBeenCalledWith("configManager", expect.anything())
		expect(mockServiceLocator.register).toHaveBeenCalledWith("customModesManager", expect.anything())
		expect(mockServiceLocator.register).toHaveBeenCalledWith("modelManager", expect.anything())
		expect(mockServiceLocator.register).toHaveBeenCalledWith("taskHistoryManager", expect.anything())
		expect(mockServiceLocator.register).toHaveBeenCalledWith("webviewManager", expect.anything())
		expect(mockServiceLocator.register).toHaveBeenCalledWith("commandRegistry", expect.anything())
		expect(mockServiceLocator.register).toHaveBeenCalledWith("systemPromptGenerator", expect.anything())
		expect(mockServiceLocator.register).toHaveBeenCalledWith("browserManager", expect.anything())
		expect(mockServiceLocator.register).toHaveBeenCalledWith("clineProvider", expect.anything())
	})

	test("create initializes all dependencies with correct parameters", () => {
		// Import all mocked constructors
		const { SettingsManager } = require("../../settings/SettingsManager")
		const { ModelManager } = require("../../models/ModelManager")
		const { TaskHistoryManager } = require("../../tasks/TaskHistoryManager")
		const { WebviewManager } = require("../WebviewManager")
		const { WebviewCommandRegistry } = require("../commands/WebviewCommandRegistry")
		const { SystemPromptGenerator } = require("../../prompts/SystemPromptGenerator")
		const { BrowserManager } = require("../../browser/BrowserManager")
		const { ConfigManager } = require("../../config/ConfigManager")
		const { CustomModesManager } = require("../../config/CustomModesManager")

		// Call the factory method
		ClineProviderFactory.create(mockContext, mockOutputChannel)

		// Verify all constructors were called with correct parameters
		expect(SettingsManager).toHaveBeenCalledWith(mockContext)
		expect(ConfigManager).toHaveBeenCalledWith(mockContext)
		expect(CustomModesManager).toHaveBeenCalledWith(mockContext, expect.any(Function))
		expect(ModelManager).toHaveBeenCalledWith(mockContext, mockOutputChannel, expect.anything())
		expect(TaskHistoryManager).toHaveBeenCalledWith(mockContext, expect.anything(), mockOutputChannel)
		expect(WebviewManager).toHaveBeenCalledWith(mockContext, mockOutputChannel)
		expect(WebviewCommandRegistry).toHaveBeenCalled()
		expect(SystemPromptGenerator).toHaveBeenCalledWith(mockContext)
		expect(BrowserManager).toHaveBeenCalledWith(mockContext, mockOutputChannel)
	})
})
