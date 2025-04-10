// npx jest src/core/tools/__tests__/BaseTool.test.ts

import { describe, expect, it, jest, beforeEach } from "@jest/globals"
import { BaseTool } from "../BaseTool"
import { Cline } from "../../Cline"
import { ToolUse } from "../../assistant-message"
import { AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../types"

// Create a concrete implementation of BaseTool for testing
class TestTool extends BaseTool {
	public getName(): string {
		return "test_tool"
	}

	public async execute(
		cline: Cline,
		block: ToolUse,
		askApproval: AskApproval,
		handleError: HandleError,
		pushToolResult: PushToolResult,
		removeClosingTag: RemoveClosingTag,
	): Promise<void> {
		// Simple implementation that just calls the helper methods
		const requiredParams = ["param1", "param2"]
		const isValid = await this.validateRequiredParams(cline, block, pushToolResult, requiredParams)

		if (!isValid) {
			return
		}

		if (await this.handlePartial(cline, block, "partial message")) {
			return
		}

		pushToolResult("Test tool executed successfully")
	}
}

describe("BaseTool", () => {
	// Setup common test variables
	let mockCline: jest.Mocked<Partial<Cline>> & { consecutiveMistakeCount: number }
	let mockAskApproval: jest.Mock
	let mockHandleError: jest.Mock
	let mockPushToolResult: jest.Mock
	let mockRemoveClosingTag: jest.Mock
	let mockToolUse: ToolUse
	let testTool: TestTool

	beforeEach(() => {
		// Reset mocks
		jest.clearAllMocks()

		// Create mock implementations
		mockCline = {
			// @ts-expect-error - Jest mock function type issues
			ask: jest.fn().mockResolvedValue(undefined),
			// @ts-expect-error - Jest mock function type issues
			sayAndCreateMissingParamError: jest.fn().mockResolvedValue("Missing parameter error"),
			consecutiveMistakeCount: 0,
		}

		// @ts-expect-error - Jest mock function type issues
		mockAskApproval = jest.fn().mockResolvedValue(true)
		// @ts-expect-error - Jest mock function type issues
		mockHandleError = jest.fn().mockResolvedValue(undefined)
		mockPushToolResult = jest.fn()
		mockRemoveClosingTag = jest.fn().mockImplementation((tag, value) => value || "")

		// Create a mock tool use object
		mockToolUse = {
			type: "tool_use",
			name: "test_tool",
			params: {
				param1: "value1",
				param2: "value2",
			},
			partial: false,
		}

		// Create test tool instance
		testTool = new TestTool()
	})

	describe("validateRequiredParams", () => {
		it("should return true when all required parameters are present", async () => {
			// Execute
			const result = await testTool["validateRequiredParams"](
				mockCline as unknown as Cline,
				mockToolUse,
				mockPushToolResult as unknown as PushToolResult,
				["param1", "param2"],
			)

			// Verify
			expect(result).toBe(true)
			expect(mockCline.consecutiveMistakeCount).toBe(0)
			expect(mockCline.sayAndCreateMissingParamError).not.toHaveBeenCalled()
			expect(mockPushToolResult).not.toHaveBeenCalled()
		})

		it("should return false when a required parameter is missing", async () => {
			// Setup
			mockToolUse.params = { param1: "value1" } // param2 is missing

			// Execute
			const result = await testTool["validateRequiredParams"](
				mockCline as unknown as Cline,
				mockToolUse,
				mockPushToolResult as unknown as PushToolResult,
				["param1", "param2"],
			)

			// Verify
			expect(result).toBe(false)
			expect(mockCline.consecutiveMistakeCount).toBe(1)
			expect(mockCline.sayAndCreateMissingParamError).toHaveBeenCalledWith("test_tool", "param2")
			expect(mockPushToolResult).toHaveBeenCalledWith("Missing parameter error")
		})
	})

	describe("handlePartial", () => {
		it("should return false when block is not partial", async () => {
			// Setup
			mockToolUse.partial = false

			// Execute
			const result = await testTool["handlePartial"](
				mockCline as unknown as Cline,
				mockToolUse,
				"partial message",
			)

			// Verify
			expect(result).toBe(false)
			expect(mockCline.ask).not.toHaveBeenCalled()
		})

		it("should return true and call ask when block is partial", async () => {
			// Setup
			mockToolUse.partial = true

			// Execute
			const result = await testTool["handlePartial"](
				mockCline as unknown as Cline,
				mockToolUse,
				"partial message",
			)

			// Verify
			expect(result).toBe(true)
			expect(mockCline.ask).toHaveBeenCalledWith("tool", "partial message", true)
		})
	})

	describe("execute", () => {
		it("should execute the tool successfully with valid parameters", async () => {
			// Execute
			await testTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockPushToolResult).toHaveBeenCalledWith("Test tool executed successfully")
		})

		it("should not execute the tool when required parameters are missing", async () => {
			// Setup
			mockToolUse.params = { param1: "value1" } // param2 is missing

			// Execute
			await testTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockPushToolResult).toHaveBeenCalledWith("Missing parameter error")
			expect(mockPushToolResult).not.toHaveBeenCalledWith("Test tool executed successfully")
		})

		it("should handle partial blocks correctly", async () => {
			// Setup
			mockToolUse.partial = true

			// Execute
			await testTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockCline.ask).toHaveBeenCalledWith("tool", "partial message", true)
			expect(mockPushToolResult).not.toHaveBeenCalled()
		})
	})
})
