import { SystemPromptGenerator } from "../SystemPromptGenerator"
import * as vscode from "vscode"
import { McpHub } from "../../../services/mcp/McpHub"
import { Mode } from "../../../shared/modes"
import { ExperimentId } from "../../../shared/experiments"

// Mock the system.ts module
jest.mock("../system", () => ({
	SYSTEM_PROMPT: jest.fn().mockResolvedValue("Mocked system prompt"),
}))

describe("SystemPromptGenerator", () => {
	let systemPromptGenerator: SystemPromptGenerator
	let mockContext: vscode.ExtensionContext
	let mockMcpHub: McpHub
	let mockDiffStrategy: any

	beforeEach(() => {
		// Create mock context
		mockContext = {
			extensionPath: "/mock/extension/path",
			globalStorageUri: { fsPath: "/mock/storage/path" } as vscode.Uri,
		} as vscode.ExtensionContext

		// Create mock McpHub
		mockMcpHub = {} as McpHub

		// Create mock diffStrategy
		mockDiffStrategy = {
			fuzzyMatchThreshold: 0.8,
			useExperimentalDiffStrategy: true,
		}

		// Create SystemPromptGenerator instance
		systemPromptGenerator = new SystemPromptGenerator(mockContext)
	})

	test("generate returns a system prompt", async () => {
		// Import the mocked SYSTEM_PROMPT function
		const { SYSTEM_PROMPT } = require("../system")

		// Call the generate method
		const result = await systemPromptGenerator.generate(
			"/mock/cwd",
			true,
			mockMcpHub,
			mockDiffStrategy,
			"900x600",
			"default" as Mode,
			{},
			{},
			"Custom instructions",
			"English",
			true,
			{} as Record<ExperimentId, boolean>,
			true,
		)

		// Verify the result
		expect(result).toBe("Mocked system prompt")

		// Verify SYSTEM_PROMPT was called with the correct parameters
		expect(SYSTEM_PROMPT).toHaveBeenCalledWith(
			mockContext,
			"/mock/cwd",
			true,
			mockMcpHub,
			mockDiffStrategy,
			"900x600",
			"default",
			{},
			{},
			"Custom instructions",
			"English",
			true,
			{},
			true,
		)
	})
})
