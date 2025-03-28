import { UseMcpToolHandler } from "../UseMcpToolHandler"
import { Cline } from "../../../Cline"
import { ToolUse } from "../../../assistant-message"
import { formatResponse } from "../../../prompts/responses"
import { telemetryService } from "../../../../services/telemetry/TelemetryService"
import { ClineProvider } from "../../../webview/ClineProvider"
import { McpHub } from "../../../../services/mcp/McpHub" // Assuming path
// Manually define types matching McpToolCallResponse structure for tests
interface McpTextContent {
	type: "text"
	text: string
}
interface McpImageContent {
	type: "image"
	data: string // Assuming base64 data
	mimeType: string
}
interface McpResourceContent {
	type: "resource"
	resource: {
		uri: string
		mimeType?: string
		text?: string
		blob?: string // Ensure blob is included
	}
}
type McpToolContent = McpTextContent | McpImageContent | McpResourceContent

interface McpToolResult {
	isError: boolean
	content?: McpToolContent[]
}

// --- Mocks ---
jest.mock("../../../Cline")

jest.mock("../../../webview/ClineProvider")
const MockClineProvider = ClineProvider as jest.MockedClass<typeof ClineProvider>

jest.mock("../../../../services/mcp/McpHub") // Mock McpHub
const MockMcpHub = McpHub as jest.MockedClass<typeof McpHub>

jest.mock("../../../prompts/responses", () => ({
	formatResponse: {
		toolError: jest.fn((msg) => `ERROR: ${msg}`),
		toolResult: jest.fn((text) => text), // Simple mock
		invalidMcpToolArgumentError: jest.fn((server, tool) => `Invalid JSON for ${tool} on ${server}`),
	},
}))

jest.mock("../../../../services/telemetry/TelemetryService", () => ({
	telemetryService: {
		captureToolUsage: jest.fn(),
	},
}))

describe("UseMcpToolHandler", () => {
	let mockClineInstance: jest.MockedObject<Cline>
	let mockProviderInstance: jest.MockedObject<ClineProvider>
	let mockMcpHubInstance: jest.MockedObject<McpHub>
	let mockToolUse: ToolUse

	const mockToolResult: McpToolResult = {
		isError: false,
		content: [{ type: "text", text: "MCP tool executed successfully" }],
	}

	beforeEach(() => {
		jest.clearAllMocks()

		// Mock McpHub instance and methods
		mockMcpHubInstance = new MockMcpHub({} as any) as jest.MockedObject<McpHub>
		mockMcpHubInstance.callTool = jest.fn().mockResolvedValue(mockToolResult)

		// Mock provider instance and methods
		const mockVsCodeContext = {} as any
		const mockOutputChannel = { appendLine: jest.fn() } as any
		mockProviderInstance = new MockClineProvider(
			mockVsCodeContext,
			mockOutputChannel,
		) as jest.MockedObject<ClineProvider>
		mockProviderInstance.getMcpHub = jest.fn().mockReturnValue(mockMcpHubInstance)

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
			name: "use_mcp_tool",
			params: {
				server_name: "my-mcp-server",
				tool_name: "example_tool",
				arguments: JSON.stringify({ arg1: "value1", arg2: 123 }), // Optional
			},
			partial: false,
		}
	})

	// --- Test validateParams ---
	test("validateParams should throw if server_name is missing", () => {
		delete mockToolUse.params.server_name
		const handler = new UseMcpToolHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow("Missing required parameter 'server_name'")
	})

	test("validateParams should throw if tool_name is missing", () => {
		delete mockToolUse.params.tool_name
		const handler = new UseMcpToolHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow("Missing required parameter 'tool_name'")
	})

	test("validateParams should not throw if optional arguments is missing", () => {
		delete mockToolUse.params.arguments
		const handler = new UseMcpToolHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).not.toThrow()
	})

	// --- Test handlePartial ---
	test("handlePartial should call ask with use_mcp_server info", async () => {
		mockToolUse.partial = true
		const handler = new UseMcpToolHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.ask).toHaveBeenCalledWith(
			"use_mcp_server", // Uses this ask type
			JSON.stringify({
				type: "use_mcp_tool",
				serverName: mockToolUse.params.server_name,
				toolName: mockToolUse.params.tool_name,
				arguments: mockToolUse.params.arguments,
			}),
			true,
		)
	})

	// --- Test handleComplete ---
	test("handleComplete should fail if server_name param is missing", async () => {
		delete mockToolUse.params.server_name
		const handler = new UseMcpToolHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.sayAndCreateMissingParamError).toHaveBeenCalledWith("use_mcp_tool", "server_name")
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "Missing server_name")
		expect(mockClineInstance.consecutiveMistakeCount).toBe(1)
	})

	test("handleComplete should fail if tool_name param is missing", async () => {
		delete mockToolUse.params.tool_name
		const handler = new UseMcpToolHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.sayAndCreateMissingParamError).toHaveBeenCalledWith("use_mcp_tool", "tool_name")
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "Missing tool_name")
		expect(mockClineInstance.consecutiveMistakeCount).toBe(1)
	})

	test("handleComplete should fail if arguments JSON is invalid", async () => {
		mockToolUse.params.arguments = "{invalid json"
		const handler = new UseMcpToolHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.say).toHaveBeenCalledWith("error", expect.stringContaining("invalid JSON argument"))
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			"ERROR: Invalid JSON for example_tool on my-mcp-server", // From mock formatResponse
		)
		expect(mockClineInstance.consecutiveMistakeCount).toBe(1)
		expect(mockClineInstance.askApprovalHelper).not.toHaveBeenCalled()
	})

	test("handleComplete should fail if providerRef is lost", async () => {
		mockClineInstance.providerRef.deref = () => undefined
		const handler = new UseMcpToolHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.handleErrorHelper).toHaveBeenCalledWith(
			mockToolUse,
			"executing MCP tool",
			expect.any(Error),
		)
		expect(mockClineInstance.handleErrorHelper.mock.calls[0][2].message).toContain("MCP Hub is not available")
	})

	test("handleComplete should fail if McpHub is not available", async () => {
		mockProviderInstance.getMcpHub.mockReturnValue(undefined)
		const handler = new UseMcpToolHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.handleErrorHelper).toHaveBeenCalledWith(
			mockToolUse,
			"executing MCP tool",
			expect.any(Error),
		)
		expect(mockClineInstance.handleErrorHelper.mock.calls[0][2].message).toContain("MCP Hub is not available")
	})

	test("handleComplete should ask approval, call McpHub, say/push result", async () => {
		const handler = new UseMcpToolHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		// Verify approval
		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalledWith(
			mockToolUse,
			"use_mcp_server",
			expect.stringContaining('"type":"use_mcp_tool"') &&
				expect.stringContaining(`"serverName":"${mockToolUse.params.server_name}"`) &&
				expect.stringContaining(`"toolName":"${mockToolUse.params.tool_name}"`) &&
				expect.stringContaining(`"arguments":${JSON.stringify(mockToolUse.params.arguments)}`), // Check raw JSON string
		)

		// Verify actions
		expect(mockClineInstance.say).toHaveBeenCalledWith("mcp_server_request_started")
		expect(mockProviderInstance.getMcpHub).toHaveBeenCalled()
		expect(mockMcpHubInstance.callTool).toHaveBeenCalledWith(
			mockToolUse.params.server_name,
			mockToolUse.params.tool_name,
			JSON.parse(mockToolUse.params.arguments!), // Parsed arguments
		)

		// Verify result processing
		const expectedTextResult = "MCP tool executed successfully"
		expect(mockClineInstance.say).toHaveBeenCalledWith("mcp_server_response", expectedTextResult)
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, expectedTextResult)
		expect(telemetryService.captureToolUsage).toHaveBeenCalledWith(mockClineInstance.taskId, "use_mcp_tool")
		expect(mockClineInstance.consecutiveMistakeCount).toBe(0)
	})

	test("handleComplete should call McpHub with undefined arguments if not provided", async () => {
		delete mockToolUse.params.arguments
		const handler = new UseMcpToolHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalled()
		expect(mockMcpHubInstance.callTool).toHaveBeenCalledWith(
			mockToolUse.params.server_name,
			mockToolUse.params.tool_name,
			undefined, // Arguments should be undefined
		)
		expect(mockClineInstance.pushToolResult).toHaveBeenCalled()
	})

	test("handleComplete should handle MCP error result", async () => {
		const errorResult: McpToolResult = {
			isError: true,
			content: [{ type: "text", text: "Something went wrong on the server" }],
		}
		mockMcpHubInstance.callTool.mockResolvedValue(errorResult as any) // Cast to any
		const handler = new UseMcpToolHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockMcpHubInstance.callTool).toHaveBeenCalled()
		const expectedTextResult = "Error:\nSomething went wrong on the server"
		expect(mockClineInstance.say).toHaveBeenCalledWith("mcp_server_response", expectedTextResult)
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, expectedTextResult)
	})

	test("handleComplete should handle MCP result with resource", async () => {
		const resourceResult: McpToolResult = {
			isError: false,
			content: [
				{ type: "text", text: "Got a resource:" },
				{ type: "resource", resource: { uri: "mcp://server/data/item1", mimeType: "application/json" } },
			],
		}
		mockMcpHubInstance.callTool.mockResolvedValue(resourceResult as any) // Cast to any
		const handler = new UseMcpToolHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockMcpHubInstance.callTool).toHaveBeenCalled()
		const expectedTextResult =
			'Got a resource:\n\n[Resource: {\n  "uri": "mcp://server/data/item1",\n  "mimeType": "application/json"\n}]'
		expect(mockClineInstance.say).toHaveBeenCalledWith("mcp_server_response", expectedTextResult)
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, expectedTextResult)
	})

	test("handleComplete should skip actions if approval denied", async () => {
		;(mockClineInstance.askApprovalHelper as jest.Mock).mockResolvedValue(false)
		const handler = new UseMcpToolHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalled()
		expect(mockClineInstance.say).not.toHaveBeenCalledWith("mcp_server_request_started")
		expect(mockMcpHubInstance.callTool).not.toHaveBeenCalled()
		expect(mockClineInstance.pushToolResult).not.toHaveBeenCalled()
		expect(telemetryService.captureToolUsage).not.toHaveBeenCalled()
	})

	test("handleComplete should handle errors during MCP call", async () => {
		const mcpError = new Error("MCP call failed")
		mockMcpHubInstance.callTool.mockRejectedValue(mcpError)
		const handler = new UseMcpToolHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalled()
		expect(mockClineInstance.say).toHaveBeenCalledWith("mcp_server_request_started")
		expect(mockMcpHubInstance.callTool).toHaveBeenCalled()
		expect(mockClineInstance.handleErrorHelper).toHaveBeenCalledWith(mockToolUse, "executing MCP tool", mcpError)
		expect(mockClineInstance.say).not.toHaveBeenCalledWith("mcp_server_response", expect.anything())
		expect(mockClineInstance.pushToolResult).not.toHaveBeenCalled()
	})
})
