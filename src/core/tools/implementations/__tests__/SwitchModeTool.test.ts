// npx jest src/core/tools/implementations/__tests__/SwitchModeTool.test.ts

import { describe, expect, it, jest, beforeEach } from "@jest/globals"
import { SwitchModeTool } from "../SwitchModeTool"
import { Cline } from "../../../Cline"
import { ToolUse } from "../../../assistant-message"
import { AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../types"
import { formatResponse } from "../../../prompts/responses"
import * as modes from "../../../../shared/modes"

// Mock dependencies
jest.mock("../../../../shared/modes")
jest.mock("../../../prompts/responses")
jest.mock("delay", () => jest.fn().mockResolvedValue(undefined))

describe("SwitchModeTool", () => {
	// Setup common test variables
	let switchModeTool: SwitchModeTool
	let mockCline: jest.Mocked<Partial<Cline>> & {
		consecutiveMistakeCount: number
		providerRef: { deref: jest.Mock }
	}
	let mockAskApproval: jest.Mock
	let mockHandleError: jest.Mock
	let mockPushToolResult: jest.Mock
	let mockRemoveClosingTag: jest.Mock
	let mockToolUse: ToolUse
	let mockProvider: { getState: jest.Mock; handleModeSwitch: jest.Mock }

	beforeEach(() => {
		// Reset mocks
		jest.clearAllMocks()

		// Mock modes functions
		;(modes.getModeBySlug as jest.Mock).mockImplementation((slug) => {
			if (slug === "code") return { name: "Code" }
			if (slug === "ask") return { name: "Ask" }
			return null
		})
		;(modes.defaultModeSlug as unknown) = "ask"

		// Create mock provider
		mockProvider = {
			getState: jest.fn().mockResolvedValue({ mode: "ask", customModes: [] }),
			handleModeSwitch: jest.fn().mockResolvedValue(undefined),
		}

		// Create mock implementations
		mockCline = {
			consecutiveMistakeCount: 0,
			say: jest.fn().mockResolvedValue(undefined),
			sayAndCreateMissingParamError: jest.fn().mockResolvedValue("Missing parameter error"),
			ask: jest.fn().mockResolvedValue({ response: "yesButtonClicked" }),
			providerRef: {
				deref: jest.fn().mockReturnValue(mockProvider),
			},
		} as unknown as jest.Mocked<Partial<Cline>> & {
			consecutiveMistakeCount: number
			providerRef: { deref: jest.Mock }
		}

		mockAskApproval = jest.fn().mockResolvedValue(true)
		mockHandleError = jest.fn().mockResolvedValue(undefined)
		mockPushToolResult = jest.fn()
		mockRemoveClosingTag = jest.fn().mockImplementation((tag, value) => value || "")

		// Create a mock tool use object
		mockToolUse = {
			type: "tool_use",
			name: "switch_mode",
			params: {
				mode_slug: "code",
				reason: "Need to make code changes",
			},
			partial: false,
		}

		// Create SwitchModeTool instance
		switchModeTool = new SwitchModeTool()
	})

	describe("getName", () => {
		it("should return the correct tool name", () => {
			expect(switchModeTool.getName()).toBe("switch_mode")
		})
	})

	describe("execute", () => {
		it("should switch mode successfully", async () => {
			// Execute
			await switchModeTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(modes.getModeBySlug).toHaveBeenCalledWith("code", [])
			expect(mockAskApproval).toHaveBeenCalled()
			expect(mockProvider.handleModeSwitch).toHaveBeenCalledWith("code")
			expect(mockPushToolResult).toHaveBeenCalledWith(
				"Successfully switched from Ask mode to Code mode because: Need to make code changes.",
			)
		})

		it("should handle partial blocks", async () => {
			// Setup
			mockToolUse.partial = true

			// Execute
			await switchModeTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockCline.ask).toHaveBeenCalled()
			expect(mockProvider.handleModeSwitch).not.toHaveBeenCalled()
			expect(mockPushToolResult).not.toHaveBeenCalled()
		})

		it("should handle missing mode_slug parameter", async () => {
			// Setup
			mockToolUse.params = {
				reason: "Need to make code changes",
			}

			// Execute
			await switchModeTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockCline.consecutiveMistakeCount).toBe(1)
			expect(mockCline.sayAndCreateMissingParamError).toHaveBeenCalledWith("switch_mode", "mode_slug")
			expect(mockPushToolResult).toHaveBeenCalledWith("Missing parameter error")
		})

		it("should handle invalid mode", async () => {
			// Setup
			mockToolUse.params.mode_slug = "invalid_mode"
			;(modes.getModeBySlug as jest.Mock).mockReturnValueOnce(null)
			;(formatResponse.toolError as jest.Mock).mockReturnValue("Invalid mode error")

			// Execute
			await switchModeTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(formatResponse.toolError).toHaveBeenCalledWith("Invalid mode: invalid_mode")
			expect(mockPushToolResult).toHaveBeenCalledWith("Invalid mode error")
		})

		it("should handle already in requested mode", async () => {
			// Setup
			mockToolUse.params.mode_slug = "ask"

			// Execute
			await switchModeTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockPushToolResult).toHaveBeenCalledWith("Already in Ask mode.")
			expect(mockProvider.handleModeSwitch).not.toHaveBeenCalled()
		})

		it("should handle errors", async () => {
			// Setup
			const error = new Error("Test error")
			mockProvider.handleModeSwitch.mockRejectedValue(error)

			// Execute
			await switchModeTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockHandleError).toHaveBeenCalledWith("switching mode", error)
		})
	})
})
