import { Cline } from "../Cline"
import delay from "delay"
import { ApiStreamChunk } from "../../api/transform/stream"
import * as vscode from "vscode"
import { ClineProvider } from "../webview/ClineProvider"

// Mock dependencies
jest.mock("delay")
jest.mock("vscode")
const mockDelay = delay as jest.MockedFunction<typeof delay>

// Mock RooIgnoreController to avoid fileWatcher errors
jest.mock("../ignore/RooIgnoreController", () => {
	return {
		LOCK_TEXT_SYMBOL: "\u{1F512}",
		RooIgnoreController: jest.fn().mockImplementation(() => ({
			initialize: jest.fn().mockResolvedValue(undefined),
			validateAccess: jest.fn().mockReturnValue(true),
			validateCommand: jest.fn().mockReturnValue(undefined),
			filterPaths: jest.fn().mockImplementation((paths) => paths),
			dispose: jest.fn(),
			getInstructions: jest.fn().mockReturnValue(undefined),
			rooIgnoreContent: undefined,
		})),
	}
})

describe("Cline.attemptApiRequest", () => {
	// Common test setup
	const mockProvider = {
		getState: jest.fn().mockImplementation(async () => ({
			apiConfiguration: {
				apiModelId: "claude-3-sonnet",
				apiKey: "test-key",
				apiProvider: "anthropic",
			},
			lastShownAnnouncementId: undefined,
			customInstructions: undefined,
			alwaysAllowReadOnly: false,
			alwaysAllowReadOnlyOutsideWorkspace: false,
			alwaysAllowWrite: false,
			alwaysAllowWriteOutsideWorkspace: false,
			alwaysAllowExecute: false,
			alwaysAllowBrowser: false,
			alwaysAllowMcp: false,
			alwaysAllowModeSwitch: false,
			alwaysAllowSubtasks: false,
			taskHistory: [],
			allowedCommands: [],
			soundEnabled: false,
			ttsEnabled: false,
			ttsSpeed: 1.0,
			diffEnabled: true,
			enableCheckpoints: true,
			checkpointStorage: "task",
			soundVolume: 0.5,
			browserViewportSize: "900x600",
			screenshotQuality: 75,
			remoteBrowserHost: undefined,
			remoteBrowserEnabled: false,
			cachedChromeHostUrl: undefined,
			fuzzyMatchThreshold: 1.0,
			writeDelayMs: 1000,
			terminalOutputLineLimit: 500,
			terminalShellIntegrationTimeout: 30000,
			mode: "default",
			language: "en",
			mcpEnabled: false,
			enableMcpServerCreation: true,
			alwaysApproveResubmit: true,
			requestDelaySeconds: 3,
			rateLimitSeconds: 5,
			currentApiConfigName: "default",
			listApiConfigMeta: [],
			pinnedApiConfigs: {},
			modeApiConfigs: {},
			customModePrompts: {},
			customSupportPrompts: {},
			enhancementApiConfigId: undefined,
			experiments: {},
			autoApprovalEnabled: false,
			customModes: {},
			maxOpenTabsContext: 20,
			maxWorkspaceFiles: 200,
			openRouterUseMiddleOutTransform: true,
			browserToolEnabled: true,
			telemetrySetting: "unset",
			showRooIgnoredFiles: true,
			maxReadFileLine: 500,
		})),
		getMcpHub: jest.fn(),
		disposables: [],
		isViewLaunched: false,
		clineStack: [],
		latestAnnouncementId: undefined,
		context: {
			globalStorageUri: vscode.Uri.file("/mock/storage/path"),
			extensionUri: vscode.Uri.file("/mock/extension/path"),
			logUri: vscode.Uri.file("/mock/log/path"),
			extensionMode: vscode.ExtensionMode.Test,
			subscriptions: [],
			extensionPath: "/mock/extension/path",
			globalState: {
				get: jest.fn(),
				update: jest.fn(),
				keys: jest.fn().mockReturnValue([]),
				setKeysForSync: jest.fn(),
			},
			workspaceState: {
				get: jest.fn(),
				update: jest.fn(),
				keys: jest.fn().mockReturnValue([]),
				setKeysForSync: jest.fn(),
			},
			storageUri: undefined,
			asAbsolutePath: jest.fn((path) => path),
		},
		outputChannel: {
			name: "Roo Code",
			append: jest.fn(),
			appendLine: jest.fn(),
			clear: jest.fn(),
			show: jest.fn(),
			hide: jest.fn(),
			dispose: jest.fn(),
			replace: jest.fn(),
		},
		renderContext: "sidebar" as const,
		emit: jest.fn(),
		on: jest.fn(),
		off: jest.fn(),
		once: jest.fn(),
		addClineToStack: jest.fn(),
		removeClineFromStack: jest.fn(),
		getTelemetryProperties: jest.fn().mockResolvedValue({}),
		log: jest.fn(),
		getCurrentCline: jest.fn(),
		postStateToWebview: jest.fn(),
		resolveWebviewView: jest.fn(),
		resolveWebviewPanel: jest.fn(),
		contextProxy: {
			getValue: jest.fn(),
			getValues: jest.fn(),
			setValues: jest.fn(),
		},
		providerSettingsManager: {
			listConfig: jest.fn(),
			setModeConfig: jest.fn(),
		},
		customModesManager: {},
		workspaceTracker: {},
		mcpHub: undefined,
		dispose: jest.fn(),
		getClineStackSize: jest.fn(),
		getCurrentTaskStack: jest.fn(),
		finishSubTask: jest.fn(),
	} as unknown as ClineProvider // Type assertion since we're only implementing what we need for tests

	const mockApiConfig = {
		apiModelId: "claude-3-sonnet",
		apiKey: "test-key",
	}

	beforeEach(() => {
		jest.clearAllMocks()
		mockDelay.mockResolvedValue(undefined)
		// Mock the cline messages to include valid JSON for the API request info
		const mockClineMessages = [
			{
				text: JSON.stringify({
					tokensIn: 100,
					tokensOut: 50,
					cacheWrites: 0,
					cacheReads: 0,
				}),
			},
		]
		mockProvider.getCurrentCline = jest.fn().mockReturnValue({
			clineMessages: mockClineMessages,
		})
	})

	describe("Rate Limiting", () => {
		it("should handle initial rate limit delay", async () => {
			const [cline, _task] = Cline.create({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
			})

			const saySpy = jest.spyOn(cline, "say")

			// Set last API request time to trigger rate limit
			cline["lastApiRequestTime"] = Date.now() - 2000 // 2 seconds ago

			// Mock successful API response after rate limit
			const mockStream = (async function* () {
				yield { type: "text", text: "success" } as ApiStreamChunk
			})()
			jest.spyOn(cline.api, "createMessage").mockReturnValue(mockStream)

			const iterator = cline.attemptApiRequest(0)
			await iterator.next()

			// Verify rate limit countdown messages
			expect(saySpy).toHaveBeenCalledWith(
				"api_req_retry_delayed",
				"Rate limiting for 3 seconds...",
				undefined,
				true,
			)
			expect(mockDelay).toHaveBeenCalledTimes(3)
			expect(mockDelay).toHaveBeenCalledWith(1000)
		})

		it("should handle rate limit error during streaming with automatic retry", async () => {
			const [cline, _task] = Cline.create({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
			})

			const saySpy = jest.spyOn(cline, "say")

			// Mock API stream that throws rate limit error
			let firstAttempt = true
			const mockCreateMessage = jest.spyOn(cline.api, "createMessage").mockImplementation(() => {
				return (async function* () {
					if (firstAttempt) {
						firstAttempt = false
						throw new Error(JSON.stringify({ status: 429, message: "Rate limit exceeded" }))
					}
					yield { type: "text", text: "success" }
				})()
			})

			const iterator = cline.attemptApiRequest(0)
			await iterator.next()

			// Verify retry countdown messages
			expect(saySpy).toHaveBeenCalledWith(
				"api_req_retry_delayed",
				expect.stringContaining("Rate limit exceeded"),
				undefined,
				true,
			)
			expect(saySpy).toHaveBeenCalledWith(
				"api_req_retry_delayed",
				expect.stringContaining("Retrying in 3 seconds"),
				undefined,
				true,
			)
			expect(mockCreateMessage).toHaveBeenCalledTimes(2)
		})

		it("should handle rate limit error with manual retry when alwaysApproveResubmit is false", async () => {
			// Update provider state for this specific test
			mockProvider.getState = jest.fn().mockImplementation(async () => ({
				apiConfiguration: {
					apiModelId: "claude-3-sonnet",
					apiKey: "test-key",
					apiProvider: "anthropic",
				},
				mcpEnabled: false,
				alwaysApproveResubmit: false,
				requestDelaySeconds: 3,
				rateLimitSeconds: 5,
				// ... rest of the state properties remain the same
				mode: "default",
				experiments: {},
				maxReadFileLine: 500,
			}))

			const [cline, _task] = Cline.create({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
			})

			const askSpy = jest.spyOn(cline, "ask").mockResolvedValue({
				response: "yesButtonClicked",
				text: "",
				images: [],
			})

			// Mock API stream that throws rate limit error
			let firstAttempt = true
			jest.spyOn(cline.api, "createMessage").mockImplementation(() => {
				return (async function* () {
					if (firstAttempt) {
						firstAttempt = false
						throw new Error(JSON.stringify({ status: 429, message: "Rate limit exceeded" }))
					}
					yield { type: "text", text: "success" }
				})()
			})

			const iterator = cline.attemptApiRequest(0)
			await iterator.next()

			// Verify manual retry prompt
			expect(askSpy).toHaveBeenCalledWith("api_req_failed", expect.stringContaining("Rate limit exceeded"))
		})

		it("should propagate non-rate-limit errors", async () => {
			const [cline, _task] = Cline.create({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
			})

			// Mock API stream that throws non-rate-limit error
			jest.spyOn(cline.api, "createMessage").mockImplementation(() => {
				return (async function* () {
					throw new Error("Unknown error")
					// The following line will never execute but helps TypeScript understand the return type
					// @ts-ignore - Unreachable code is expected here
					yield { type: "text", text: "" } as ApiStreamChunk
				})()
			})

			const iterator = cline.attemptApiRequest(0)
			await expect(iterator.next()).rejects.toThrow("Unknown error")
		})
	})
})
