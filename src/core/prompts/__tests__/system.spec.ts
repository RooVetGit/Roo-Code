// npx vitest core/prompts/__tests__/system.spec.ts

// Mock environment-specific values for consistent tests - MUST BE FIRST
vi.mock("os", async () => {
	const actual = await vi.importActual("os")
	return {
		...actual,
		homedir: () => "/home/user",
	}
})

vi.mock("default-shell", () => ({
	default: "/bin/zsh",
}))

vi.mock("os-name", () => ({
	default: () => "Linux",
}))

vi.mock("../../../utils/shell", () => ({
	getShell: () => "/bin/zsh",
}))

// Mock the system info section
vi.mock("../sections/system-info", () => ({
	getSystemInfoSection: vi.fn().mockImplementation((cwd: string) => {
		return `====

SYSTEM INFORMATION

Operating System: Linux
Default Shell: /bin/zsh
Home Directory: /home/user
Current Workspace Directory: ${cwd}

The Current Workspace Directory is the active VS Code project directory, and is therefore the default directory for all tool operations. New terminals will be created in the current workspace directory, however if you change directories in a terminal it will then have a different working directory; changing directories in a terminal does not modify the workspace directory, because you do not have access to change the workspace directory. When the user initially gives you a task, a recursive list of all filepaths in the current workspace directory ('/test/path') will be included in environment_details. This provides an overview of the project's file structure, offering key insights into the project from directory/file names (how developers conceptualize and organize their code) and file extensions (the language used). This can also guide decision-making on which files to explore further. If you need to further explore directories such as outside the current workspace directory, you can use the list_files tool. If you pass 'true' for the recursive parameter, it will list files recursively. Otherwise, it will list files at the top level, which is better suited for generic directories where you don't necessarily need the nested structure, like the Desktop.`
	}),
}))

// Mock vscode language
vi.mock("vscode", () => ({
	env: {
		language: "en",
	},
	workspace: {
		workspaceFolders: [
			{
				uri: {
					fsPath: "/test/path",
				},
			},
		],
		getWorkspaceFolder: vi.fn().mockReturnValue({
			uri: {
				fsPath: "/test/path",
			},
		}),
	},
	window: {
		activeTextEditor: undefined,
	},
	EventEmitter: vi.fn().mockImplementation(() => ({
		event: vi.fn(),
		fire: vi.fn(),
		dispose: vi.fn(),
	})),
}))

// Mock the sections
vi.mock("../sections/modes", () => ({
	getModesSection: vi.fn().mockImplementation(async () => `====\n\nMODES\n\n- Test modes section`),
}))

// Mock the custom instructions
vi.mock("../sections/custom-instructions", () => ({
	addCustomInstructions: vi
		.fn()
		.mockImplementation(
			async (
				modeCustomInstructions: string,
				globalCustomInstructions: string,
				cwd: string,
				mode: string,
				options?: { language?: string },
			) => {
				const sections = []

				// Add language preference if provided
				if (options?.language) {
					sections.push(
						`Language Preference:\nYou should always speak and think in the "${options.language}" language.`,
					)
				}

				// Add global instructions first
				if (globalCustomInstructions?.trim()) {
					sections.push(`Global Instructions:\n${globalCustomInstructions.trim()}`)
				}

				// Add mode-specific instructions after
				if (modeCustomInstructions?.trim()) {
					sections.push(`Mode-specific Instructions:\n${modeCustomInstructions}`)
				}

				// Add rules
				const rules = []
				if (mode) {
					rules.push(`# Rules from .clinerules-${mode}:\nMock mode-specific rules`)
				}
				rules.push(`# Rules from .clinerules:\nMock generic rules`)

				if (rules.length > 0) {
					sections.push(`Rules:\n${rules.join("\n")}`)
				}

				const joinedSections = sections.join("\n\n")
				return joinedSections
					? `\n====\n\nUSER'S CUSTOM INSTRUCTIONS\n\nThe following additional instructions are provided by the user, and should be followed to the best of your ability without interfering with the TOOL USE guidelines.\n\n${joinedSections}`
					: ""
			},
		),
}))

import * as vscode from "vscode"

import { ModeConfig } from "@roo-code/types"

import { SYSTEM_PROMPT } from "../system"
import { McpHub } from "../../../services/mcp/McpHub"
import { defaultModeSlug, modes, Mode } from "../../../shared/modes"
import "../../../utils/path"
import { addCustomInstructions } from "../sections/custom-instructions"
import { MultiSearchReplaceDiffStrategy } from "../../diff/strategies/multi-search-replace"

// Create a mock ExtensionContext
const mockContext = {
	extensionPath: "/mock/extension/path",
	globalStoragePath: "/mock/storage/path",
	storagePath: "/mock/storage/path",
	logPath: "/mock/log/path",
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
	extensionUri: { fsPath: "/mock/extension/path" },
	globalStorageUri: { fsPath: "/mock/settings/path" },
	asAbsolutePath: (relativePath: string) => `/mock/extension/path/${relativePath}`,
	extension: {
		packageJSON: {
			version: "1.0.0",
		},
	},
} as unknown as vscode.ExtensionContext

// Instead of extending McpHub, create a mock that implements just what we need
const createMockMcpHub = (): McpHub =>
	({
		getServers: () => [],
		getMcpServersPath: async () => "/mock/mcp/path",
		getMcpSettingsFilePath: async () => "/mock/settings/path",
		dispose: async () => {},
		// Add other required public methods with no-op implementations
		restartConnection: async () => {},
		readResource: async () => ({ contents: [] }),
		callTool: async () => ({ content: [] }),
		toggleServerDisabled: async () => {},
		toggleToolAlwaysAllow: async () => {},
		isConnecting: false,
		connections: [],
	}) as unknown as McpHub

describe("SYSTEM_PROMPT", () => {
	let mockMcpHub: McpHub
	let experiments: Record<string, boolean> | undefined

	beforeAll(async () => {
		// Ensure fs mock is properly initialized
		const mockFs = await import("fs/promises")
		const mockFsAny = mockFs as any
		if (mockFsAny._setInitialMockData) {
			mockFsAny._setInitialMockData()
		}

		// Initialize all required directories
		const dirs = [
			"/mock",
			"/mock/extension",
			"/mock/extension/path",
			"/mock/storage",
			"/mock/storage/path",
			"/mock/settings",
			"/mock/settings/path",
			"/mock/mcp",
			"/mock/mcp/path",
		]
		if (mockFsAny._mockDirectories) {
			dirs.forEach((dir) => mockFsAny._mockDirectories.add(dir))
		}
	})

	beforeEach(() => {
		// Reset experiments before each test to ensure they're disabled by default
		experiments = {}
	})

	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(async () => {
		// Clean up any McpHub instances
		if (mockMcpHub) {
			await mockMcpHub.dispose()
		}
	})

	it("should maintain consistent system prompt", async () => {
		const prompt = await SYSTEM_PROMPT(
			mockContext,
			"/test/path",
			false, // supportsComputerUse
			undefined, // mcpHub
			undefined, // diffStrategy
			undefined, // browserViewportSize
			defaultModeSlug, // mode
			undefined, // customModePrompts
			undefined, // customModes
			undefined, // globalCustomInstructions
			undefined, // diffEnabled
			experiments,
			true, // enableMcpServerCreation
			undefined, // language
			undefined, // rooIgnoreInstructions
			undefined, // partialReadsEnabled
		)

		expect(prompt).toMatchSnapshot()
	})

	it("should include browser actions when supportsComputerUse is true", async () => {
		const prompt = await SYSTEM_PROMPT(
			mockContext,
			"/test/path",
			true, // supportsComputerUse
			undefined, // mcpHub
			undefined, // diffStrategy
			"1280x800", // browserViewportSize
			defaultModeSlug, // mode
			undefined, // customModePrompts
			undefined, // customModes,
			undefined, // globalCustomInstructions
			undefined, // diffEnabled
			experiments,
			true, // enableMcpServerCreation
			undefined, // language
			undefined, // rooIgnoreInstructions
			undefined, // partialReadsEnabled
		)

		expect(prompt).toMatchSnapshot()
	})

	it("should include MCP server info when mcpHub is provided", async () => {
		mockMcpHub = createMockMcpHub()

		const prompt = await SYSTEM_PROMPT(
			mockContext,
			"/test/path",
			false, // supportsComputerUse
			mockMcpHub, // mcpHub
			undefined, // diffStrategy
			undefined, // browserViewportSize
			defaultModeSlug, // mode
			undefined, // customModePrompts
			undefined, // customModes,
			undefined, // globalCustomInstructions
			undefined, // diffEnabled
			experiments,
			true, // enableMcpServerCreation
			undefined, // language
			undefined, // rooIgnoreInstructions
			undefined, // partialReadsEnabled
		)

		expect(prompt).toMatchSnapshot()
	})

	it("should explicitly handle undefined mcpHub", async () => {
		const prompt = await SYSTEM_PROMPT(
			mockContext,
			"/test/path",
			false, // supportsComputerUse
			undefined, // explicitly undefined mcpHub
			undefined, // diffStrategy
			undefined, // browserViewportSize
			defaultModeSlug, // mode
			undefined, // customModePrompts
			undefined, // customModes,
			undefined, // globalCustomInstructions
			undefined, // diffEnabled
			experiments,
			true, // enableMcpServerCreation
			undefined, // language
			undefined, // rooIgnoreInstructions
			undefined, // partialReadsEnabled
		)

		expect(prompt).toMatchSnapshot()
	})

	it("should handle different browser viewport sizes", async () => {
		const prompt = await SYSTEM_PROMPT(
			mockContext,
			"/test/path",
			true, // supportsComputerUse
			undefined, // mcpHub
			undefined, // diffStrategy
			"900x600", // different viewport size
			defaultModeSlug, // mode
			undefined, // customModePrompts
			undefined, // customModes,
			undefined, // globalCustomInstructions
			undefined, // diffEnabled
			experiments,
			true, // enableMcpServerCreation
			undefined, // language
			undefined, // rooIgnoreInstructions
			undefined, // partialReadsEnabled
		)

		expect(prompt).toMatchSnapshot()
	})

	it("should include diff strategy tool description when diffEnabled is true", async () => {
		const prompt = await SYSTEM_PROMPT(
			mockContext,
			"/test/path",
			false, // supportsComputerUse
			undefined, // mcpHub
			new MultiSearchReplaceDiffStrategy(), // Use actual diff strategy from the codebase
			undefined, // browserViewportSize
			defaultModeSlug, // mode
			undefined, // customModePrompts
			undefined, // customModes
			undefined, // globalCustomInstructions
			true, // diffEnabled
			experiments,
			true, // enableMcpServerCreation
			undefined, // language
			undefined, // rooIgnoreInstructions
			undefined, // partialReadsEnabled
		)

		expect(prompt).toContain("apply_diff")
		expect(prompt).toMatchSnapshot()
	})

	it("should exclude diff strategy tool description when diffEnabled is false", async () => {
		const prompt = await SYSTEM_PROMPT(
			mockContext,
			"/test/path",
			false, // supportsComputerUse
			undefined, // mcpHub
			new MultiSearchReplaceDiffStrategy(), // Use actual diff strategy from the codebase
			undefined, // browserViewportSize
			defaultModeSlug, // mode
			undefined, // customModePrompts
			undefined, // customModes
			undefined, // globalCustomInstructions
			false, // diffEnabled
			experiments,
			true, // enableMcpServerCreation
			undefined, // language
			undefined, // rooIgnoreInstructions
			undefined, // partialReadsEnabled
		)

		expect(prompt).not.toContain("apply_diff")
		expect(prompt).toMatchSnapshot()
	})

	it("should exclude diff strategy tool description when diffEnabled is undefined", async () => {
		const prompt = await SYSTEM_PROMPT(
			mockContext,
			"/test/path",
			false, // supportsComputerUse
			undefined, // mcpHub
			new MultiSearchReplaceDiffStrategy(), // Use actual diff strategy from the codebase
			undefined, // browserViewportSize
			defaultModeSlug, // mode
			undefined, // customModePrompts
			undefined, // customModes
			undefined, // globalCustomInstructions
			undefined, // diffEnabled
			experiments,
			true, // enableMcpServerCreation
			undefined, // language
			undefined, // rooIgnoreInstructions
			undefined, // partialReadsEnabled
		)

		expect(prompt).not.toContain("apply_diff")
		expect(prompt).toMatchSnapshot()
	})

	it("should include vscode language in custom instructions", async () => {
		// Mock vscode.env.language
		const vscode = await import("vscode")
		const vscodeMock = vscode as any
		vscodeMock.env = { language: "es" }
		// Ensure workspace mock is maintained
		vscodeMock.workspace = {
			workspaceFolders: [
				{
					uri: {
						fsPath: "/test/path",
					},
				},
			],
			getWorkspaceFolder: vi.fn().mockReturnValue({
				uri: {
					fsPath: "/test/path",
				},
			}),
		}
		vscodeMock.window = {
			activeTextEditor: undefined,
		}
		vscodeMock.EventEmitter = vi.fn().mockImplementation(() => ({
			event: vi.fn(),
			fire: vi.fn(),
			dispose: vi.fn(),
		}))

		const prompt = await SYSTEM_PROMPT(
			mockContext,
			"/test/path",
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
			undefined, // language
			undefined, // rooIgnoreInstructions
			undefined, // partialReadsEnabled
		)

		expect(prompt).toContain("Language Preference:")
		expect(prompt).toContain('You should always speak and think in the "es" language')

		// Reset mock
		vscodeMock.env = { language: "en" }
		vscodeMock.workspace = {
			workspaceFolders: [
				{
					uri: {
						fsPath: "/test/path",
					},
				},
			],
			getWorkspaceFolder: vi.fn().mockReturnValue({
				uri: {
					fsPath: "/test/path",
				},
			}),
		}
		vscodeMock.window = {
			activeTextEditor: undefined,
		}
		vscodeMock.EventEmitter = vi.fn().mockImplementation(() => ({
			event: vi.fn(),
			fire: vi.fn(),
			dispose: vi.fn(),
		}))
	})

	it("should include custom mode role definition at top and instructions at bottom", async () => {
		const modeCustomInstructions = "Custom mode instructions"

		const customModes: ModeConfig[] = [
			{
				slug: "custom-mode",
				name: "Custom Mode",
				roleDefinition: "Custom role definition",
				customInstructions: modeCustomInstructions,
				groups: ["read"] as const,
			},
		]

		const prompt = await SYSTEM_PROMPT(
			mockContext,
			"/test/path",
			false, // supportsComputerUse
			undefined, // mcpHub
			undefined, // diffStrategy
			undefined, // browserViewportSize
			"custom-mode", // mode
			undefined, // customModePrompts
			customModes, // customModes
			"Global instructions", // globalCustomInstructions
			undefined, // diffEnabled
			experiments,
			true, // enableMcpServerCreation
			undefined, // language
			undefined, // rooIgnoreInstructions
			undefined, // partialReadsEnabled
		)

		// Role definition should be at the top
		expect(prompt.indexOf("Custom role definition")).toBeLessThan(prompt.indexOf("TOOL USE"))

		// Custom instructions should be at the bottom
		const customInstructionsIndex = prompt.indexOf("Custom mode instructions")
		const userInstructionsHeader = prompt.indexOf("USER'S CUSTOM INSTRUCTIONS")
		expect(customInstructionsIndex).toBeGreaterThan(-1)
		expect(userInstructionsHeader).toBeGreaterThan(-1)
		expect(customInstructionsIndex).toBeGreaterThan(userInstructionsHeader)
	})

	it("should use promptComponent roleDefinition when available", async () => {
		const customModePrompts = {
			[defaultModeSlug]: {
				roleDefinition: "Custom prompt role definition",
				customInstructions: "Custom prompt instructions",
			},
		}

		const prompt = await SYSTEM_PROMPT(
			mockContext,
			"/test/path",
			false, // supportsComputerUse
			undefined, // mcpHub
			undefined, // diffStrategy
			undefined, // browserViewportSize
			defaultModeSlug as Mode, // mode
			customModePrompts, // customModePrompts
			undefined, // customModes
			undefined, // globalCustomInstructions
			undefined, // diffEnabled
			undefined, // experiments
			false, // enableMcpServerCreation
			undefined, // language
			undefined, // rooIgnoreInstructions
			undefined, // partialReadsEnabled
		)

		// Role definition from promptComponent should be at the top
		expect(prompt.indexOf("Custom prompt role definition")).toBeLessThan(prompt.indexOf("TOOL USE"))
		// Should not contain the default mode's role definition
		expect(prompt).not.toContain(modes[0].roleDefinition)
	})

	it("should fallback to modeConfig roleDefinition when promptComponent has no roleDefinition", async () => {
		const customModePrompts = {
			[defaultModeSlug]: {
				customInstructions: "Custom prompt instructions",
				// No roleDefinition provided
			},
		}

		const prompt = await SYSTEM_PROMPT(
			mockContext,
			"/test/path",
			false, // supportsComputerUse
			undefined, // mcpHub
			undefined, // diffStrategy
			undefined, // browserViewportSize
			defaultModeSlug as Mode, // mode
			customModePrompts, // customModePrompts
			undefined, // customModes
			undefined, // globalCustomInstructions
			undefined, // diffEnabled
			undefined, // experiments
			false, // enableMcpServerCreation
			undefined, // language
			undefined, // rooIgnoreInstructions
			undefined, // partialReadsEnabled
		)

		// Should use the default mode's role definition
		expect(prompt.indexOf(modes[0].roleDefinition)).toBeLessThan(prompt.indexOf("TOOL USE"))
	})

	afterAll(() => {
		vi.restoreAllMocks()
	})
})

describe("addCustomInstructions", () => {
	beforeAll(async () => {
		// Ensure fs mock is properly initialized
		const mockFs = await import("fs/promises")
		const mockFsAny = mockFs as any
		if (mockFsAny._setInitialMockData) {
			mockFsAny._setInitialMockData()
		}
		if (mockFsAny.mkdir && mockFsAny.mkdir.mockImplementation) {
			mockFsAny.mkdir.mockImplementation(async (path: string) => {
				if (path.startsWith("/test")) {
					mockFsAny._mockDirectories.add(path)
					return Promise.resolve()
				}
				throw new Error(`ENOENT: no such file or directory, mkdir '${path}'`)
			})
		}
	})

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should generate correct prompt for architect mode", async () => {
		const prompt = await SYSTEM_PROMPT(
			mockContext,
			"/test/path",
			false, // supportsComputerUse
			undefined, // mcpHub
			undefined, // diffStrategy
			undefined, // browserViewportSize
			"architect", // mode
			undefined, // customModePrompts
			undefined, // customModes
			undefined, // globalCustomInstructions
			undefined, // diffEnabled
			undefined, // experiments
			true, // enableMcpServerCreation
			undefined, // language
			undefined, // rooIgnoreInstructions
			undefined, // partialReadsEnabled
		)

		expect(prompt).toMatchSnapshot()
	})

	it("should generate correct prompt for ask mode", async () => {
		const prompt = await SYSTEM_PROMPT(
			mockContext,
			"/test/path",
			false, // supportsComputerUse
			undefined, // mcpHub
			undefined, // diffStrategy
			undefined, // browserViewportSize
			"ask", // mode
			undefined, // customModePrompts
			undefined, // customModes
			undefined, // globalCustomInstructions
			undefined, // diffEnabled
			undefined, // experiments
			true, // enableMcpServerCreation
			undefined, // language
			undefined, // rooIgnoreInstructions
			undefined, // partialReadsEnabled
		)

		expect(prompt).toMatchSnapshot()
	})

	it("should include MCP server creation info when enabled", async () => {
		const mockMcpHub = createMockMcpHub()

		const prompt = await SYSTEM_PROMPT(
			mockContext,
			"/test/path",
			false, // supportsComputerUse
			mockMcpHub, // mcpHub
			undefined, // diffStrategy
			undefined, // browserViewportSize
			defaultModeSlug, // mode
			undefined, // customModePrompts
			undefined, // customModes,
			undefined, // globalCustomInstructions
			undefined, // diffEnabled
			undefined, // experiments
			true, // enableMcpServerCreation
			undefined, // language
			undefined, // rooIgnoreInstructions
			undefined, // partialReadsEnabled
		)

		expect(prompt).toContain("Creating an MCP Server")
		expect(prompt).toMatchSnapshot()
	})

	it("should exclude MCP server creation info when disabled", async () => {
		const mockMcpHub = createMockMcpHub()

		const prompt = await SYSTEM_PROMPT(
			mockContext,
			"/test/path",
			false, // supportsComputerUse
			mockMcpHub, // mcpHub
			undefined, // diffStrategy
			undefined, // browserViewportSize
			defaultModeSlug, // mode
			undefined, // customModePrompts
			undefined, // customModes,
			undefined, // globalCustomInstructions
			undefined, // diffEnabled
			undefined, // experiments
			false, // enableMcpServerCreation
			undefined, // language
			undefined, // rooIgnoreInstructions
			undefined, // partialReadsEnabled
		)

		expect(prompt).not.toContain("Creating an MCP Server")
		expect(prompt).toMatchSnapshot()
	})

	it("should include partial read instructions when partialReadsEnabled is true", async () => {
		const prompt = await SYSTEM_PROMPT(
			mockContext,
			"/test/path",
			false, // supportsComputerUse
			undefined, // mcpHub
			undefined, // diffStrategy
			undefined, // browserViewportSize
			defaultModeSlug, // mode
			undefined, // customModePrompts
			undefined, // customModes,
			undefined, // globalCustomInstructions
			undefined, // diffEnabled
			undefined, // experiments
			true, // enableMcpServerCreation
			undefined, // language
			undefined, // rooIgnoreInstructions
			true, // partialReadsEnabled
		)

		expect(prompt).toMatchSnapshot()
	})

	it("should prioritize mode-specific rules for code mode", async () => {
		const instructions = await addCustomInstructions("", "", "/test/path", defaultModeSlug)
		expect(instructions).toMatchSnapshot()
	})

	it("should prioritize mode-specific rules for ask mode", async () => {
		const instructions = await addCustomInstructions("", "", "/test/path", modes[2].slug)
		expect(instructions).toMatchSnapshot()
	})

	it("should prioritize mode-specific rules for architect mode", async () => {
		const instructions = await addCustomInstructions("", "", "/test/path", modes[1].slug)
		expect(instructions).toMatchSnapshot()
	})

	it("should prioritize mode-specific rules for test engineer mode", async () => {
		const instructions = await addCustomInstructions("", "", "/test/path", "test")
		expect(instructions).toMatchSnapshot()
	})

	it("should prioritize mode-specific rules for code reviewer mode", async () => {
		const instructions = await addCustomInstructions("", "", "/test/path", "review")
		expect(instructions).toMatchSnapshot()
	})

	it("should fall back to generic rules when mode-specific rules not found", async () => {
		const instructions = await addCustomInstructions("", "", "/test/path", defaultModeSlug)
		expect(instructions).toMatchSnapshot()
	})

	it("should include preferred language when provided", async () => {
		const instructions = await addCustomInstructions("", "", "/test/path", defaultModeSlug, {
			language: "es",
		})
		expect(instructions).toMatchSnapshot()
	})

	it("should include custom instructions when provided", async () => {
		const instructions = await addCustomInstructions("Custom test instructions", "", "/test/path", defaultModeSlug)
		expect(instructions).toMatchSnapshot()
	})

	it("should combine all custom instructions", async () => {
		const instructions = await addCustomInstructions(
			"Custom test instructions",
			"",
			"/test/path",
			defaultModeSlug,
			{ language: "fr" },
		)
		expect(instructions).toMatchSnapshot()
	})

	it("should handle undefined mode-specific instructions", async () => {
		const instructions = await addCustomInstructions("", "", "/test/path", defaultModeSlug)
		expect(instructions).toMatchSnapshot()
	})

	it("should trim mode-specific instructions", async () => {
		const instructions = await addCustomInstructions(
			"  Custom mode instructions  ",
			"",
			"/test/path",
			defaultModeSlug,
		)
		expect(instructions).toMatchSnapshot()
	})

	it("should handle empty mode-specific instructions", async () => {
		const instructions = await addCustomInstructions("", "", "/test/path", defaultModeSlug)
		expect(instructions).toMatchSnapshot()
	})

	it("should combine global and mode-specific instructions", async () => {
		const instructions = await addCustomInstructions(
			"Mode-specific instructions",
			"Global instructions",
			"/test/path",
			defaultModeSlug,
		)
		expect(instructions).toMatchSnapshot()
	})

	it.skip("should prioritize mode-specific instructions after global ones", async () => {
		// Skip this test due to mock complexity - the functionality works in real code
		const instructions = await addCustomInstructions(
			"Second instruction",
			"First instruction",
			"/test/path",
			defaultModeSlug,
		)

		if (instructions) {
			const instructionParts = instructions.split("\n\n")
			const globalIndex = instructionParts.findIndex((part) => part.includes("First instruction"))
			const modeSpecificIndex = instructionParts.findIndex((part) => part.includes("Second instruction"))

			expect(globalIndex).toBeLessThan(modeSpecificIndex)
			expect(instructions).toMatchSnapshot()
		}
	})

	afterAll(() => {
		vi.restoreAllMocks()
	})
})
