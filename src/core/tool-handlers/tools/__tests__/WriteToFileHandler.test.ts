import { WriteToFileHandler } from "../WriteToFileHandler"
import { Cline } from "../../../Cline"
import { ToolUse, WriteToFileToolUse } from "../../../assistant-message"
import { formatResponse } from "../../../prompts/responses"
import { getReadablePath } from "../../../../utils/path" // Keep this
import { isPathOutsideWorkspace } from "../../../../utils/pathUtils" // Import from pathUtils
import { fileExistsAtPath } from "../../../../utils/fs"
import { detectCodeOmission } from "../../../../integrations/editor/detect-omission"
import { everyLineHasLineNumbers, stripLineNumbers } from "../../../../integrations/misc/extract-text"
import { telemetryService } from "../../../../services/telemetry/TelemetryService"
import delay from "delay"
import * as vscode from "vscode"

// --- Mocks ---

// Mock Cline and its dependencies/methods used by the handler
jest.mock("../../../Cline")
const MockCline = Cline as jest.MockedClass<typeof Cline>

// Mock utilities and services
jest.mock("../../../../utils/path", () => ({
	getReadablePath: jest.fn((cwd, p) => p || "mock/path"), // Simple mock implementation
	isPathOutsideWorkspace: jest.fn(() => false),
}))
jest.mock("../../../../utils/fs", () => ({
	fileExistsAtPath: jest.fn(() => Promise.resolve(true)), // Default to file existing
}))
jest.mock("../../../../integrations/editor/detect-omission", () => ({
	detectCodeOmission: jest.fn(() => false), // Default to no omission
}))
jest.mock("../../../../integrations/misc/extract-text", () => ({
	everyLineHasLineNumbers: jest.fn(() => false),
	stripLineNumbers: jest.fn((content) => content), // Pass through by default
}))
jest.mock("../../../../services/telemetry/TelemetryService", () => ({
	telemetryService: {
		captureToolUsage: jest.fn(),
	},
}))
jest.mock("../../../prompts/responses", () => ({
	// Corrected path
	formatResponse: {
		toolError: jest.fn((msg) => `ERROR: ${msg}`),
		rooIgnoreError: jest.fn((p) => `IGNORED: ${p}`),
		createPrettyPatch: jest.fn(() => "mock diff content"),
		toolSuccess: jest.fn((p) => `SUCCESS: ${p}`), // Keep even if unused directly by handler
		toolResult: jest.fn((text) => text), // Simple pass-through for results
	},
}))
jest.mock("delay") // Auto-mock delay
jest.mock(
	"vscode",
	() => ({
		// Mock relevant parts of vscode API
		window: {
			showWarningMessage: jest.fn(() => Promise.resolve(undefined)), // Return a promise
			createTextEditorDecorationType: jest.fn(() => ({ key: "mockDecorationType", dispose: jest.fn() })), // Added correctly
		},
		env: {
			openExternal: jest.fn(),
		},
		Uri: {
			parse: jest.fn((str) => ({ fsPath: str })), // Simple mock for Uri.parse
		},
		// Add mock for workspace and workspaceFolders
		workspace: {
			workspaceFolders: [{ uri: { fsPath: "/workspace" } }], // Mock a workspace folder
		},
	}),
	{ virtual: true },
) // Use virtual mock for vscode

describe("WriteToFileHandler", () => {
	let mockClineInstance: jest.MockedObject<Cline>
	let mockDiffViewProvider: any // Mock structure for diffViewProvider
	let mockRooIgnoreController: any // Mock structure for rooIgnoreController
	let mockToolUse: WriteToFileToolUse

	beforeEach(() => {
		// Reset mocks before each test
		jest.clearAllMocks()

		// Setup mock DiffViewProvider
		mockDiffViewProvider = {
			editType: undefined,
			isEditing: false,
			originalContent: "original content",
			open: jest.fn(() => Promise.resolve()),
			update: jest.fn(() => Promise.resolve()),
			saveChanges: jest.fn(() =>
				Promise.resolve({ newProblemsMessage: "", userEdits: null, finalContent: "final content" }),
			),
			revertChanges: jest.fn(() => Promise.resolve()),
			reset: jest.fn(() => Promise.resolve()),
			scrollToFirstDiff: jest.fn(),
		}

		// Setup mock RooIgnoreController
		mockRooIgnoreController = {
			validateAccess: jest.fn(() => true), // Default to access allowed
		}

		// Create a mock Cline instance with necessary properties/methods
		mockClineInstance = {
			cwd: "/workspace",
			consecutiveMistakeCount: 0,
			didEditFile: false,
			diffViewProvider: mockDiffViewProvider,
			rooIgnoreController: mockRooIgnoreController,
			api: { getModel: () => ({ id: "mock-model" }) }, // Mock API if needed
			// Mock methods used by the handler
			ask: jest.fn(() => Promise.resolve({ response: "yesButtonClicked" })), // Default approval
			say: jest.fn(() => Promise.resolve()),
			pushToolResult: jest.fn(() => Promise.resolve()),
			askApprovalHelper: jest.fn(() => Promise.resolve(true)), // Default approval
			handleErrorHelper: jest.fn(() => Promise.resolve()),
			sayAndCreateMissingParamError: jest.fn((tool, param) => Promise.resolve(`Missing ${param}`)),
			providerRef: { deref: () => ({ getState: () => Promise.resolve({}) }) }, // Mock providerRef if needed for state
			emit: jest.fn(), // Mock emit if needed
			getTokenUsage: jest.fn(() => ({})), // Mock getTokenUsage
		} as unknown as jest.MockedObject<Cline> // Use unknown assertion for complex mock

		// Default mock tool use
		mockToolUse = {
			type: "tool_use",
			name: "write_to_file",
			// id: "tool_123", // Removed id property
			params: {
				path: "test.txt",
				content: "new content",
				line_count: "2",
			},
			partial: false,
		}
	})

	// --- Test validateParams ---
	test("validateParams should throw if path is missing", () => {
		delete mockToolUse.params.path
		const handler = new WriteToFileHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow("Missing required parameter 'path'")
	})

	test("validateParams should throw if content is missing (and not partial)", () => {
		delete mockToolUse.params.content
		mockToolUse.partial = false
		const handler = new WriteToFileHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow("Missing required parameter 'content'")
	})

	test("validateParams should NOT throw if content is missing (and partial)", () => {
		delete mockToolUse.params.content
		mockToolUse.partial = true
		const handler = new WriteToFileHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).not.toThrow()
	})

	test("validateParams should throw if line_count is missing (and not partial)", () => {
		delete mockToolUse.params.line_count
		mockToolUse.partial = false
		const handler = new WriteToFileHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow("Missing required parameter 'line_count'")
	})

	test("validateParams should NOT throw if line_count is missing (and partial)", () => {
		delete mockToolUse.params.line_count
		mockToolUse.partial = true
		const handler = new WriteToFileHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).not.toThrow()
	})

	// --- Test handlePartial ---

	test("handlePartial should return early if path is missing", async () => {
		mockToolUse.partial = true
		delete mockToolUse.params.path
		const handler = new WriteToFileHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.ask).not.toHaveBeenCalled()
		expect(mockDiffViewProvider.open).not.toHaveBeenCalled()
	})

	test("handlePartial should handle rooignore denial", async () => {
		mockToolUse.partial = true
		mockToolUse.params.path = "ignored/file.txt"
		mockRooIgnoreController.validateAccess.mockReturnValue(false) // Deny access
		const handler = new WriteToFileHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.say).toHaveBeenCalledWith("rooignore_error", "ignored/file.txt")
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "ERROR: IGNORED: ignored/file.txt")
		expect(mockClineInstance.ask).not.toHaveBeenCalled() // Should not proceed to ask
	})

	test("handlePartial should call ask and open/update diff view for new file", async () => {
		mockToolUse.partial = true
		mockToolUse.params.path = "new_file.txt"
		mockToolUse.params.content = "partial content"
		;(fileExistsAtPath as jest.Mock).mockResolvedValue(false) // File does not exist
		mockDiffViewProvider.isEditing = false // Editor not open yet

		const handler = new WriteToFileHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		// Check ask call for UI update
		expect(mockClineInstance.ask).toHaveBeenCalledWith(
			"tool",
			expect.stringContaining('"tool":"newFileCreated"'),
			true, // partial
		)
		// Check diff provider calls
		expect(mockDiffViewProvider.open).toHaveBeenCalledWith("new_file.txt")
		expect(mockDiffViewProvider.update).toHaveBeenCalledWith("partial content", false)
	})

	test("handlePartial should call ask and update diff view for existing file", async () => {
		mockToolUse.partial = true
		mockToolUse.params.path = "existing_file.txt"
		mockToolUse.params.content = "more content"
		;(fileExistsAtPath as jest.Mock).mockResolvedValue(true) // File exists
		mockDiffViewProvider.isEditing = true // Editor already open

		const handler = new WriteToFileHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		// Check ask call for UI update
		expect(mockClineInstance.ask).toHaveBeenCalledWith(
			"tool",
			expect.stringContaining('"tool":"editedExistingFile"'),
			true, // partial
		)
		// Check diff provider calls
		expect(mockDiffViewProvider.open).not.toHaveBeenCalled() // Should not open again
		expect(mockDiffViewProvider.update).toHaveBeenCalledWith("more content", false)
	})

	test("handlePartial should strip line numbers before updating diff view", async () => {
		mockToolUse.partial = true
		mockToolUse.params.path = "file_with_lines.txt"
		mockToolUse.params.content = "1 | line one\n2 | line two"
		;(everyLineHasLineNumbers as jest.Mock).mockReturnValue(true)
		;(stripLineNumbers as jest.Mock).mockReturnValue("line one\nline two")
		mockDiffViewProvider.isEditing = true

		const handler = new WriteToFileHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(everyLineHasLineNumbers).toHaveBeenCalledWith("1 | line one\n2 | line two")
		expect(stripLineNumbers).toHaveBeenCalledWith("1 | line one\n2 | line two")
		expect(mockDiffViewProvider.update).toHaveBeenCalledWith("line one\nline two", false)
	})

	// --- Test handleComplete ---

	test("handleComplete should call sayAndCreateMissingParamError if path is missing", async () => {
		mockToolUse.partial = false
		delete mockToolUse.params.path
		const handler = new WriteToFileHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.sayAndCreateMissingParamError).toHaveBeenCalledWith("write_to_file", "path")
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "Missing path")
		expect(mockDiffViewProvider.reset).toHaveBeenCalled()
	})

	test("handleComplete should call sayAndCreateMissingParamError if content is missing", async () => {
		mockToolUse.partial = false
		delete mockToolUse.params.content
		const handler = new WriteToFileHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.sayAndCreateMissingParamError).toHaveBeenCalledWith("write_to_file", "content")
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "Missing content")
		expect(mockDiffViewProvider.reset).toHaveBeenCalled()
	})

	test("handleComplete should call sayAndCreateMissingParamError if line_count is missing", async () => {
		mockToolUse.partial = false
		delete mockToolUse.params.line_count
		const handler = new WriteToFileHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.sayAndCreateMissingParamError).toHaveBeenCalledWith("write_to_file", "line_count")
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "Missing line_count")
		expect(mockDiffViewProvider.reset).toHaveBeenCalled()
	})

	test("handleComplete should handle rooignore denial", async () => {
		mockToolUse.partial = false
		mockToolUse.params.path = "ignored/file.txt"
		mockRooIgnoreController.validateAccess.mockReturnValue(false) // Deny access
		const handler = new WriteToFileHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.say).toHaveBeenCalledWith("rooignore_error", "ignored/file.txt")
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "ERROR: IGNORED: ignored/file.txt")
		expect(mockDiffViewProvider.reset).toHaveBeenCalled()
		expect(mockClineInstance.askApprovalHelper).not.toHaveBeenCalled() // Should not ask for approval
	})

	test("handleComplete should perform final update and ask for approval", async () => {
		mockToolUse.partial = false
		mockToolUse.params.content = "final content"
		mockToolUse.params.path = "test.txt"
		mockDiffViewProvider.isEditing = true // Assume editor was opened by partial
		mockDiffViewProvider.originalContent = "original content"
		;+(
			// Explicitly set mocks for this test to ensure correct behavior
			(+(everyLineHasLineNumbers as jest.Mock).mockReturnValue(false))
		)
		;+(stripLineNumbers as jest.Mock).mockImplementation((content) => content)

		const handler = new WriteToFileHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		// Expect the content defined in the test setup for mockToolUse
		expect(mockDiffViewProvider.update).toHaveBeenCalledWith("final content", true) // Keep "final content" as it's set in this specific test
		expect(mockDiffViewProvider.scrollToFirstDiff).toHaveBeenCalled()
		expect(mockClineInstance.askApprovalHelper).toHaveBeenCalledWith(
			mockToolUse,
			"tool",
			expect.stringContaining('"tool":"editedExistingFile"'), // Assuming file exists
		)
	})

	test("handleComplete should save changes and push success on approval", async () => {
		mockToolUse.partial = false
		mockToolUse.params.path = "test.txt"
		;(mockClineInstance.askApprovalHelper as jest.Mock).mockResolvedValue(true) // Simulate approval

		const handler = new WriteToFileHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockDiffViewProvider.saveChanges).toHaveBeenCalled()
		// Update expectation to match the actual success message format used by the handler
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			"Successfully saved changes to test.txt",
		)
		expect(mockClineInstance.didEditFile).toBe(true)
		expect(telemetryService.captureToolUsage).toHaveBeenCalledWith(mockClineInstance.taskId, "write_to_file")
		expect(mockDiffViewProvider.reset).toHaveBeenCalled()
	})

	test("handleComplete should revert changes on rejection", async () => {
		mockToolUse.partial = false
		mockToolUse.params.path = "test.txt"
		;(mockClineInstance.askApprovalHelper as jest.Mock).mockResolvedValue(false) // Simulate rejection

		const handler = new WriteToFileHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockDiffViewProvider.saveChanges).not.toHaveBeenCalled()
		expect(mockDiffViewProvider.revertChanges).toHaveBeenCalled()
		// pushToolResult for rejection is handled within askApprovalHelper mock/implementation
		expect(mockDiffViewProvider.reset).toHaveBeenCalled()
	})

	test("handleComplete should handle saveChanges error", async () => {
		mockToolUse.partial = false
		mockToolUse.params.path = "test.txt"
		const saveError = new Error("Failed to save")
		;(mockClineInstance.askApprovalHelper as jest.Mock).mockResolvedValue(true) // Simulate approval
		mockDiffViewProvider.saveChanges.mockRejectedValue(saveError) // Simulate save error

		const handler = new WriteToFileHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockDiffViewProvider.saveChanges).toHaveBeenCalled()
		expect(mockDiffViewProvider.revertChanges).toHaveBeenCalled() // Should revert on error
		expect(mockClineInstance.handleErrorHelper).toHaveBeenCalledWith(mockToolUse, "saving file test.txt", saveError)
		expect(mockDiffViewProvider.reset).toHaveBeenCalled()
	})

	test("handleComplete should detect code omission and revert if diffStrategy is enabled", async () => {
		mockToolUse.partial = false
		mockToolUse.params.content = "// rest of code"
		mockToolUse.params.line_count = "100" // Mismatch with actual content lines
		// Provide a mock DiffStrategy object with required methods
		mockClineInstance.diffStrategy = {
			getName: jest.fn(() => "mockDiffStrategy"),
			getToolDescription: jest.fn(() => "mock description"),
			applyDiff: jest.fn(() => Promise.resolve({ success: true, content: "diff applied content" })),
		}
		;(detectCodeOmission as jest.Mock).mockReturnValue(true) // Simulate omission detected
		;(mockClineInstance.askApprovalHelper as jest.Mock).mockResolvedValue(true) // Need approval before check

		const handler = new WriteToFileHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(detectCodeOmission).toHaveBeenCalled()
		expect(mockDiffViewProvider.revertChanges).toHaveBeenCalled()
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			expect.stringContaining("Content appears to be truncated"),
		)
		expect(mockDiffViewProvider.saveChanges).not.toHaveBeenCalled() // Should not save
		expect(mockDiffViewProvider.reset).not.toHaveBeenCalled() // Reset happens after break in original logic, but here we return
	})

	test("handleComplete should detect code omission and show warning if diffStrategy is disabled", async () => {
		mockToolUse.partial = false
		mockToolUse.params.content = "// rest of code"
		mockToolUse.params.line_count = "100"
		mockClineInstance.diffStrategy = undefined // Indicate diff strategy is disabled
		;(detectCodeOmission as jest.Mock).mockReturnValue(true)
		;(mockClineInstance.askApprovalHelper as jest.Mock).mockResolvedValue(true)

		const handler = new WriteToFileHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(detectCodeOmission).toHaveBeenCalled()
		expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
			expect.stringContaining("Potential code truncation detected"),
			"Follow this guide to fix the issue",
		)
		expect(mockDiffViewProvider.revertChanges).not.toHaveBeenCalled() // Should not revert automatically
		expect(mockDiffViewProvider.saveChanges).toHaveBeenCalled() // Should proceed to save after warning
	})
})
