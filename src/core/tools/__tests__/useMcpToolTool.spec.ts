// npx vitest core/tools/__tests__/useMcpToolTool.spec.ts

import { useMcpToolTool } from "../useMcpToolTool"
import { Task } from "../../task/Task"
import { ToolUse } from "../../../shared/tools"

// Mock dependencies
vi.mock("../../prompts/responses", () => ({
	formatResponse: {
		toolResult: vi.fn((result: string, images?: string[]) => {
			if (images && images.length > 0) {
				return `Tool result: ${result} (with ${images.length} images)`
			}
			return `Tool result: ${result}`
		}),
		toolError: vi.fn((error: string) => `Tool error: ${error}`),
		invalidMcpToolArgumentError: vi.fn((server: string, tool: string) => `Invalid args for ${server}:${tool}`),
	},
}))

vi.mock("../../../i18n", () => ({
	t: vi.fn((key: string, params?: any) => {
		if (key === "mcp:errors.invalidJsonArgument" && params?.toolName) {
			return `Roo tried to use ${params.toolName} with an invalid JSON argument. Retrying...`
		}
		return key
	}),
}))

describe("useMcpToolTool", () => {
	let mockTask: Partial<Task>
	let mockAskApproval: ReturnType<typeof vi.fn>
	let mockHandleError: ReturnType<typeof vi.fn>
	let mockPushToolResult: ReturnType<typeof vi.fn>
	let mockRemoveClosingTag: ReturnType<typeof vi.fn>
	let mockProviderRef: any

	beforeEach(() => {
		mockAskApproval = vi.fn()
		mockHandleError = vi.fn()
		mockPushToolResult = vi.fn()
		mockRemoveClosingTag = vi.fn((tag: string, value?: string) => value || "")

		mockProviderRef = {
			deref: vi.fn().mockReturnValue({
				getMcpHub: vi.fn().mockReturnValue({
					callTool: vi.fn(),
				}),
				postMessageToWebview: vi.fn(),
				getState: vi.fn().mockResolvedValue({
					mcpMaxImagesPerResponse: 20,
					mcpMaxImageSizeMB: 10,
				}),
			}),
		}

		mockTask = {
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			sayAndCreateMissingParamError: vi.fn(),
			say: vi.fn(),
			ask: vi.fn(),
			lastMessageTs: 123456789,
			providerRef: mockProviderRef,
		}
	})

	describe("parameter validation", () => {
		it("should handle missing server_name", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					tool_name: "test_tool",
					arguments: "{}",
				},
				partial: false,
			}

			mockTask.sayAndCreateMissingParamError = vi.fn().mockResolvedValue("Missing server_name error")

			await useMcpToolTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockTask.consecutiveMistakeCount).toBe(1)
			expect(mockTask.recordToolError).toHaveBeenCalledWith("use_mcp_tool")
			expect(mockTask.sayAndCreateMissingParamError).toHaveBeenCalledWith("use_mcp_tool", "server_name")
			expect(mockPushToolResult).toHaveBeenCalledWith("Missing server_name error")
		})

		it("should handle missing tool_name", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test_server",
					arguments: "{}",
				},
				partial: false,
			}

			mockTask.sayAndCreateMissingParamError = vi.fn().mockResolvedValue("Missing tool_name error")

			await useMcpToolTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockTask.consecutiveMistakeCount).toBe(1)
			expect(mockTask.recordToolError).toHaveBeenCalledWith("use_mcp_tool")
			expect(mockTask.sayAndCreateMissingParamError).toHaveBeenCalledWith("use_mcp_tool", "tool_name")
			expect(mockPushToolResult).toHaveBeenCalledWith("Missing tool_name error")
		})

		it("should handle invalid JSON arguments", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test_server",
					tool_name: "test_tool",
					arguments: "invalid json",
				},
				partial: false,
			}

			await useMcpToolTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockTask.consecutiveMistakeCount).toBe(1)
			expect(mockTask.recordToolError).toHaveBeenCalledWith("use_mcp_tool")
			expect(mockTask.say).toHaveBeenCalledWith("error", expect.stringContaining("invalid JSON argument"))
			expect(mockPushToolResult).toHaveBeenCalledWith("Tool error: Invalid args for test_server:test_tool")
		})
	})

	describe("partial requests", () => {
		it("should handle partial requests", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test_server",
					tool_name: "test_tool",
					arguments: "{}",
				},
				partial: true,
			}

			mockTask.ask = vi.fn().mockResolvedValue(true)

			await useMcpToolTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockTask.ask).toHaveBeenCalledWith("use_mcp_server", expect.stringContaining("use_mcp_tool"), true)
		})
	})

	describe("successful execution", () => {
		it("should execute tool successfully with valid parameters", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test_server",
					tool_name: "test_tool",
					arguments: '{"param": "value"}',
				},
				partial: false,
			}

			mockAskApproval.mockResolvedValue(true)

			const mockToolResult = {
				content: [{ type: "text", text: "Tool executed successfully" }],
				isError: false,
			}

			mockProviderRef.deref.mockReturnValue({
				getMcpHub: () => ({
					callTool: vi.fn().mockResolvedValue(mockToolResult),
				}),
				postMessageToWebview: vi.fn(),
				getState: vi.fn().mockResolvedValue({
					mcpMaxImagesPerResponse: 20,
					mcpMaxImageSizeMB: 10,
				}),
			})

			await useMcpToolTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockTask.consecutiveMistakeCount).toBe(0)
			expect(mockAskApproval).toHaveBeenCalled()
			expect(mockTask.say).toHaveBeenCalledWith("mcp_server_request_started")
			expect(mockTask.say).toHaveBeenCalledWith("mcp_server_response", "Tool executed successfully", [])
			expect(mockPushToolResult).toHaveBeenCalledWith("Tool result: Tool executed successfully")
		})

		it("should handle tool result with text and images", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test_server",
					tool_name: "test_tool",
					arguments: '{"param": "value"}',
				},
				partial: false,
			}

			mockAskApproval.mockResolvedValue(true)

			const mockToolResult = {
				content: [
					{ type: "text", text: "Generated image:" },
					{
						type: "image",
						data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU",
						mimeType: "image/png",
					},
				],
				isError: false,
			}

			mockProviderRef.deref.mockReturnValue({
				getMcpHub: () => ({
					callTool: vi.fn().mockResolvedValue(mockToolResult),
				}),
				postMessageToWebview: vi.fn(),
				getState: vi.fn().mockResolvedValue({
					mcpMaxImagesPerResponse: 20,
					mcpMaxImageSizeMB: 10,
				}),
			})

			await useMcpToolTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockTask.consecutiveMistakeCount).toBe(0)
			expect(mockAskApproval).toHaveBeenCalled()
			expect(mockTask.say).toHaveBeenCalledWith("mcp_server_request_started")
			expect(mockTask.say).toHaveBeenCalledWith("mcp_server_response", "Generated image:", [
				"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU",
			])
			expect(mockPushToolResult).toHaveBeenCalledWith("Tool result: Generated image: (with 1 images)")
		})

		it("should handle tool result with only images (no text)", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test_server",
					tool_name: "test_tool",
					arguments: '{"param": "value"}',
				},
				partial: false,
			}

			mockAskApproval.mockResolvedValue(true)

			const mockToolResult = {
				content: [
					{
						type: "image",
						data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU",
						mimeType: "image/png",
					},
				],
				isError: false,
			}

			mockProviderRef.deref.mockReturnValue({
				getMcpHub: () => ({
					callTool: vi.fn().mockResolvedValue(mockToolResult),
				}),
				postMessageToWebview: vi.fn(),
				getState: vi.fn().mockResolvedValue({
					mcpMaxImagesPerResponse: 20,
					mcpMaxImageSizeMB: 10,
				}),
			})

			await useMcpToolTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockTask.consecutiveMistakeCount).toBe(0)
			expect(mockAskApproval).toHaveBeenCalled()
			expect(mockTask.say).toHaveBeenCalledWith("mcp_server_request_started")
			expect(mockTask.say).toHaveBeenCalledWith("mcp_server_response", "", [
				"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU",
			])
			expect(mockPushToolResult).toHaveBeenCalledWith("Tool result:  (with 1 images)")
		})

		it("should handle corrupted base64 image data gracefully", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test_server",
					tool_name: "test_tool",
					arguments: '{"param": "value"}',
				},
				partial: false,
			}

			mockAskApproval.mockResolvedValue(true)

			const mockToolResult = {
				content: [
					{ type: "text", text: "Generated content with images:" },
					{
						type: "image",
						data: "invalid@base64@data", // Invalid base64 characters
						mimeType: "image/png",
					},
					{
						type: "image",
						data: "", // Empty base64 data
						mimeType: "image/png",
					},
					{
						type: "image",
						data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU", // Valid base64
						mimeType: "image/png",
					},
				],
				isError: false,
			}

			mockProviderRef.deref.mockReturnValue({
				getMcpHub: () => ({
					callTool: vi.fn().mockResolvedValue(mockToolResult),
				}),
				postMessageToWebview: vi.fn(),
				getState: vi.fn().mockResolvedValue({
					mcpMaxImagesPerResponse: 20,
					mcpMaxImageSizeMB: 10,
				}),
			})

			// Spy on console.warn to verify error logging
			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			await useMcpToolTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Should continue processing despite corrupted images
			expect(mockTask.consecutiveMistakeCount).toBe(0)
			expect(mockAskApproval).toHaveBeenCalled()
			expect(mockTask.say).toHaveBeenCalledWith("mcp_server_request_started")

			// Should only include the valid image, not the corrupted ones
			expect(mockTask.say).toHaveBeenCalledWith("mcp_server_response", "Generated content with images:", [
				"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU",
			])
			expect(mockPushToolResult).toHaveBeenCalledWith(
				"Tool result: Generated content with images: (with 1 images)",
			)

			// Should log warnings for corrupted images
			expect(consoleSpy).toHaveBeenCalledWith("Invalid MCP ImageContent: base64 data contains invalid characters")
			expect(consoleSpy).toHaveBeenCalledWith("Invalid MCP ImageContent: base64 data is not a valid string")

			consoleSpy.mockRestore()
		})

		it("should handle non-string base64 data", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test_server",
					tool_name: "test_tool",
					arguments: '{"param": "value"}',
				},
				partial: false,
			}

			mockAskApproval.mockResolvedValue(true)

			const mockToolResult = {
				content: [
					{ type: "text", text: "Some text" },
					{
						type: "image",
						data: 12345, // Non-string data
						mimeType: "image/png",
					},
				],
				isError: false,
			}

			mockProviderRef.deref.mockReturnValue({
				getMcpHub: () => ({
					callTool: vi.fn().mockResolvedValue(mockToolResult),
				}),
				postMessageToWebview: vi.fn(),
				getState: vi.fn().mockResolvedValue({
					mcpMaxImagesPerResponse: 20,
					mcpMaxImageSizeMB: 10,
				}),
			})

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			await useMcpToolTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Should process text content normally
			expect(mockTask.say).toHaveBeenCalledWith("mcp_server_response", "Some text", [])
			expect(mockPushToolResult).toHaveBeenCalledWith("Tool result: Some text")

			// Should log warning for invalid data type
			expect(consoleSpy).toHaveBeenCalledWith("Invalid MCP ImageContent: base64 data is not a valid string")

			consoleSpy.mockRestore()
		})

		it("should limit the number of images to prevent performance issues", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test_server",
					tool_name: "test_tool",
					arguments: '{"param": "value"}',
				},
				partial: false,
			}

			mockAskApproval.mockResolvedValue(true)

			// Create more than 20 images (the current limit)
			const imageContent = Array.from({ length: 25 }, (_, i) => ({
				type: "image",
				data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU",
				mimeType: "image/png",
			}))

			const mockToolResult = {
				content: [{ type: "text", text: "Generated many images:" }, ...imageContent],
				isError: false,
			}

			mockProviderRef.deref.mockReturnValue({
				getMcpHub: () => ({
					callTool: vi.fn().mockResolvedValue(mockToolResult),
				}),
				postMessageToWebview: vi.fn(),
				getState: vi.fn().mockResolvedValue({
					mcpMaxImagesPerResponse: 20,
					mcpMaxImageSizeMB: 10,
				}),
			})

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			await useMcpToolTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Should only process first 20 images
			expect(mockTask.say).toHaveBeenCalledWith(
				"mcp_server_response",
				"Generated many images:",
				expect.arrayContaining([expect.stringMatching(/^data:image\/png;base64,/)]),
			)

			// Check that exactly 20 images were processed
			const sayCall = (mockTask.say as any).mock.calls.find((call: any) => call[0] === "mcp_server_response")
			expect(sayCall[2]).toHaveLength(20)

			// Should log warning about exceeding limit
			expect(consoleSpy).toHaveBeenCalledWith(
				"MCP response contains more than 20 images. Additional images will be ignored to prevent performance issues.",
			)

			expect(mockPushToolResult).toHaveBeenCalledWith("Tool result: Generated many images: (with 20 images)")

			consoleSpy.mockRestore()
		})

		it("should handle exactly the maximum number of images without warning", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test_server",
					tool_name: "test_tool",
					arguments: '{"param": "value"}',
				},
				partial: false,
			}

			mockAskApproval.mockResolvedValue(true)

			// Create exactly 20 images (the current limit)
			const imageContent = Array.from({ length: 20 }, (_, i) => ({
				type: "image",
				data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU",
				mimeType: "image/png",
			}))

			const mockToolResult = {
				content: [{ type: "text", text: "Generated exactly 20 images:" }, ...imageContent],
				isError: false,
			}

			mockProviderRef.deref.mockReturnValue({
				getMcpHub: () => ({
					callTool: vi.fn().mockResolvedValue(mockToolResult),
				}),
				postMessageToWebview: vi.fn(),
				getState: vi.fn().mockResolvedValue({
					mcpMaxImagesPerResponse: 20,
					mcpMaxImageSizeMB: 10,
				}),
			})

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			await useMcpToolTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Should process all 20 images
			const sayCall = (mockTask.say as any).mock.calls.find((call: any) => call[0] === "mcp_server_response")
			expect(sayCall[2]).toHaveLength(20)

			// Should NOT log warning about exceeding limit
			expect(consoleSpy).not.toHaveBeenCalledWith(
				expect.stringContaining("MCP response contains more than 20 images"),
			)

			expect(mockPushToolResult).toHaveBeenCalledWith(
				"Tool result: Generated exactly 20 images: (with 20 images)",
			)

			consoleSpy.mockRestore()
		})

		it("should respect custom maxImagesPerResponse setting", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test_server",
					tool_name: "test_tool",
					arguments: '{"param": "value"}',
				},
				partial: false,
			}

			mockAskApproval.mockResolvedValue(true)

			// Create 10 images (more than custom limit of 5)
			const imageContent = Array.from({ length: 10 }, () => ({
				type: "image",
				data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU",
				mimeType: "image/png",
			}))

			const mockToolResult = {
				content: [{ type: "text", text: "Generated many images:" }, ...imageContent],
				isError: false,
			}

			mockProviderRef.deref.mockReturnValue({
				getMcpHub: () => ({
					callTool: vi.fn().mockResolvedValue(mockToolResult),
				}),
				postMessageToWebview: vi.fn(),
				getState: vi.fn().mockResolvedValue({
					mcpMaxImagesPerResponse: 5,
					mcpMaxImageSizeMB: 10,
				}),
			})

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			await useMcpToolTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Should only process first 5 images (custom limit)
			const sayCall = (mockTask.say as any).mock.calls.find((call: any) => call[0] === "mcp_server_response")
			expect(sayCall[2]).toHaveLength(5)

			// Should log warning about exceeding custom limit
			expect(consoleSpy).toHaveBeenCalledWith(
				"MCP response contains more than 5 images. Additional images will be ignored to prevent performance issues.",
			)

			expect(mockPushToolResult).toHaveBeenCalledWith("Tool result: Generated many images: (with 5 images)")

			consoleSpy.mockRestore()
		})

		it("should reject images that exceed size limit", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test_server",
					tool_name: "test_tool",
					arguments: '{"param": "value"}',
				},
				partial: false,
			}

			mockAskApproval.mockResolvedValue(true)

			// Create a large base64 string (approximately 2MB when decoded)
			const largeBase64 = "A".repeat((2 * 1024 * 1024 * 4) / 3) // Base64 is ~33% larger than original
			const smallBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU"

			const mockToolResult = {
				content: [
					{ type: "text", text: "Generated images with different sizes:" },
					{
						type: "image",
						data: largeBase64, // This should be rejected (too large)
						mimeType: "image/png",
					},
					{
						type: "image",
						data: smallBase64, // This should be accepted
						mimeType: "image/png",
					},
				],
				isError: false,
			}

			mockProviderRef.deref.mockReturnValue({
				getMcpHub: () => ({
					callTool: vi.fn().mockResolvedValue(mockToolResult),
				}),
				postMessageToWebview: vi.fn(),
				getState: vi.fn().mockResolvedValue({
					mcpMaxImagesPerResponse: 20,
					mcpMaxImageSizeMB: 1,
				}),
			})

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			await useMcpToolTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Should only include the small image, not the large one
			const sayCall = (mockTask.say as any).mock.calls.find((call: any) => call[0] === "mcp_server_response")
			expect(sayCall[2]).toHaveLength(1)
			expect(sayCall[2][0]).toContain(smallBase64)

			// Should log warning about size exceeding limit
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringMatching(/MCP image exceeds size limit: .* > 1MB\. Image will be ignored\./),
			)

			expect(mockPushToolResult).toHaveBeenCalledWith(
				"Tool result: Generated images with different sizes: (with 1 images)",
			)

			consoleSpy.mockRestore()
		})

		it("should handle user rejection", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test_server",
					tool_name: "test_tool",
					arguments: "{}",
				},
				partial: false,
			}

			mockAskApproval.mockResolvedValue(false)

			await useMcpToolTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockTask.say).not.toHaveBeenCalledWith("mcp_server_request_started")
			expect(mockPushToolResult).not.toHaveBeenCalled()
		})
	})

	describe("error handling", () => {
		it("should handle unexpected errors", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "use_mcp_tool",
				params: {
					server_name: "test_server",
					tool_name: "test_tool",
				},
				partial: false,
			}

			const error = new Error("Unexpected error")
			mockAskApproval.mockRejectedValue(error)

			await useMcpToolTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockHandleError).toHaveBeenCalledWith("executing MCP tool", error)
		})
	})
})
