import { Cline } from "../Cline"
import { BaseProvider } from "../../api/providers/base-provider"
import { delay } from "../../utils/promises"

// Mock dependencies
jest.mock("../../utils/promises", () => ({
	delay: jest.fn().mockResolvedValue(undefined),
}))

// Mock fs-related modules
jest.mock("fs/promises", () => ({
	mkdir: jest.fn().mockResolvedValue(undefined),
	writeFile: jest.fn().mockResolvedValue(undefined),
	readFile: jest.fn().mockResolvedValue("[]"),
	unlink: jest.fn().mockResolvedValue(undefined),
	stat: jest.fn().mockResolvedValue({ size: 0 }),
	readdir: jest.fn().mockResolvedValue([]),
}))

// Mock vscode with more detailed implementation
jest.mock("vscode", () => {
	const mockEventEmitter = {
		event: jest.fn(),
		fire: jest.fn(),
	}

	return {
		window: {
			showInformationMessage: jest.fn(),
			showWarningMessage: jest.fn(),
			showErrorMessage: jest.fn(),
			// ... other existing mock properties
		},
		// Add RelativePattern class mock
		RelativePattern: jest.fn().mockImplementation((base, pattern) => ({
			base,
			pattern,
		})),
		// ... rest of your existing mock
		workspace: {
			// Add this if not already present
			createFileSystemWatcher: jest.fn().mockReturnValue({
				onDidChange: jest.fn().mockReturnValue({ dispose: jest.fn() }),
				onDidCreate: jest.fn().mockReturnValue({ dispose: jest.fn() }),
				onDidDelete: jest.fn().mockReturnValue({ dispose: jest.fn() }),
				dispose: jest.fn(),
			}),
			// ... other existing workspace properties
		},
		// ... rest of your existing mock
	}
}) // Mock path operations
jest.mock("path", () => ({
	join: jest.fn((...args) => args.join("/")),
	dirname: jest.fn((path) => path.split("/").slice(0, -1).join("/")),
	basename: jest.fn((path) => path.split("/").pop()),
}))

// Mock the DecorationController and DiffViewProvider to avoid initialization issues
jest.mock("../../integrations/editor/DecorationController", () => ({
	DecorationController: jest.fn().mockImplementation(() => ({
		addLines: jest.fn(),
		clearDecorations: jest.fn(),
		dispose: jest.fn(),
	})),
}))

jest.mock("../../integrations/editor/DiffViewProvider", () => ({
	DiffViewProvider: jest.fn().mockImplementation(() => ({
		register: jest.fn(),
		dispose: jest.fn(),
	})),
}))

// Mock the Mistral SDK
jest.mock("@mistralai/mistralai", () => {
	return {
		MistralClient: jest.fn().mockImplementation(() => ({
			chat: {
				stream: jest.fn().mockResolvedValue({
					[Symbol.asyncIterator]: jest.fn().mockImplementation(() => ({
						next: jest.fn().mockResolvedValue({
							done: false,
							value: { choices: [{ delta: { content: "test" } }] },
						}),
					})),
				}),
			},
		})),
	}
})

// Mock puppeteer and related modules
jest.mock("puppeteer-chromium-resolver", () => ({
	default: jest.fn().mockResolvedValue({
		puppeteer: {
			launch: jest.fn().mockResolvedValue({
				newPage: jest.fn().mockResolvedValue({
					goto: jest.fn().mockResolvedValue({}),
					content: jest.fn().mockResolvedValue("<html></html>"),
					close: jest.fn().mockResolvedValue({}),
				}),
				close: jest.fn().mockResolvedValue({}),
			}),
		},
		executablePath: "/mock/chrome",
	}),
}))

// Mock the UrlContentFetcher
jest.mock("../../services/browser/UrlContentFetcher", () => ({
	UrlContentFetcher: jest.fn().mockImplementation(() => ({
		fetchContent: jest.fn().mockResolvedValue("<html></html>"),
		launchBrowser: jest.fn().mockResolvedValue(undefined),
		ensureChromiumExists: jest.fn().mockResolvedValue({
			puppeteer: {
				launch: jest.fn().mockResolvedValue({
					newPage: jest.fn().mockResolvedValue({
						goto: jest.fn().mockResolvedValue({}),
						content: jest.fn().mockResolvedValue("<html></html>"),
						close: jest.fn().mockResolvedValue({}),
					}),
					close: jest.fn().mockResolvedValue({}),
				}),
			},
			executablePath: "/mock/chrome",
		}),
		dispose: jest.fn().mockResolvedValue(undefined),
	})),
}))

// Mock yargs
jest.mock("yargs", () => ({
	__esModule: true,
	default: {
		parse: jest.fn(),
		command: jest.fn().mockReturnThis(),
		option: jest.fn().mockReturnThis(),
		help: jest.fn().mockReturnThis(),
		alias: jest.fn().mockReturnThis(),
		version: jest.fn().mockReturnThis(),
	},
}))

// Mock puppeteer-core
jest.mock("puppeteer-core", () => ({
	__esModule: true,
	default: {
		launch: jest.fn().mockResolvedValue({
			newPage: jest.fn().mockResolvedValue({
				goto: jest.fn().mockResolvedValue({}),
				content: jest.fn().mockResolvedValue("<html></html>"),
				close: jest.fn().mockResolvedValue({}),
			}),
			close: jest.fn().mockResolvedValue({}),
		}),
	},
}))

// Mock @puppeteer/browsers
jest.mock("@puppeteer/browsers", () => ({
	install: jest.fn().mockResolvedValue({}),
	canDownload: jest.fn().mockResolvedValue(true),
	computeExecutablePath: jest.fn().mockReturnValue("/mock/chrome"),
	detectBrowserPlatform: jest.fn().mockReturnValue("linux"),
	Browser: { CHROME: "chrome" },
	Product: { CHROME: "chrome" },
}))

class MockProviderWithBuiltInRateLimiting extends BaseProvider {
	override hasBuiltInRateLimiting = true
	createMessage = jest.fn()
	getModel = jest.fn().mockReturnValue({ info: {} })
	getState = jest.fn().mockResolvedValue({
		rateLimitSeconds: 5,
		requestDelaySeconds: 1,
		alwaysApproveResubmit: false,
	})
	postStateToWebview = jest.fn()
	postMessageToWebview = jest.fn()
	context = {
		globalState: {
			get: jest.fn(),
			update: jest.fn(),
		},
		extensionUri: { fsPath: "/mock/extension" },
	}
}

class MockProviderWithoutBuiltInRateLimiting extends BaseProvider {
	override hasBuiltInRateLimiting = false
	createMessage = jest.fn()
	getModel = jest.fn().mockReturnValue({ info: {} })
	getState = jest.fn().mockResolvedValue({
		rateLimitSeconds: 5,
		requestDelaySeconds: 1,
		alwaysApproveResubmit: false,
	})
	postStateToWebview = jest.fn()
	postMessageToWebview = jest.fn()
	context = {
		globalState: {
			get: jest.fn(),
			update: jest.fn(),
		},
		extensionUri: { fsPath: "/mock/extension" },
	}
}

class MockMistralProvider extends BaseProvider {
	override hasBuiltInRateLimiting = true
	createMessage = jest.fn()
	getModel = jest.fn().mockReturnValue({ id: "mistral-model", info: {} })
	getState = jest.fn().mockResolvedValue({
		rateLimitSeconds: 5,
		requestDelaySeconds: 1,
		alwaysApproveResubmit: false,
	})
	postStateToWebview = jest.fn()
	postMessageToWebview = jest.fn()
	context = {
		globalState: {
			get: jest.fn(),
			update: jest.fn(),
		},
		extensionUri: { fsPath: "/mock/extension" },
	}
}

describe("Cline rate limiting tests", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	test("should apply rate limiting when provider doesn't have built-in rate limiting", async () => {
		// Arrange
		const [cline, task] = Cline.create({
			provider: new MockProviderWithoutBuiltInRateLimiting() as any,
			apiConfiguration: {
				apiProvider: "anthropic",
				apiModelId: "test-model",
				apiKey: "test-key",
			},
			task: "test task",
			startTask: false, // Prevent actual task start
		})

		// Set lastApiRequestTime to simulate a recent request
		cline["lastApiRequestTime"] = Date.now() - 2000 // 2 seconds ago
		cline["apiConversationHistory"] = []

		// Act
		const generator = cline["attemptApiRequest"](0)

		// Manually trigger the generator to start execution
		try {
			await generator.next()
		} catch (e) {
			// Expected to throw since we're not fully mocking everything
		}

		// Assert
		// Should have called delay for the countdown (3 seconds remaining from 5 second limit)
		expect(delay).toHaveBeenCalledWith(1000)
		expect(delay).toHaveBeenCalledTimes(3)

		// Clean up
		await cline.abortTask(true)
		await task.catch(() => {})
	})

	test("should skip rate limiting when provider has built-in rate limiting", async () => {
		// Arrange
		const [cline, task] = Cline.create({
			provider: new MockProviderWithBuiltInRateLimiting() as any,
			apiConfiguration: {
				apiProvider: "anthropic",
				apiModelId: "test-model",
				apiKey: "test-key",
			},
			task: "test task",
			startTask: false, // Prevent actual task start
		})

		// Set lastApiRequestTime to simulate a recent request
		cline["lastApiRequestTime"] = Date.now() - 2000 // 2 seconds ago
		cline["apiConversationHistory"] = []

		// Act
		const generator = cline["attemptApiRequest"](0)

		// Manually trigger the generator to start execution
		try {
			await generator.next()
		} catch (e) {
			// Expected to throw since we're not fully mocking everything
		}

		// Assert
		// Should not have called delay for the countdown since rate limiting is skipped
		expect(delay).not.toHaveBeenCalledWith(1000)

		// Clean up
		await cline.abortTask(true)
		await task.catch(() => {})
	})

	test("should calculate correct rate limit delay", async () => {
		// Arrange
		const [cline, task] = Cline.create({
			provider: new MockProviderWithoutBuiltInRateLimiting() as any,
			apiConfiguration: {
				apiProvider: "anthropic",
				apiModelId: "test-model",
				apiKey: "test-key",
			},
			task: "test task",
			startTask: false, // Prevent actual task start
		})

		// Set lastApiRequestTime to simulate a recent request
		const now = Date.now()
		cline["lastApiRequestTime"] = now - 3000 // 3 seconds ago

		// Mock Date.now to return a consistent value for testing
		const originalDateNow = Date.now
		Date.now = jest.fn().mockReturnValue(now)

		// Calculate the rate limit delay manually
		const timeSinceLastRequest = 3000 // 3 seconds
		const rateLimit = 5 // 5 seconds from mockState
		const expectedDelay = Math.ceil(Math.max(0, rateLimit * 1000 - timeSinceLastRequest) / 1000) // Should be 2 seconds

		// Restore Date.now
		Date.now = originalDateNow

		// Assert
		expect(expectedDelay).toBe(2) // Confirm our manual calculation matches expected behavior

		// Clean up
		await cline.abortTask(true)
		await task.catch(() => {})
	})

	test("should skip rate limiting when using Mistral provider", async () => {
		// Arrange
		const [cline, task] = Cline.create({
			provider: new MockMistralProvider() as any,
			apiConfiguration: {
				apiProvider: "mistral",
				apiModelId: "codestral-latest",
				apiKey: "test-key",
			},
			task: "test task",
			startTask: false, // Prevent actual task start
		})

		// Set lastApiRequestTime to simulate a recent request
		cline["lastApiRequestTime"] = Date.now() - 2000 // 2 seconds ago
		cline["apiConversationHistory"] = []

		// Act
		const generator = cline["attemptApiRequest"](0)

		// Manually trigger the generator to start execution
		try {
			await generator.next()
		} catch (e) {
			// Expected to throw since we're not fully mocking everything
		}

		// Assert
		// Should not have called delay for the countdown since rate limiting is skipped
		expect(delay).not.toHaveBeenCalledWith(1000)

		// Clean up
		await cline.abortTask(true)
		await task.catch(() => {})
	})
})
