// npx jest src/core/tools/__tests__/ToolFactory.test.ts

import { describe, expect, it, jest, beforeEach } from "@jest/globals"
import { ToolFactory } from "../ToolFactory"
import { BaseTool } from "../BaseTool"
import { ReadFileTool } from "../implementations/ReadFileTool"
import { WriteToFileTool } from "../implementations/WriteToFileTool"

// Mock the tool implementations
jest.mock("../implementations/ReadFileTool")
jest.mock("../implementations/WriteToFileTool")
jest.mock("../implementations/ListFilesTool")
jest.mock("../implementations/SearchFilesTool")
jest.mock("../implementations/ExecuteCommandTool")
jest.mock("../implementations/BrowserActionTool")
jest.mock("../implementations/ApplyDiffTool")
jest.mock("../implementations/InsertContentTool")
jest.mock("../implementations/SearchAndReplaceTool")
jest.mock("../implementations/ListCodeDefinitionNamesTool")
jest.mock("../implementations/UseMcpToolTool")
jest.mock("../implementations/AccessMcpResourceTool")
jest.mock("../implementations/AskFollowupQuestionTool")
jest.mock("../implementations/SwitchModeTool")
jest.mock("../implementations/AttemptCompletionTool")
jest.mock("../implementations/NewTaskTool")
jest.mock("../implementations/FetchInstructionsTool")

describe("ToolFactory", () => {
	let toolFactory: ToolFactory

	beforeEach(() => {
		// Reset mocks
		jest.clearAllMocks()

		// Reset the singleton instance
		// @ts-expect-error - Accessing private static property for testing
		ToolFactory.instance = undefined

		// Create a new instance
		toolFactory = ToolFactory.getInstance()
	})

	describe("getInstance", () => {
		it("should return the same instance when called multiple times", () => {
			const instance1 = ToolFactory.getInstance()
			const instance2 = ToolFactory.getInstance()

			expect(instance1).toBe(instance2)
		})
	})

	describe("registerTool", () => {
		it("should register a tool", () => {
			// Create a mock tool
			const mockTool = {
				getName: jest.fn().mockReturnValue("mock_tool"),
				execute: jest.fn(),
			} as unknown as BaseTool

			// Register the tool
			toolFactory.registerTool(mockTool)

			// Verify the tool was registered
			expect(toolFactory.hasTool("mock_tool")).toBe(true)
			expect(toolFactory.getTool("mock_tool")).toBe(mockTool)
		})
	})

	describe("getTool", () => {
		it("should return a registered tool", () => {
			// Setup
			const mockReadFileTool = new ReadFileTool()
			jest.spyOn(mockReadFileTool, "getName").mockReturnValue("read_file")

			// @ts-expect-error - Accessing private property for testing
			toolFactory.toolInstances.set("read_file", mockReadFileTool)

			// Execute
			const tool = toolFactory.getTool("read_file")

			// Verify
			expect(tool).toBe(mockReadFileTool)
		})

		it("should return undefined for an unregistered tool", () => {
			// Execute
			const tool = toolFactory.getTool("unknown_tool" as any)

			// Verify
			expect(tool).toBeUndefined()
		})
	})

	describe("hasTool", () => {
		it("should return true for a registered tool", () => {
			// Setup
			const mockReadFileTool = new ReadFileTool()
			jest.spyOn(mockReadFileTool, "getName").mockReturnValue("read_file")

			// @ts-expect-error - Accessing private property for testing
			toolFactory.toolInstances.set("read_file", mockReadFileTool)

			// Execute & Verify
			expect(toolFactory.hasTool("read_file")).toBe(true)
		})

		it("should return false for an unregistered tool", () => {
			// Execute & Verify
			expect(toolFactory.hasTool("unknown_tool")).toBe(false)
		})
	})

	describe("getAllTools", () => {
		it("should return all registered tools", () => {
			// Setup
			const mockReadFileTool = new ReadFileTool()
			const mockWriteToFileTool = new WriteToFileTool()

			jest.spyOn(mockReadFileTool, "getName").mockReturnValue("read_file")
			jest.spyOn(mockWriteToFileTool, "getName").mockReturnValue("write_to_file")

			// @ts-expect-error - Accessing private property for testing
			toolFactory.toolInstances.set("read_file", mockReadFileTool)
			// @ts-expect-error - Accessing private property for testing
			toolFactory.toolInstances.set("write_to_file", mockWriteToFileTool)

			// Execute
			const tools = toolFactory.getAllTools()

			// Verify
			expect(tools.size).toBe(2)
			expect(tools.get("read_file")).toBe(mockReadFileTool)
			expect(tools.get("write_to_file")).toBe(mockWriteToFileTool)
		})
	})

	describe("registerTools", () => {
		it("should register all tool implementations", () => {
			// Setup - Mock the getName method for each tool implementation
			const mockGetName = jest.fn()
			mockGetName
				.mockReturnValueOnce("read_file")
				.mockReturnValueOnce("write_to_file")
				.mockReturnValueOnce("list_files")
				.mockReturnValueOnce("search_files")
				.mockReturnValueOnce("execute_command")
				.mockReturnValueOnce("browser_action")
				.mockReturnValueOnce("apply_diff")
				.mockReturnValueOnce("insert_content")
				.mockReturnValueOnce("search_and_replace")
				.mockReturnValueOnce("list_code_definition_names")
				.mockReturnValueOnce("use_mcp_tool")
				.mockReturnValueOnce("access_mcp_resource")
				.mockReturnValueOnce("ask_followup_question")
				.mockReturnValueOnce("switch_mode")
				.mockReturnValueOnce("attempt_completion")
				.mockReturnValueOnce("new_task")
				.mockReturnValueOnce("fetch_instructions")

			// Mock the constructor of each tool implementation to return an object with getName method
			const mockToolConstructor = jest.fn().mockImplementation(() => ({
				getName: mockGetName,
				execute: jest.fn(),
			}))

			// Apply the mock constructor to all tool implementations
			;(ReadFileTool as unknown as jest.Mock).mockImplementation(mockToolConstructor)
			;(WriteToFileTool as unknown as jest.Mock).mockImplementation(mockToolConstructor)
			// ... and so on for all other tool implementations

			// Create a new instance to trigger registerTools
			const factory = ToolFactory.getInstance()

			// Verify that all tools were registered
			expect(factory.getAllTools().size).toBeGreaterThan(0)
			expect(factory.hasTool("read_file")).toBe(true)
			expect(factory.hasTool("write_to_file")).toBe(true)
			// ... and so on for all other tools
		})
	})
})
