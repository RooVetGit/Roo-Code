import { AccessMcpResourceHandler } from "../AccessMcpResourceHandler"
import { Cline } from "../../../Cline"
import { ToolUse } from "../../../assistant-message"
import { formatResponse } from "../../../prompts/responses"
import { telemetryService } from "../../../../services/telemetry/TelemetryService"
import { ClineProvider } from "../../../webview/ClineProvider"
import { McpHub } from "../../../../services/mcp/McpHub" // Assuming path

// --- Mocks ---
jest.mock("../../../Cline")
const MockCline = Cline as jest.MockedClass<typeof Cline>

jest.mock("../../../webview/ClineProvider")
const MockClineProvider = ClineProvider as jest.MockedClass<typeof ClineProvider>

jest.mock("../../../../services/mcp/McpHub") // Mock McpHub
const MockMcpHub = McpHub as jest.MockedClass<typeof McpHub>

jest.mock("../../../prompts/responses", () => ({
	formatResponse: {
		toolError: jest.fn((msg) => `ERROR: ${msg}`),
		toolResult: jest.fn((text, images) => (images ? `${text} [with images]` : text)),
	},
}))

jest.mock("../../../../services/telemetry/TelemetryService", () => ({
	telemetryService: {
		captureToolUsage: jest.fn(),
	},
}))

describe("AccessMcpResourceHandler", () => {
	let mockClineInstance: jest.MockedObject<Cline>
	let mockProviderInstance: jest.MockedObject<ClineProvider>
	let mockMcpHubInstance: jest.MockedObject<McpHub>
	let mockToolUse: ToolUse

	const mockResourceResult = {
		contents: [
			// Add a placeholder uri to satisfy the type
			{ uri: "/resource/path/item1", mimeType: "text/plain", text: "Resource content line 1" },
			{ uri: "/resource/path/item2", mimeType: "text/plain", text: "Resource content line 2" },
			{ uri: "/resource/path/image.png", mimeType: "image/png", blob: "base64-image-data" },
		],
	}

	beforeEach(() => {
		jest.clearAllMocks()

		// Mock McpHub instance and methods
		mockMcpHubInstance = new MockMcpHub({} as any) as jest.MockedObject<McpHub> // Provide mock context if needed
		mockMcpHubInstance.readResource = jest.fn().mockResolvedValue(mockResourceResult)

		// Mock provider instance and methods
		const mockVsCodeContext = {} as any // Add necessary context properties if needed
		const mockOutputChannel = { appendLine: jest.fn() } as any
		mockProviderInstance = new MockClineProvider(
			mockVsCodeContext,
			mockOutputChannel,
		) as jest.MockedObject<ClineProvider>
		// Use mockReturnValue for getMcpHub
		mockProviderInstance.getMcpHub.mockReturnValue(mockMcpHubInstance) // Return mock McpHub

		mockClineInstance = {
			cwd: "/workspace",
			consecutiveMistakeCount: 0,
			taskId: "test-task-id",
			providerRef: { deref: () => mockProviderInstance },
			ask: jest.fn(() => Promise.resolve({})),
			say: jest.fn(() => Promise.resolve()),
			pushToolResult: jest.fn(() => Promise.resolve()),
			handleErrorHelper: jest.fn(() => Promise.resolve()),
			sayAndCreateMissingParamError: jest.fn((tool, param) => Promise.resolve(`Missing ${param}`)),
			askApprovalHelper: jest.fn(() => Promise.resolve(true)), // Default approval
			emit: jest.fn(),
			getTokenUsage: jest.fn(() => ({})),
			removeClosingTag: jest.fn((tag, value) => value),
		} as unknown as jest.MockedObject<Cline>

		mockToolUse = {
			type: "tool_use",
			name: "access_mcp_resource",
			params: {
				server_name: "my-mcp-server",
				uri: "/resource/path",
			},
			partial: false,
		}
	})

	// --- Test validateParams ---
	test("validateParams should throw if server_name is missing", () => {
		delete mockToolUse.params.server_name
		const handler = new AccessMcpResourceHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow("Missing required parameter 'server_name'")
	})

	test("validateParams should throw if uri is missing", () => {
		delete mockToolUse.params.uri
		const handler = new AccessMcpResourceHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow("Missing required parameter 'uri'")
	})

	test("validateParams should not throw if server_name and uri are present", () => {
		const handler = new AccessMcpResourceHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).not.toThrow()
	})

	// --- Test handlePartial ---
	test("handlePartial should call ask with use_mcp_server info", async () => {
		mockToolUse.partial = true
		const handler = new AccessMcpResourceHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.ask).toHaveBeenCalledWith(
			"use_mcp_server", // Uses this ask type
			JSON.stringify({
				type: "access_mcp_resource",
				serverName: mockToolUse.params.server_name,
				uri: mockToolUse.params.uri,
			}),
			true,
		)
	})

	// --- Test handleComplete ---
	test("handleComplete should fail if server_name param is missing", async () => {
		delete mockToolUse.params.server_name
		const handler = new AccessMcpResourceHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.sayAndCreateMissingParamError).toHaveBeenCalledWith(
			"access_mcp_resource",
			"server_name",
		)
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "Missing server_name")
		expect(mockClineInstance.consecutiveMistakeCount).toBe(1)
	})

	test("handleComplete should fail if uri param is missing", async () => {
		delete mockToolUse.params.uri
		const handler = new AccessMcpResourceHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.sayAndCreateMissingParamError).toHaveBeenCalledWith("access_mcp_resource", "uri")
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "Missing uri")
		expect(mockClineInstance.consecutiveMistakeCount).toBe(1)
	})

	test("handleComplete should fail if providerRef is lost", async () => {
		mockClineInstance.providerRef.deref = () => undefined // Simulate lost ref
		const handler = new AccessMcpResourceHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.handleErrorHelper).toHaveBeenCalledWith(
			mockToolUse,
			"accessing MCP resource",
			expect.any(Error),
		)
		expect(mockClineInstance.handleErrorHelper.mock.calls[0][2].message).toContain("MCP Hub is not available")
	})

	test("handleComplete should fail if McpHub is not available", async () => {
		// Use mockReturnValue for getMcpHub
		mockProviderInstance.getMcpHub.mockReturnValue(undefined) // Simulate no McpHub
		const handler = new AccessMcpResourceHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.handleErrorHelper).toHaveBeenCalledWith(
			mockToolUse,
			"accessing MCP resource",
			expect.any(Error),
		)
		expect(mockClineInstance.handleErrorHelper.mock.calls[0][2].message).toContain("MCP Hub is not available")
	})

	test("handleComplete should ask approval, call McpHub, say/push result", async () => {
		const handler = new AccessMcpResourceHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		// Verify approval
		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalledWith(
			mockToolUse,
			"use_mcp_server",
			expect.stringContaining('"type":"access_mcp_resource"') &&
				expect.stringContaining(`"serverName":"${mockToolUse.params.server_name}"`) &&
				expect.stringContaining(`"uri":"${mockToolUse.params.uri}"`),
		)

		// Verify actions
		expect(mockClineInstance.say).toHaveBeenCalledWith("mcp_server_request_started")
		expect(mockProviderInstance.getMcpHub).toHaveBeenCalled()
		expect(mockMcpHubInstance.readResource).toHaveBeenCalledWith(
			mockToolUse.params.server_name,
			mockToolUse.params.uri,
		)

		// Verify result processing
		const expectedTextResult = "Resource content line 1\n\nResource content line 2"
		const expectedImages = ["base64-image-data"]
		expect(mockClineInstance.say).toHaveBeenCalledWith("mcp_server_response", expectedTextResult, expectedImages)
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			`${expectedTextResult} [with images]`, // From mock formatResponse
		)
		expect(telemetryService.captureToolUsage).toHaveBeenCalledWith(mockClineInstance.taskId, "access_mcp_resource")
		expect(mockClineInstance.consecutiveMistakeCount).toBe(0)
	})

	test("handleComplete should handle empty resource result", async () => {
		mockMcpHubInstance.readResource.mockResolvedValue({ contents: [] }) // Empty contents
		const handler = new AccessMcpResourceHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockMcpHubInstance.readResource).toHaveBeenCalled()
		expect(mockClineInstance.say).toHaveBeenCalledWith("mcp_server_response", "(Empty response)", undefined)
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "(Empty response)")
	})

	test("handleComplete should handle resource result with only text", async () => {
		mockMcpHubInstance.readResource.mockResolvedValue({
			// Add placeholder uri
			contents: [{ uri: "/resource/path/textitem", mimeType: "text/plain", text: "Just text" }],
		})
		const handler = new AccessMcpResourceHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockMcpHubInstance.readResource).toHaveBeenCalled()
		expect(mockClineInstance.say).toHaveBeenCalledWith("mcp_server_response", "Just text", undefined)
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "Just text")
	})

	test("handleComplete should skip actions if approval denied", async () => {
		;(mockClineInstance.askApprovalHelper as jest.Mock).mockResolvedValue(false) // Deny approval
		const handler = new AccessMcpResourceHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalled()
		expect(mockClineInstance.say).not.toHaveBeenCalledWith("mcp_server_request_started")
		expect(mockMcpHubInstance.readResource).not.toHaveBeenCalled()
		expect(mockClineInstance.pushToolResult).not.toHaveBeenCalled() // Handled by helper
		expect(telemetryService.captureToolUsage).not.toHaveBeenCalled()
	})

	test("handleComplete should handle errors during MCP call", async () => {
		const mcpError = new Error("MCP read failed")
		mockMcpHubInstance.readResource.mockRejectedValue(mcpError) // Make readResource throw
		const handler = new AccessMcpResourceHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalled()
		expect(mockClineInstance.say).toHaveBeenCalledWith("mcp_server_request_started")
		expect(mockMcpHubInstance.readResource).toHaveBeenCalled()
		expect(mockClineInstance.handleErrorHelper).toHaveBeenCalledWith(
			mockToolUse,
			"accessing MCP resource",
			mcpError,
		)
		expect(mockClineInstance.say).not.toHaveBeenCalledWith(
			"mcp_server_response",
			expect.anything(),
			expect.anything(),
		)
		expect(mockClineInstance.pushToolResult).not.toHaveBeenCalled() // Handled by error helper
	})
})
