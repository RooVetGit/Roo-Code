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
const mockCreateTask = vi.fn<() => Promise<MockClineInstance>>().mockResolvedValue({ taskId: "mock-subtask-id" })
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
	subtaskContextByMode: undefined as Map<string, string[]> | undefined,
	currentSubtaskMode: undefined as string | undefined,
	providerRef: {
		deref: vi.fn(() => ({
			getState: vi.fn(() => ({ customModes: [], mode: "ask" })),
			handleModeSwitch: vi.fn(),
			createTask: mockCreateTask,
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
		mockCline.subtaskContextByMode = undefined
		mockCline.currentSubtaskMode = undefined
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

		// Verify the message passed to createTask reflects the code's behavior in unit tests
		expect(mockCreateTask).toHaveBeenCalledWith(
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

		expect(mockCreateTask).toHaveBeenCalledWith(
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

		expect(mockCreateTask).toHaveBeenCalledWith(
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

		expect(mockCreateTask).toHaveBeenCalledWith(
			"Mix: @file0.txt, \\@file1.txt, \\@file2.txt, \\\\\\@file3.txt", // Unit Test Expectation: @->@, \@->\@, \\@->\@, \\\\@->\\\\@
			undefined,
			mockCline,
		)
	})

	describe("context preservation", () => {
		it("should initialize subtaskContextByMode map if not exists", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "new_task",
				params: {
					mode: "architect",
					message: "Design a system",
				},
				partial: false,
			}

			vi.mocked(getModeBySlug).mockReturnValue({
				slug: "architect",
				name: "🏗️ Architect",
				roleDefinition: "Test role definition",
				groups: ["read", "edit"],
			})

			await newTaskTool(
				mockCline as any,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockCline.subtaskContextByMode).toBeInstanceOf(Map)
			expect(mockCline.currentSubtaskMode).toBe("architect")
		})

		it("should include previous context when calling same mode multiple times", async () => {
			// Set up previous context
			mockCline.subtaskContextByMode = new Map([
				["architect", ["Created initial system design with 3 microservices"]],
			])

			const block: ToolUse = {
				type: "tool_use",
				name: "new_task",
				params: {
					mode: "architect",
					message: "Add authentication to the design",
				},
				partial: false,
			}

			vi.mocked(getModeBySlug).mockReturnValue({
				slug: "architect",
				name: "🏗️ Architect",
				roleDefinition: "Test role definition",
				groups: ["read", "edit"],
			})

			await newTaskTool(
				mockCline as any,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Verify the enhanced message includes context
			expect(mockCreateTask).toHaveBeenCalledWith(
				expect.stringContaining("[Context from previous 🏗️ Architect subtasks]"),
				undefined,
				mockCline,
			)
			expect(mockCreateTask).toHaveBeenCalledWith(
				expect.stringContaining(
					"Previous 🏗️ Architect subtask 1 result: Created initial system design with 3 microservices",
				),
				undefined,
				mockCline,
			)
			expect(mockCreateTask).toHaveBeenCalledWith(
				expect.stringContaining("Add authentication to the design"),
				undefined,
				mockCline,
			)
		})

		it("should handle multiple previous contexts", async () => {
			// Set up multiple previous contexts
			mockCline.subtaskContextByMode = new Map([
				["architect", ["Created initial system design", "Added database schema", "Defined API endpoints"]],
			])

			const block: ToolUse = {
				type: "tool_use",
				name: "new_task",
				params: {
					mode: "architect",
					message: "Add caching layer",
				},
				partial: false,
			}

			vi.mocked(getModeBySlug).mockReturnValue({
				slug: "architect",
				name: "🏗️ Architect",
				roleDefinition: "Test role definition",
				groups: ["read", "edit"],
			})

			await newTaskTool(
				mockCline as any,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockCreateTask).toHaveBeenCalled()
			const calls = mockCreateTask.mock.calls as any[]
			expect(calls.length).toBeGreaterThan(0)
			const callArgs = calls[0][0] as string
			expect(callArgs).toContain("Previous 🏗️ Architect subtask 1 result: Created initial system design")
			expect(callArgs).toContain("Previous 🏗️ Architect subtask 2 result: Added database schema")
			expect(callArgs).toContain("Previous 🏗️ Architect subtask 3 result: Defined API endpoints")
		})

		it("should not include context for different modes", async () => {
			// Set up context for architect mode
			mockCline.subtaskContextByMode = new Map([["architect", ["Created system design"]]])

			// Call code mode instead
			const block: ToolUse = {
				type: "tool_use",
				name: "new_task",
				params: {
					mode: "code",
					message: "Implement the feature",
				},
				partial: false,
			}

			vi.mocked(getModeBySlug).mockReturnValue({
				slug: "code",
				name: "💻 Code",
				roleDefinition: "Test role definition",
				groups: ["command", "read", "edit"],
			})

			await newTaskTool(
				mockCline as any,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Should not include architect context
			expect(mockCreateTask).toHaveBeenCalledWith(
				"Implement the feature", // No context prepended
				undefined,
				mockCline,
			)
		})

		it("should set currentSubtaskMode for tracking", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "new_task",
				params: {
					mode: "debug",
					message: "Find the bug",
				},
				partial: false,
			}

			vi.mocked(getModeBySlug).mockReturnValue({
				slug: "debug",
				name: "🪲 Debug",
				roleDefinition: "Test role definition",
				groups: ["command", "read", "edit"],
			})

			await newTaskTool(
				mockCline as any,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockCline.currentSubtaskMode).toBe("debug")
		})
	})

	// Add more tests for error handling (missing params, invalid mode, approval denied) if needed
})
