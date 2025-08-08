// npx vitest core/tools/__tests__/newTaskTool.spec.ts

import type { AskApproval, HandleError } from "../../../shared/tools"

// Mock other modules first - these are hoisted to the top
vi.mock("../../../shared/modes", () => ({
	getModeBySlug: vi.fn(),
	defaultModeSlug: "ask",
}))

vi.mock("../../prompts/responses", () => ({
	formatResponse: {
		toolError: vi.fn((msg: string) => `Tool Error: ${msg}`),
	},
}))

// Define a minimal type for the resolved value
type MockClineInstance = { taskId: string }

// Mock dependencies after modules are mocked
const mockAskApproval = vi.fn<AskApproval>()
const mockHandleError = vi.fn<HandleError>()
const mockPushToolResult = vi.fn()
const mockRemoveClosingTag = vi.fn((_name: string, value: string | undefined) => value ?? "")
const mockInitClineWithTask = vi.fn<() => Promise<MockClineInstance>>().mockResolvedValue({ taskId: "mock-subtask-id" })
const mockEmit = vi.fn()
const mockRecordToolError = vi.fn()
const mockSayAndCreateMissingParamError = vi.fn()
const mockHasConfig = vi.fn()

// Mock the Cline instance and its methods/properties
const mockCline = {
	ask: vi.fn(),
	sayAndCreateMissingParamError: mockSayAndCreateMissingParamError,
	emit: mockEmit,
	recordToolError: mockRecordToolError,
	consecutiveMistakeCount: 0,
	isPaused: false,
	pausedModeSlug: "ask",
	providerRef: {
		deref: vi.fn(() => ({
			getState: vi.fn(() => ({ customModes: [], mode: "ask" })),
			handleModeSwitch: vi.fn(),
			initClineWithTask: mockInitClineWithTask,
			providerSettingsManager: {
				hasConfig: mockHasConfig,
			},
		})),
	},
}

// Import the function to test AFTER mocks are set up
import { newTaskTool } from "../newTaskTool"
import type { ToolUse } from "../../../shared/tools"
import { getModeBySlug } from "../../../shared/modes"

describe("newTaskTool", () => {
	beforeEach(() => {
		// Reset mocks before each test
		vi.clearAllMocks()
		mockAskApproval.mockResolvedValue(true) // Default to approved
		vi.mocked(getModeBySlug).mockReturnValue({
			slug: "code",
			name: "Code Mode",
			roleDefinition: "Test role definition",
			groups: ["command", "read", "edit"],
		}) // Default valid mode
		mockCline.consecutiveMistakeCount = 0
		mockCline.isPaused = false
		mockHasConfig.mockResolvedValue(true) // Default to config exists
	})

	it("should correctly un-escape \\\\@ to \\@ in the message passed to the new task", async () => {
		const block: ToolUse = {
			type: "tool_use", // Add required 'type' property
			name: "new_task", // Correct property name
			params: {
				mode: "code",
				message: "Review this: \\\\@file1.txt and also \\\\\\\\@file2.txt", // Input with \\@ and \\\\@
			},
			partial: false,
		}

		await newTaskTool(
			mockCline as any, // Use 'as any' for simplicity in mocking complex type
			block,
			mockAskApproval, // Now correctly typed
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Verify askApproval was called
		expect(mockAskApproval).toHaveBeenCalled()

		// Verify the message passed to initClineWithTask reflects the code's behavior in unit tests
		expect(mockInitClineWithTask).toHaveBeenCalledWith(
			"Review this: \\@file1.txt and also \\\\\\@file2.txt", // Unit Test Expectation: \\@ -> \@, \\\\@ -> \\\\@
			undefined,
			mockCline,
			undefined, // No config parameter for this test
		)

		// Verify side effects
		expect(mockCline.emit).toHaveBeenCalledWith("taskSpawned", expect.any(String)) // Assuming initCline returns a mock task ID
		expect(mockCline.isPaused).toBe(true)
		expect(mockCline.emit).toHaveBeenCalledWith("taskPaused")
		expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("Successfully created new task"))
	})

	it("should not un-escape single escaped \@", async () => {
		const block: ToolUse = {
			type: "tool_use", // Add required 'type' property
			name: "new_task", // Correct property name
			params: {
				mode: "code",
				message: "This is already unescaped: \\@file1.txt",
			},
			partial: false,
		}

		await newTaskTool(
			mockCline as any,
			block,
			mockAskApproval, // Now correctly typed
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockInitClineWithTask).toHaveBeenCalledWith(
			"This is already unescaped: \\@file1.txt", // Expected: \@ remains \@
			undefined,
			mockCline,
			undefined, // No config parameter for this test
		)
	})

	it("should not un-escape non-escaped @", async () => {
		const block: ToolUse = {
			type: "tool_use", // Add required 'type' property
			name: "new_task", // Correct property name
			params: {
				mode: "code",
				message: "A normal mention @file1.txt",
			},
			partial: false,
		}

		await newTaskTool(
			mockCline as any,
			block,
			mockAskApproval, // Now correctly typed
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockInitClineWithTask).toHaveBeenCalledWith(
			"A normal mention @file1.txt", // Expected: @ remains @
			undefined,
			mockCline,
			undefined, // No config parameter for this test
		)
	})

	it("should handle mixed escaping scenarios", async () => {
		const block: ToolUse = {
			type: "tool_use", // Add required 'type' property
			name: "new_task", // Correct property name
			params: {
				mode: "code",
				message: "Mix: @file0.txt, \\@file1.txt, \\\\@file2.txt, \\\\\\\\@file3.txt",
			},
			partial: false,
		}

		await newTaskTool(
			mockCline as any,
			block,
			mockAskApproval, // Now correctly typed
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockInitClineWithTask).toHaveBeenCalledWith(
			"Mix: @file0.txt, \\@file1.txt, \\@file2.txt, \\\\\\@file3.txt", // Unit Test Expectation: @->@, \@->\@, \\@->\@, \\\\@->\\\\@
			undefined,
			mockCline,
			undefined, // No config parameter for this test
		)
	})

	// Tests for the new config parameter functionality
	describe("config parameter", () => {
		it("should pass config parameter to initClineWithTask when valid config is provided", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "new_task",
				params: {
					mode: "code",
					message: "Test message",
					config: "fast-model",
				},
				partial: false,
			}

			mockHasConfig.mockResolvedValue(true)

			await newTaskTool(
				mockCline as any,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Verify hasConfig was called to validate the config
			expect(mockHasConfig).toHaveBeenCalledWith("fast-model")

			// Verify initClineWithTask was called with the config parameter
			expect(mockInitClineWithTask).toHaveBeenCalledWith(
				"Test message",
				undefined,
				mockCline,
				"fast-model", // The config parameter should be passed
			)

			// Verify success message includes config name
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("configuration 'fast-model'"))
		})

		it("should continue without config when invalid config is provided", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "new_task",
				params: {
					mode: "code",
					message: "Test message",
					config: "non-existent-config",
				},
				partial: false,
			}

			mockHasConfig.mockResolvedValue(false)

			await newTaskTool(
				mockCline as any,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Verify hasConfig was called
			expect(mockHasConfig).toHaveBeenCalledWith("non-existent-config")

			// Verify error message was pushed
			expect(mockPushToolResult).toHaveBeenCalledWith(
				expect.stringContaining("Configuration profile 'non-existent-config' not found"),
			)

			// Verify initClineWithTask was called without the config parameter
			expect(mockInitClineWithTask).toHaveBeenCalledWith(
				"Test message",
				undefined,
				mockCline,
				undefined, // No config should be passed
			)

			// Verify success message doesn't include config
			expect(mockPushToolResult).toHaveBeenCalledWith(
				expect.stringContaining("Successfully created new task in Code Mode mode with message: Test message"),
			)
		})

		it("should work without config parameter (backward compatibility)", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "new_task",
				params: {
					mode: "code",
					message: "Test message",
					// No config parameter
				},
				partial: false,
			}

			await newTaskTool(
				mockCline as any,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Verify hasConfig was NOT called
			expect(mockHasConfig).not.toHaveBeenCalled()

			// Verify initClineWithTask was called without config
			expect(mockInitClineWithTask).toHaveBeenCalledWith(
				"Test message",
				undefined,
				mockCline,
				undefined, // No config parameter
			)

			// Verify success message doesn't include config
			expect(mockPushToolResult).toHaveBeenCalledWith(
				expect.stringContaining("Successfully created new task in Code Mode mode with message: Test message"),
			)
		})

		it("should include config in approval message when config is provided", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "new_task",
				params: {
					mode: "code",
					message: "Test message",
					config: "accurate-model",
				},
				partial: false,
			}

			mockHasConfig.mockResolvedValue(true)

			await newTaskTool(
				mockCline as any,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Verify askApproval was called with a message containing the config
			expect(mockAskApproval).toHaveBeenCalledWith("tool", expect.stringContaining('"config":"accurate-model"'))
		})

		it("should handle partial messages with config parameter", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "new_task",
				params: {
					mode: "code",
					message: "Test message",
					config: "fast-model",
				},
				partial: true,
			}

			await newTaskTool(
				mockCline as any,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Verify ask was called with partial message including config
			expect(mockCline.ask).toHaveBeenCalledWith("tool", expect.stringContaining('"config":"fast-model"'), true)

			// Verify initClineWithTask was NOT called for partial message
			expect(mockInitClineWithTask).not.toHaveBeenCalled()
		})
	})

	// Add more tests for error handling (missing params, invalid mode, approval denied) if needed
})
