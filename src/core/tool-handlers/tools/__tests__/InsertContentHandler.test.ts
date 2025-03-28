import * as path from "path"
import * as fs from "fs/promises"
import { InsertContentHandler } from "../InsertContentHandler"
import { Cline } from "../../../Cline"
import { ToolUse } from "../../../assistant-message"
import { formatResponse } from "../../../prompts/responses"
import { getReadablePath } from "../../../../utils/path"
import { fileExistsAtPath } from "../../../../utils/fs"
import { insertGroups } from "../../../diff/insert-groups"
import { telemetryService } from "../../../../services/telemetry/TelemetryService"
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
	readFile: jest.fn(() => Promise.resolve("Line 1\nLine 3")), // Default file content
}))
jest.mock("../../../diff/insert-groups", () => ({
	insertGroups: jest.fn((lines, ops) => {
		// Simple mock: just join lines and add inserted content crudely
		let content = lines.join("\n")
		ops.forEach((op: any) => {
			content += "\n" + op.elements.join("\n")
		})
		return content.split("\n")
	}),
}))
jest.mock("../../../../services/telemetry/TelemetryService", () => ({
	telemetryService: {
		captureToolUsage: jest.fn(),
	},
}))
jest.mock("../../../prompts/responses", () => ({
	formatResponse: {
		toolError: jest.fn((msg) => `ERROR: ${msg}`),
		createPrettyPatch: jest.fn(() => "mock diff content"), // Needed for diff generation
		toolResult: jest.fn((text) => text),
	},
}))
jest.mock("delay")

describe("InsertContentHandler", () => {
	let mockClineInstance: jest.MockedObject<Cline>
	let mockDiffViewProvider: any
	let mockToolUse: ToolUse

	beforeEach(() => {
		jest.clearAllMocks()
		// Explicitly reset mocks that might have state changed by specific tests
		;(formatResponse.createPrettyPatch as jest.Mock).mockReturnValue("mock diff content")

		mockDiffViewProvider = {
			editType: undefined,
			isEditing: false,
			originalContent: "Line 1\nLine 3",
			open: jest.fn(() => Promise.resolve()),
			update: jest.fn(() => Promise.resolve()),
			saveChanges: jest.fn(() =>
				Promise.resolve({ newProblemsMessage: "", userEdits: null, finalContent: "final content" }),
			),
			revertChanges: jest.fn(() => Promise.resolve()),
			reset: jest.fn(() => Promise.resolve()),
			scrollToFirstDiff: jest.fn(),
		}

		mockClineInstance = {
			cwd: "/workspace",
			consecutiveMistakeCount: 0,
			diffViewProvider: mockDiffViewProvider,
			// Default ask mock - handles both potential calls, resolves to 'yes'
			ask: jest.fn(async (type, msg, partial) => {
				return { response: "yesButtonClicked" }
			}),
			say: jest.fn(() => Promise.resolve()),
			pushToolResult: jest.fn(() => Promise.resolve()),
			askApprovalHelper: jest.fn(() => Promise.resolve(true)), // Default approval for helper
			handleErrorHelper: jest.fn(() => Promise.resolve()),
			sayAndCreateMissingParamError: jest.fn((tool, param) => Promise.resolve(`Missing ${param}`)),
			providerRef: { deref: () => ({ getState: () => Promise.resolve({}) }) },
			emit: jest.fn(),
			getTokenUsage: jest.fn(() => ({})),
			didEditFile: false, // Add missing property
		} as unknown as jest.MockedObject<Cline>

		mockToolUse = {
			type: "tool_use",
			name: "insert_content",
			params: {
				path: "test.txt",
				operations: JSON.stringify([{ start_line: 2, content: "Line 2" }]),
			},
			partial: false,
		}
	})

	// --- Test validateParams ---
	test("validateParams should throw if path is missing", () => {
		delete mockToolUse.params.path
		const handler = new InsertContentHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow("Missing required parameter 'path'")
	})

	test("validateParams should throw if operations is missing", () => {
		delete mockToolUse.params.operations
		const handler = new InsertContentHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow("Missing required parameter 'operations'")
	})

	// --- Test handlePartial ---
	test("handlePartial should call ask with tool info", async () => {
		mockToolUse.partial = true
		const handler = new InsertContentHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.ask).toHaveBeenCalledWith(
			"tool",
			expect.stringContaining('"tool":"appliedDiff"'), // Uses appliedDiff for UI
			true,
		)
	})

	// --- Test handleComplete ---
	test("handleComplete should fail if operations JSON is invalid", async () => {
		mockToolUse.params.operations = "[{start_line: 2}]" // Missing content
		const handler = new InsertContentHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.say).toHaveBeenCalledWith(
			"error",
			expect.stringContaining("Failed to parse operations JSON"),
		)
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			expect.stringContaining("Invalid operations JSON format"),
		)
	})

	test("handleComplete should handle file not existing", async () => {
		;(fileExistsAtPath as jest.Mock).mockResolvedValue(false)
		const handler = new InsertContentHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.say).toHaveBeenCalledWith("error", expect.stringContaining("File does not exist"))
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			expect.stringContaining("File does not exist"),
		)
	})

	test("handleComplete should call insertGroups and update diff view", async () => {
		;(fileExistsAtPath as jest.Mock).mockResolvedValue(true) // Ensure file exists
		const handler = new InsertContentHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(fs.readFile).toHaveBeenCalledWith("/workspace/test.txt", "utf8")
		expect(insertGroups).toHaveBeenCalledWith(
			["Line 1", "Line 3"], // Original lines
			[{ index: 1, elements: ["Line 2"] }], // Parsed operations (0-based index)
		)
		expect(mockDiffViewProvider.update).toHaveBeenCalledWith(expect.any(String), true) // Check final update
		expect(mockDiffViewProvider.scrollToFirstDiff).toHaveBeenCalled()
	})

	test("handleComplete should push 'No changes needed' if diff is empty", async () => {
		;(fileExistsAtPath as jest.Mock).mockResolvedValue(true) // Ensure file exists
		;(insertGroups as jest.Mock).mockReturnValue(["Line 1", "Line 3"]) // Simulate no change
		;(formatResponse.createPrettyPatch as jest.Mock).mockReturnValue("") // Simulate empty diff
		const handler = new InsertContentHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "No changes needed for 'test.txt'")
		expect(mockDiffViewProvider.reset).toHaveBeenCalled()
	})

	test("handleComplete should ask for approval", async () => {
		;(fileExistsAtPath as jest.Mock).mockResolvedValue(true) // Ensure file exists
		// mockDiffViewProvider.isEditing = true; // Remove this line
		// Restore default ask mock behavior for this test (already default in beforeEach)
		// console.log("!!! Test: Before handler.handle(), isEditing =", mockClineInstance.diffViewProvider.isEditing); // Remove log
		const handler = new InsertContentHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		// Check the simple ask call used in the original logic
		expect(mockClineInstance.ask).toHaveBeenCalledWith(
			"tool",
			expect.stringContaining('"tool":"appliedDiff"'),
			false, // Complete message
		)
	})

	test("handleComplete should save changes and push success on approval", async () => {
		;(fileExistsAtPath as jest.Mock).mockResolvedValue(true) // Ensure file exists
		// Mock the simple ask to return approval
		;(mockClineInstance.ask as jest.Mock).mockResolvedValue({ response: "yesButtonClicked" })
		const handler = new InsertContentHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockDiffViewProvider.saveChanges).toHaveBeenCalled()
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			expect.stringContaining("successfully inserted"),
		)
		expect(mockClineInstance.didEditFile).toBe(true)
		expect(telemetryService.captureToolUsage).toHaveBeenCalledWith(mockClineInstance.taskId, "insert_content")
		expect(mockDiffViewProvider.reset).toHaveBeenCalled()
	})

	test("handleComplete should revert changes on rejection", async () => {
		;(fileExistsAtPath as jest.Mock).mockResolvedValue(true) // Ensure file exists
		// Mock the simple ask to return rejection
		;(mockClineInstance.ask as jest.Mock).mockResolvedValue({ response: "noButtonClicked" })
		const handler = new InsertContentHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockDiffViewProvider.saveChanges).not.toHaveBeenCalled()
		expect(mockDiffViewProvider.revertChanges).toHaveBeenCalled()
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "Changes were rejected by the user.")
		expect(mockDiffViewProvider.reset).toHaveBeenCalled()
	})

	test("handleComplete should handle errors during insertion", async () => {
		;(fileExistsAtPath as jest.Mock).mockResolvedValue(true) // Ensure file exists
		const insertError = new Error("Insertion failed")
		;(insertGroups as jest.Mock).mockImplementation(() => {
			throw insertError
		})
		const handler = new InsertContentHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.handleErrorHelper).toHaveBeenCalledWith(mockToolUse, "insert content", insertError)
		expect(mockDiffViewProvider.reset).toHaveBeenCalled()
	})
})
