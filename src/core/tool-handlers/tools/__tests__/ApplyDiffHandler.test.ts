import * as path from "path"
import * as fs from "fs/promises"
import { ApplyDiffHandler } from "../ApplyDiffHandler"
import { Cline } from "../../../Cline"
import { ToolUse } from "../../../assistant-message"
import { formatResponse } from "../../../prompts/responses"
import { getReadablePath } from "../../../../utils/path"
import { fileExistsAtPath } from "../../../../utils/fs"
import { telemetryService } from "../../../../services/telemetry/TelemetryService"
import { DiffStrategy } from "../../../diff/DiffStrategy" // Import DiffStrategy type
import delay from "delay"

// --- Mocks ---
jest.mock("../../../Cline")
const MockCline = Cline as jest.MockedClass<typeof Cline>

jest.mock("../../../../utils/path", () => ({
	getReadablePath: jest.fn((cwd, p) => p || "mock/path"),
}))
jest.mock("../../../../utils/fs", () => ({
	fileExistsAtPath: jest.fn(() => Promise.resolve(true)), // Default: file exists
}))
jest.mock("fs/promises", () => ({
	readFile: jest.fn(() => Promise.resolve("Original file content\nLine 2")), // Default file content
	access: jest.fn(() => Promise.resolve()), // Mock access check
}))
jest.mock("../../../../services/telemetry/TelemetryService", () => ({
	telemetryService: {
		captureToolUsage: jest.fn(),
	},
}))
jest.mock("../../../prompts/responses", () => ({
	formatResponse: {
		toolError: jest.fn((msg) => `ERROR: ${msg}`),
		rooIgnoreError: jest.fn((p) => `IGNORED: ${p}`),
		toolResult: jest.fn((text) => text),
	},
}))
jest.mock("delay")

describe("ApplyDiffHandler", () => {
	let mockClineInstance: jest.MockedObject<Cline>
	let mockDiffViewProvider: any
	let mockRooIgnoreController: any
	let mockDiffStrategy: jest.Mocked<DiffStrategy> // Mock DiffStrategy
	let mockToolUse: ToolUse

	beforeEach(() => {
		jest.clearAllMocks()

		mockDiffViewProvider = {
			editType: undefined,
			isEditing: false,
			open: jest.fn(() => Promise.resolve()),
			update: jest.fn(() => Promise.resolve()),
			saveChanges: jest.fn(() =>
				Promise.resolve({ newProblemsMessage: "", userEdits: null, finalContent: "final content" }),
			),
			revertChanges: jest.fn(() => Promise.resolve()),
			reset: jest.fn(() => Promise.resolve()),
			scrollToFirstDiff: jest.fn(),
		}

		mockRooIgnoreController = {
			validateAccess: jest.fn(() => true),
		}

		// Mock DiffStrategy methods
		mockDiffStrategy = {
			getName: jest.fn(() => "mockDiffStrategy"), // No args needed
			getToolDescription: jest.fn((args: any) => "mock description"), // Add args placeholder
			applyDiff: jest.fn(
				(
					originalContent: string,
					diffContent: string,
					startLine?: number,
					endLine?: number, // Add args placeholder
				) => Promise.resolve({ success: true, content: "updated content" }),
			),
			// Return an object matching the expected type, even if empty
			getProgressStatus: jest.fn((toolUse: ToolUse, result?: any) => ({})),
		}

		mockClineInstance = {
			cwd: "/workspace",
			consecutiveMistakeCount: 0,
			diffViewProvider: mockDiffViewProvider,
			rooIgnoreController: mockRooIgnoreController,
			diffStrategy: mockDiffStrategy, // Assign mock strategy
			ask: jest.fn(() => Promise.resolve({ response: "yesButtonClicked" })),
			say: jest.fn(() => Promise.resolve()),
			pushToolResult: jest.fn(() => Promise.resolve()),
			askApprovalHelper: jest.fn(() => Promise.resolve(true)),
			handleErrorHelper: jest.fn(() => Promise.resolve()),
			sayAndCreateMissingParamError: jest.fn((tool, param) => Promise.resolve(`Missing ${param}`)),
			providerRef: { deref: () => ({ getState: () => Promise.resolve({}) }) },
			emit: jest.fn(),
			getTokenUsage: jest.fn(() => ({})),
		} as unknown as jest.MockedObject<Cline>

		mockToolUse = {
			type: "tool_use",
			name: "apply_diff",
			params: {
				path: "test.txt",
				diff: "<<<<<<< SEARCH\nOriginal file content\n=======\nUpdated file content\n>>>>>>> REPLACE",
				start_line: "1",
				end_line: "2",
			},
			partial: false,
		}
	})

	// --- Test validateParams ---
	test("validateParams should throw if path is missing", () => {
		delete mockToolUse.params.path
		const handler = new ApplyDiffHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow("Missing required parameter 'path'")
	})

	test("validateParams should throw if diff is missing", () => {
		delete mockToolUse.params.diff
		const handler = new ApplyDiffHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow("Missing required parameter 'diff'")
	})

	test("validateParams should throw if start_line is missing", () => {
		delete mockToolUse.params.start_line
		const handler = new ApplyDiffHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow("Missing required parameter 'start_line'")
	})

	test("validateParams should throw if end_line is missing", () => {
		delete mockToolUse.params.end_line
		const handler = new ApplyDiffHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow("Missing required parameter 'end_line'")
	})

	// --- Test handlePartial ---
	test("handlePartial should call ask with tool info", async () => {
		mockToolUse.partial = true
		const handler = new ApplyDiffHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.ask).toHaveBeenCalledWith(
			"tool",
			expect.stringContaining('"tool":"appliedDiff"'),
			true,
			{}, // Keep expecting empty object from mock
		)
	})

	// --- Test handleComplete ---
	test("handleComplete should fail if start_line is invalid", async () => {
		mockToolUse.params.start_line = "abc"
		const handler = new ApplyDiffHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.say).toHaveBeenCalledWith("error", expect.stringContaining("Invalid line numbers"))
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			expect.stringContaining("Invalid line numbers"),
		)
	})

	test("handleComplete should fail if end_line is invalid", async () => {
		mockToolUse.params.end_line = "xyz"
		const handler = new ApplyDiffHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.say).toHaveBeenCalledWith("error", expect.stringContaining("Invalid line numbers"))
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			expect.stringContaining("Invalid line numbers"),
		)
	})

	test("handleComplete should fail if start_line > end_line", async () => {
		mockToolUse.params.start_line = "10"
		mockToolUse.params.end_line = "5"
		const handler = new ApplyDiffHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.say).toHaveBeenCalledWith(
			"error",
			expect.stringContaining("start_line cannot be greater than end_line"),
		)
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			expect.stringContaining("start_line cannot be greater than end_line"),
		)
	})

	test("handleComplete should handle rooignore denial", async () => {
		mockRooIgnoreController.validateAccess.mockReturnValue(false)
		const handler = new ApplyDiffHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.say).toHaveBeenCalledWith("rooignore_error", "test.txt")
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "ERROR: IGNORED: test.txt")
	})

	test("handleComplete should handle file not existing", async () => {
		;(fileExistsAtPath as jest.Mock).mockResolvedValue(false)
		const handler = new ApplyDiffHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.say).toHaveBeenCalledWith("error", expect.stringContaining("File does not exist"))
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			expect.stringContaining("File does not exist"),
		)
	})

	test("handleComplete should call diffStrategy.applyDiff", async () => {
		;+(fileExistsAtPath as jest.Mock).mockResolvedValue(true) // Ensure file exists for this test
		const handler = new ApplyDiffHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(fs.readFile).toHaveBeenCalledWith("/workspace/test.txt", "utf-8")
		expect(mockDiffStrategy.applyDiff).toHaveBeenCalledWith(
			"Original file content\nLine 2",
			mockToolUse.params.diff,
			1, // Parsed start_line
			2, // Parsed end_line
		)
	})

	test("handleComplete should push error if diffStrategy.applyDiff fails", async () => {
		;(fileExistsAtPath as jest.Mock).mockResolvedValue(true) // Ensure file exists for this test
		// Correct error object structure for DiffResult when success is false
		const diffError = { success: false as const, error: "Diff failed", details: { similarity: 0.5 } } // Explicitly type success as false
		mockDiffStrategy.applyDiff.mockResolvedValue(diffError)
		const handler = new ApplyDiffHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			// Expect the actual error format, including details if present
			expect.stringContaining("ERROR: Unable to apply diff") &&
				expect.stringContaining("Diff failed") &&
				expect.stringContaining("similarity"),
		)
		expect(mockDiffViewProvider.open).not.toHaveBeenCalled() // Should not proceed
	})

	test("handleComplete should show diff and ask approval on successful diff", async () => {
		;(fileExistsAtPath as jest.Mock).mockResolvedValue(true) // Ensure file exists for this test
		mockDiffStrategy.applyDiff.mockResolvedValue({ success: true, content: "updated content" })
		const handler = new ApplyDiffHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockDiffViewProvider.open).toHaveBeenCalledWith("test.txt")
		expect(mockDiffViewProvider.update).toHaveBeenCalledWith("updated content", true)
		expect(mockDiffViewProvider.scrollToFirstDiff).toHaveBeenCalled()
		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalledWith(
			mockToolUse,
			"tool",
			expect.stringContaining('"tool":"appliedDiff"'),
			{}, // Expect empty object from mock
		)
	})

	test("handleComplete should save changes and push success on approval", async () => {
		;(fileExistsAtPath as jest.Mock).mockResolvedValue(true) // Ensure file exists for this test
		;(mockClineInstance.askApprovalHelper as jest.Mock).mockResolvedValue(true)
		const handler = new ApplyDiffHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockDiffViewProvider.saveChanges).toHaveBeenCalled()
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			"Changes successfully applied to test.txt.",
		) // Default success message
		expect(mockClineInstance.didEditFile).toBe(true)
		expect(telemetryService.captureToolUsage).toHaveBeenCalledWith(mockClineInstance.taskId, "apply_diff")
		expect(mockDiffViewProvider.reset).toHaveBeenCalled()
	})

	test("handleComplete should revert changes on rejection", async () => {
		;(fileExistsAtPath as jest.Mock).mockResolvedValue(true) // Ensure file exists for this test
		;(mockClineInstance.askApprovalHelper as jest.Mock).mockResolvedValue(false)
		const handler = new ApplyDiffHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockDiffViewProvider.saveChanges).not.toHaveBeenCalled()
		expect(mockDiffViewProvider.revertChanges).toHaveBeenCalled()
		expect(mockDiffViewProvider.reset).toHaveBeenCalled()
	})

	test("handleComplete should handle saveChanges error", async () => {
		const saveError = new Error("Save failed")
		;(mockClineInstance.askApprovalHelper as jest.Mock).mockResolvedValue(true)
		mockDiffViewProvider.saveChanges.mockRejectedValue(saveError)
		const handler = new ApplyDiffHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockDiffViewProvider.revertChanges).toHaveBeenCalled() // Should revert on error
		expect(mockClineInstance.handleErrorHelper).toHaveBeenCalledWith(mockToolUse, "applying diff", saveError) // Error context should be "applying diff"
		expect(mockDiffViewProvider.reset).toHaveBeenCalled()
	})
})
