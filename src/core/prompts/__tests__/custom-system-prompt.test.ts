import { SYSTEM_PROMPT } from "../system"
import { defaultModeSlug, modes } from "../../../shared/modes"
import * as vscode from "vscode"
import * as fs from "fs/promises"
import { toPosix } from "./utils"
import { DiffStrategy } from "../../../shared/tools"

// Mock DiffStrategy for testing
const mockDiffStrategy: DiffStrategy = {
	getName: () => "apply_diff",
	getToolDescription: () => "Mock diff tool description",
	applyDiff: async () => ({ success: true, content: "mock content" }),
	getProgressStatus: (_toolUse) => ({
		icon: "mock-icon",
		text: "mock status",
	}),
}

// Mock the fs/promises module
jest.mock("fs/promises", () => ({
	readFile: jest.fn(),
	mkdir: jest.fn().mockResolvedValue(undefined),
	access: jest.fn().mockResolvedValue(undefined),
}))

// Get the mocked fs module
const mockedFs = fs as jest.Mocked<typeof fs>

// Mock the fileExistsAtPath function
jest.mock("../../../utils/fs", () => ({
	fileExistsAtPath: jest.fn().mockResolvedValue(true),
	createDirectoriesForFile: jest.fn().mockResolvedValue([]),
}))

// Create a mock ExtensionContext with relative paths instead of absolute paths
const mockContext = {
	extensionPath: "mock/extension/path",
	globalStoragePath: "mock/storage/path",
	storagePath: "mock/storage/path",
	logPath: "mock/log/path",
	subscriptions: [],
	workspaceState: {
		get: () => undefined,
		update: () => Promise.resolve(),
	},
	globalState: {
		get: () => undefined,
		update: () => Promise.resolve(),
		setKeysForSync: () => {},
	},
	extensionUri: { fsPath: "mock/extension/path" },
	globalStorageUri: { fsPath: "mock/settings/path" },
	asAbsolutePath: (relativePath: string) => `mock/extension/path/${relativePath}`,
	extension: {
		packageJSON: {
			version: "1.0.0",
		},
	},
} as unknown as vscode.ExtensionContext

describe("File-Based Custom System Prompt", () => {
	beforeEach(() => {
		// Reset mocks before each test
		jest.clearAllMocks()

		// Default behavior: file doesn't exist
		mockedFs.readFile.mockRejectedValue({ code: "ENOENT" })
	})

	it("should use default generation when no file-based system prompt is found", async () => {
		const customModePrompts = {
			[defaultModeSlug]: {
				roleDefinition: "Test role definition",
			},
		}

		const prompt = await SYSTEM_PROMPT(
			mockContext,
			"test/path", // Using a relative path without leading slash
			false, // supportsComputerUse
			undefined, // mcpHub
			undefined, // diffStrategy
			undefined, // browserViewportSize
			defaultModeSlug, // mode
			customModePrompts, // customModePrompts
			undefined, // customModes
			undefined, // globalCustomInstructions
			undefined, // diffEnabled
			undefined, // experiments
			true, // enableMcpServerCreation
		)

		// Should contain default sections
		expect(prompt).toContain("TOOL USE")
		expect(prompt).toContain("CAPABILITIES")
		expect(prompt).toContain("MODES")
		expect(prompt).toContain("Test role definition")
	})

	it("should use file-based custom system prompt when available", async () => {
		// Mock the readFile to return content from a file
		const fileCustomSystemPrompt = "Custom system prompt from file"
		// When called with utf-8 encoding, return a string
		mockedFs.readFile.mockImplementation((filePath, options) => {
			if (toPosix(filePath).includes(`.roo/system-prompt-${defaultModeSlug}`) && options === "utf-8") {
				return Promise.resolve(fileCustomSystemPrompt)
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const prompt = await SYSTEM_PROMPT(
			mockContext,
			"test/path", // Using a relative path without leading slash
			false, // supportsComputerUse
			undefined, // mcpHub
			undefined, // diffStrategy
			undefined, // browserViewportSize
			defaultModeSlug, // mode
			undefined, // customModePrompts
			undefined, // customModes
			undefined, // globalCustomInstructions
			undefined, // diffEnabled
			undefined, // experiments
			true, // enableMcpServerCreation
		)

		// Should contain role definition and file-based system prompt
		expect(prompt).toContain(modes[0].roleDefinition)
		expect(prompt).toContain(fileCustomSystemPrompt)

		// Should contain the default sections (appended after the file content)
		expect(prompt).toContain("OBJECTIVE")
		expect(prompt).toContain("CAPABILITIES")
		expect(prompt).toContain("RULES")
		// Should not contain MODES section
		expect(prompt).not.toContain("MODES")
	})

	it("should combine file-based system prompt with role definition and custom instructions", async () => {
		// Mock the readFile to return content from a file
		const fileCustomSystemPrompt = "Custom system prompt from file"
		mockedFs.readFile.mockImplementation((filePath, options) => {
			if (toPosix(filePath).includes(`.roo/system-prompt-${defaultModeSlug}`) && options === "utf-8") {
				return Promise.resolve(fileCustomSystemPrompt)
			}
			return Promise.reject({ code: "ENOENT" })
		})

		// Define custom role definition
		const customRoleDefinition = "Custom role definition"
		const customModePrompts = {
			[defaultModeSlug]: {
				roleDefinition: customRoleDefinition,
			},
		}

		const prompt = await SYSTEM_PROMPT(
			mockContext,
			"test/path", // Using a relative path without leading slash
			false, // supportsComputerUse
			undefined, // mcpHub
			undefined, // diffStrategy
			undefined, // browserViewportSize
			defaultModeSlug, // mode
			customModePrompts, // customModePrompts
			undefined, // customModes
			undefined, // globalCustomInstructions
			undefined, // diffEnabled
			undefined, // experiments
			true, // enableMcpServerCreation
		)

		// Should contain custom role definition and file-based system prompt
		expect(prompt).toContain(customRoleDefinition)
		expect(prompt).toContain(fileCustomSystemPrompt)

		// Should contain the default sections (appended after the file content)
		expect(prompt).toContain("OBJECTIVE")
		expect(prompt).toContain("CAPABILITIES")
		expect(prompt).toContain("RULES")
		// Should not contain MODES section
		expect(prompt).not.toContain("MODES")
	})
})

describe("Prompt Section Overrides", () => {
	beforeEach(() => {
		// Reset mocks before each test
		jest.clearAllMocks()

		// Default behavior: file doesn't exist
		mockedFs.readFile.mockRejectedValue({ code: "ENOENT" })
	})

	describe("Without custom prompt file", () => {
		it("should use raw section overrides from promptComponent when provided", async () => {
			const customObjectiveSection = "CUSTOM OBJECTIVE SECTION"
			const customRulesSection = "CUSTOM RULES SECTION"
			const customCapabilitiesSection = "CUSTOM CAPABILITIES SECTION"

			const customModePrompts = {
				[defaultModeSlug]: {
					objectiveSectionOverride: customObjectiveSection,
					rulesSectionOverride: customRulesSection,
					capabilitiesSectionOverride: customCapabilitiesSection,
				},
			}

			const prompt = await SYSTEM_PROMPT(
				mockContext,
				"test/path",
				false,
				undefined,
				undefined,
				undefined,
				defaultModeSlug,
				customModePrompts,
				undefined,
				undefined,
				undefined,
				undefined,
				true,
			)

			// Should contain the raw custom sections without Pug rendering
			expect(prompt).toContain(customObjectiveSection)
			expect(prompt).toContain(customRulesSection)
			expect(prompt).toContain(customCapabilitiesSection)
		})

		it("should render Pug templates from mode config when no promptComponent override exists", async () => {
			const customModes = [
				{
					...modes[0],
					objectiveSectionOverride: "| Test objective with cwd: #{cwd}",
					rulesSectionOverride:
						"| Test rules with diffStrategy: #{diffStrategy ? diffStrategy.getName() : 'none'}",
					capabilitiesSectionOverride: "| Test capabilities with mcpHub: #{mcpHub}",
				},
			]

			const prompt = await SYSTEM_PROMPT(
				mockContext,
				"test/path",
				false,
				undefined,
				mockDiffStrategy,
				undefined,
				defaultModeSlug,
				undefined,
				customModes,
				undefined,
				true,
				undefined,
				true,
			)

			// Should contain rendered Pug templates
			expect(prompt).toContain("Test objective with cwd: test/path")
			expect(prompt).toContain("Test rules with diffStrategy: apply_diff")
			expect(prompt).toContain("Test capabilities with mcpHub: false")
		})

		it("should render default templates when no overrides are provided", async () => {
			const prompt = await SYSTEM_PROMPT(
				mockContext,
				"test/path",
				false,
				undefined,
				undefined,
				undefined,
				defaultModeSlug,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				true,
			)

			// Should contain the default sections
			expect(prompt).toContain("OBJECTIVE")
			expect(prompt).toContain("RULES")
			expect(prompt).toContain("CAPABILITIES")
		})
	})

	describe("With custom prompt file", () => {
		beforeEach(() => {
			// Mock the readFile to return content from a file
			const fileCustomSystemPrompt = "Custom system prompt from file"
			mockedFs.readFile.mockImplementation((filePath, options) => {
				if (toPosix(filePath).includes(`.roo/system-prompt-${defaultModeSlug}`) && options === "utf-8") {
					return Promise.resolve(fileCustomSystemPrompt)
				}
				return Promise.reject({ code: "ENOENT" })
			})
		})

		it("should use raw section overrides from promptComponent when provided", async () => {
			const customObjectiveSection = "CUSTOM OBJECTIVE SECTION"
			const customRulesSection = "CUSTOM RULES SECTION"
			const customCapabilitiesSection = "CUSTOM CAPABILITIES SECTION"

			// Create mode config with Pug templates that should be ignored
			const customModes = [
				{
					...modes[0],
					objectiveSectionOverride: "| Test objective with cwd: #{cwd}",
					rulesSectionOverride:
						"| Test rules with diffStrategy: #{diffStrategy ? diffStrategy.getName() : 'none'}",
					capabilitiesSectionOverride: "| Test capabilities with mcpHub: #{mcpHub}",
				},
			]

			// Create promptComponent overrides that should take precedence
			const customModePrompts = {
				[defaultModeSlug]: {
					objectiveSectionOverride: customObjectiveSection,
					rulesSectionOverride: customRulesSection,
					capabilitiesSectionOverride: customCapabilitiesSection,
				},
			}

			const prompt = await SYSTEM_PROMPT(
				mockContext,
				"test/path",
				false,
				undefined,
				mockDiffStrategy,
				undefined,
				defaultModeSlug,
				customModePrompts,
				customModes,
				undefined,
				true,
				undefined,
				true,
			)

			// Should contain the raw custom sections from promptComponent
			expect(prompt).toContain(customObjectiveSection)
			expect(prompt).toContain(customRulesSection)
			expect(prompt).toContain(customCapabilitiesSection)

			// Should NOT contain rendered Pug templates from mode config
			expect(prompt).not.toContain("Test objective with cwd: test/path")
			expect(prompt).not.toContain("Test rules with diffStrategy: apply_diff")
			expect(prompt).not.toContain("Test capabilities with mcpHub: false")

			// Should also contain the file-based system prompt
			expect(prompt).toContain("Custom system prompt from file")
		})

		it("should render Pug templates from mode config when no promptComponent override exists", async () => {
			// Create mode config with Pug templates
			const customModes = [
				{
					...modes[0],
					objectiveSectionOverride: "| Test objective with cwd: #{cwd}",
					rulesSectionOverride:
						"| Test rules with diffStrategy: #{diffStrategy ? diffStrategy.getName() : 'none'}",
					capabilitiesSectionOverride: "| Test capabilities with mcpHub: #{mcpHub}",
				},
			]

			const prompt = await SYSTEM_PROMPT(
				mockContext,
				"test/path",
				false,
				undefined,
				mockDiffStrategy,
				undefined,
				defaultModeSlug,
				undefined,
				customModes,
				undefined,
				true,
				undefined,
				true,
			)

			// Should contain rendered Pug templates from mode config
			expect(prompt).toContain("Test objective with cwd: test/path")
			expect(prompt).toContain("Test rules with diffStrategy: apply_diff")
			expect(prompt).toContain("Test capabilities with mcpHub: false")

			// Should also contain the file-based system prompt
			expect(prompt).toContain("Custom system prompt from file")
		})

		it("should render default templates when no overrides are provided", async () => {
			const prompt = await SYSTEM_PROMPT(
				mockContext,
				"test/path",
				false,
				undefined,
				undefined,
				undefined,
				defaultModeSlug,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				true,
			)

			// Should contain the default sections (appended after the file content)
			expect(prompt).toContain("OBJECTIVE")
			expect(prompt).toContain("RULES")

			// Should also contain the file-based system prompt
			expect(prompt).toContain("Custom system prompt from file")
		})
	})
})
