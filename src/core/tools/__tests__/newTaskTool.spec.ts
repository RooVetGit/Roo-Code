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

// Mock the Cline instance and its methods/properties
const mockCline = {
	ask: vi.fn(),
	sayAndCreateMissingParamError: mockSayAndCreateMissingParamError,
	emit: mockEmit,
	recordToolError: mockRecordToolError,
	consecutiveMistakeCount: 0,
	isPaused: false,
	pausedModeSlug: "ask",
	getAskResponseValues: undefined as Record<string, any> | undefined,
	providerRef: {
		deref: vi.fn(() => ({
			getState: vi.fn(() => ({ customModes: [], mode: "ask" })),
			handleModeSwitch: vi.fn(),
			initClineWithTask: mockInitClineWithTask,
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
		)
	})

	// Add more tests for error handling (missing params, invalid mode, approval denied) if needed

	it("should use user-selected mode when provided in askResponseValues", async () => {
		const block: ToolUse = {
			type: "tool_use",
			name: "new_task",
			params: {
				mode: "code",
				message: "Create a new feature",
			},
			partial: false,
		}

		// Mock user selecting a different mode
		mockCline.getAskResponseValues = { selectedMode: "architect" }

		// Mock the architect mode
		vi.mocked(getModeBySlug).mockImplementation((slug) => {
			if (slug === "architect") {
				return {
					slug: "architect",
					name: "Architect Mode",
					roleDefinition: "Architecture role definition",
					groups: ["command", "read"],
				}
			}
			return {
				slug: "code",
				name: "Code Mode",
				roleDefinition: "Test role definition",
				groups: ["command", "read", "edit"],
			}
		})

		const mockHandleModeSwitch = vi.fn()
		mockCline.providerRef.deref = vi.fn(() => ({
			getState: vi.fn(() => ({ customModes: [], mode: "ask" })),
			handleModeSwitch: mockHandleModeSwitch,
			initClineWithTask: mockInitClineWithTask,
		}))

		await newTaskTool(
			mockCline as any,
			block,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Verify the mode switch was called with the user-selected mode
		expect(mockHandleModeSwitch).toHaveBeenCalledWith("architect")

		// Verify the success message includes the correct mode name
		expect(mockPushToolResult).toHaveBeenCalledWith(
			expect.stringContaining("Successfully created new task in Architect Mode"),
		)
	})

	it("should use original mode when no user selection is provided", async () => {
		const block: ToolUse = {
			type: "tool_use",
			name: "new_task",
			params: {
				mode: "code",
				message: "Create a new feature",
			},
			partial: false,
		}

		// No user selection
		mockCline.getAskResponseValues = undefined

		const mockHandleModeSwitch = vi.fn()
		mockCline.providerRef.deref = vi.fn(() => ({
			getState: vi.fn(() => ({ customModes: [], mode: "ask" })),
			handleModeSwitch: mockHandleModeSwitch,
			initClineWithTask: mockInitClineWithTask,
		}))

		await newTaskTool(
			mockCline as any,
			block,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Verify the mode switch was called with the original mode
		expect(mockHandleModeSwitch).toHaveBeenCalledWith("code")

		// Verify the success message includes the correct mode name
		expect(mockPushToolResult).toHaveBeenCalledWith(
			expect.stringContaining("Successfully created new task in Code Mode"),
		)
	})

	it("should handle invalid user-selected mode gracefully", async () => {
		const block: ToolUse = {
			type: "tool_use",
			name: "new_task",
			params: {
				mode: "code",
				message: "Create a new feature",
			},
			partial: false,
		}

		// Mock user selecting an invalid mode
		mockCline.getAskResponseValues = { selectedMode: "invalid-mode" }

		// Mock getModeBySlug to return undefined for invalid mode
		vi.mocked(getModeBySlug).mockImplementation((slug) => {
			if (slug === "invalid-mode") {
				return undefined
			}
			return {
				slug: "code",
				name: "Code Mode",
				roleDefinition: "Test role definition",
				groups: ["command", "read", "edit"],
			}
		})

		await newTaskTool(
			mockCline as any,
			block,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Verify error was pushed
		expect(mockPushToolResult).toHaveBeenCalledWith("Tool Error: Invalid mode: invalid-mode")

		// Verify no task was created
		expect(mockInitClineWithTask).not.toHaveBeenCalled()
	})
})
