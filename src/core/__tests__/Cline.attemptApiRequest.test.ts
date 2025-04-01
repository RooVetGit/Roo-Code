import { Cline } from "../Cline"
import delay from "delay"
import { ApiStreamChunk } from "../../api/transform/stream"

// Mock dependencies
jest.mock("delay")
const mockDelay = delay as jest.MockedFunction<typeof delay>

describe("Cline.attemptApiRequest", () => {
	// Common test setup
	// Create a mock provider that satisfies the ClineProvider interface
	const mockProvider = {
		getState: jest.fn().mockResolvedValue({
			mcpEnabled: false,
			alwaysApproveResubmit: true,
			requestDelaySeconds: 3,
			rateLimitSeconds: 5,
		}),
		getMcpHub: jest.fn(),
		// Additional required properties to satisfy ClineProvider interface
		disposables: [],
		isViewLaunched: false,
		clineStack: [],
		latestAnnouncementId: null,
		context: {} as any,
		outputChannel: {} as any,
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
		contextProxy: {} as any,
		providerSettingsManager: {} as any,
		customModesManager: {} as any,
		workspaceTracker: {} as any,
		mcpHub: undefined,
	} as any // Use type assertion to bypass the remaining properties

	const mockApiConfig = {
		apiModelId: "claude-3-sonnet",
		apiKey: "test-key",
	}

	beforeEach(() => {
		jest.clearAllMocks()
		mockDelay.mockResolvedValue(undefined)
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
						// throw { status: 429, message: "Rate limit exceeded" }
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
			mockProvider.getState.mockResolvedValue({
				mcpEnabled: false,
				alwaysApproveResubmit: false,
				requestDelaySeconds: 3,
				rateLimitSeconds: 5,
			})

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
						throw new Error(JSON.stringify({ status: 429, message: "Rate limit exceeded" })) // { status: 429, message: "Rate limit exceeded" }
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

	describe("Successful API Requests", () => {
		it("should handle successful streaming without retries", async () => {
			const [cline, _task] = Cline.create({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
			})

			// Mock successful API stream
			const mockStream = (async function* () {
				yield { type: "text", text: "chunk 1" } as ApiStreamChunk
				yield { type: "text", text: "chunk 2" } as ApiStreamChunk
			})()
			jest.spyOn(cline.api, "createMessage").mockReturnValue(mockStream)

			const iterator = cline.attemptApiRequest(0)
			const results = []
			for await (const chunk of iterator) {
				results.push(chunk)
			}

			expect(results).toHaveLength(2)
			expect(results[0]).toEqual({ type: "text", text: "chunk 1" })
			expect(results[1]).toEqual({ type: "text", text: "chunk 2" })
		})

		it("should update lastApiRequestTime after successful completion", async () => {
			const [cline, _task] = Cline.create({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
			})

			const mockStream = (async function* () {
				yield { type: "text", text: "success" } as ApiStreamChunk
			})()
			jest.spyOn(cline.api, "createMessage").mockReturnValue(mockStream)

			const beforeTime = Date.now()
			const iterator = cline.attemptApiRequest(0)
			await iterator.next()
			const afterTime = Date.now()

			expect(cline["lastApiRequestTime"]).toBeGreaterThanOrEqual(beforeTime)
			expect(cline["lastApiRequestTime"]).toBeLessThanOrEqual(afterTime)
		})
	})
})
