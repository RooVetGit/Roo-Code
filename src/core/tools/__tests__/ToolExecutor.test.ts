// npx jest src/core/tools/__tests__/ToolExecutor.test.ts

import { describe, expect, it, jest, beforeEach } from "@jest/globals"
import { ToolExecutor } from "../ToolExecutor"
import { ToolFactory } from "../ToolFactory"
import { BaseTool } from "../BaseTool"
import { Cline } from "../../Cline"
import { ToolUse } from "../../assistant-message"
import {
	AskApproval,
	HandleError,
	PushToolResult,
	RemoveClosingTag,
	ToolDescription,
	AskFinishSubTaskApproval,
} from "../types"
import { formatResponse } from "../../prompts/responses"
import { validateToolUse } from "../../mode-validator"

// Mock dependencies
jest.mock("../ToolFactory")
jest.mock("../../mode-validator")
jest.mock("../../prompts/responses")

describe("ToolExecutor", () => {
	// Setup common test variables
	let toolExecutor: ToolExecutor
	let mockToolFactory: jest.Mocked<ToolFactory>
	let mockTool: jest.Mocked<BaseTool>
	let mockCline: jest.Mocked<Partial<Cline>> & { consecutiveMistakeCount: number; providerRef: { deref: jest.Mock } }
	let mockAskApproval: jest.Mock
	let mockHandleError: jest.Mock
	let mockPushToolResult: jest.Mock
	let mockRemoveClosingTag: jest.Mock
	let mockToolDescription: jest.Mock
	let mockAskFinishSubTaskApproval: jest.Mock
	let mockToolUse: ToolUse

	beforeEach(() => {
		// Reset mocks
		jest.clearAllMocks()

		// Create mock implementations
		mockTool = {
			getName: jest.fn().mockReturnValue("test_tool"),
			execute: jest.fn().mockResolvedValue(undefined),
		} as unknown as jest.Mocked<BaseTool>

		mockToolFactory = {
			getInstance: jest.fn().mockReturnThis(),
			getTool: jest.fn().mockReturnValue(mockTool),
			hasTool: jest.fn().mockReturnValue(true),
			registerTool: jest.fn(),
			getAllTools: jest.fn().mockReturnValue(new Map([["test_tool", mockTool]])),
		} as unknown as jest.Mocked<ToolFactory>

		// Mock ToolFactory.getInstance to return our mock
		;(ToolFactory.getInstance as jest.Mock).mockReturnValue(mockToolFactory)

		mockCline = {
			consecutiveMistakeCount: 0,
			diffEnabled: true,
			providerRef: {
				deref: jest.fn().mockReturnValue({
					getState: jest.fn().mockResolvedValue({
						mode: "code",
						customModes: [],
					}),
				}),
			},
		} as unknown as jest.Mocked<Partial<Cline>> & {
			consecutiveMistakeCount: number
			providerRef: { deref: jest.Mock }
		}

		mockAskApproval = jest.fn().mockResolvedValue(true)
		mockHandleError = jest.fn().mockResolvedValue(undefined)
		mockPushToolResult = jest.fn()
		mockRemoveClosingTag = jest.fn().mockImplementation((tag, value) => value || "")
		mockToolDescription = jest.fn().mockReturnValue("Test Tool Description")
		mockAskFinishSubTaskApproval = jest.fn().mockResolvedValue(true)

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

		// Create ToolExecutor instance
		toolExecutor = new ToolExecutor()
	})

	describe("executeToolUse", () => {
		it("should execute a tool successfully", async () => {
			// Setup
			;(validateToolUse as jest.Mock).mockImplementation(() => {})

			// Execute
			await toolExecutor.executeToolUse(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
				mockToolDescription as unknown as ToolDescription,
				mockAskFinishSubTaskApproval as unknown as AskFinishSubTaskApproval,
			)

			// Verify
			expect(validateToolUse).toHaveBeenCalledWith(
				mockToolUse.name,
				"code",
				[],
				{ apply_diff: true },
				mockToolUse.params,
			)
			expect(mockToolFactory.getTool).toHaveBeenCalledWith(mockToolUse.name)
			expect(mockTool.execute).toHaveBeenCalledWith(
				mockCline,
				mockToolUse,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
				mockToolDescription,
				mockAskFinishSubTaskApproval,
			)
		})

		it("should handle tool validation errors", async () => {
			// Setup
			const validationError = new Error("Tool validation error")
			;(validateToolUse as jest.Mock).mockImplementation(() => {
				throw validationError
			})
			;(formatResponse.toolError as jest.Mock).mockReturnValue("Formatted error")

			// Execute
			await toolExecutor.executeToolUse(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(validateToolUse).toHaveBeenCalled()
			expect(mockCline.consecutiveMistakeCount).toBe(1)
			expect(formatResponse.toolError).toHaveBeenCalledWith(validationError.message)
			expect(mockPushToolResult).toHaveBeenCalledWith("Formatted error")
			expect(mockTool.execute).not.toHaveBeenCalled()
		})

		it("should handle unknown tools", async () => {
			// Setup
			mockToolFactory.getTool.mockReturnValue(undefined)
			;(formatResponse.toolError as jest.Mock).mockReturnValue("Unknown tool error")

			// Execute
			await toolExecutor.executeToolUse(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockToolFactory.getTool).toHaveBeenCalledWith(mockToolUse.name)
			expect(mockCline.consecutiveMistakeCount).toBe(1)
			expect(formatResponse.toolError).toHaveBeenCalledWith(`Unknown tool: ${mockToolUse.name}`)
			expect(mockPushToolResult).toHaveBeenCalledWith("Unknown tool error")
			expect(mockTool.execute).not.toHaveBeenCalled()
		})
	})
})
