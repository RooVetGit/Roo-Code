import * as vscode from "vscode"
import * as os from "os"
import { ClineProviderStatic, FormatLanguageUtil, PromptVariables } from "./test-types"

// Mock dependencies
jest.mock("vscode", () => ({
	env: {
		language: "en",
		shell: "/bin/bash",
	},
}))

jest.mock("os", () => ({
	type: jest.fn(),
}))

// Create mock ClineProvider
const MockClineProvider = {
	getInstance: jest.fn(),
} as unknown as ClineProviderStatic

// Create mock formatLanguage utility
const formatLanguage = jest.fn() as FormatLanguageUtil

describe("System Prompt Variables", () => {
	const mockCwd = "/test/workspace"
	const mockMode = "test-mode"
	const mockGetState = jest.fn()
	const mockProvider = {
		getState: mockGetState,
	}

	beforeEach(() => {
		jest.clearAllMocks()
		jest.resetModules()
		;(os.type as jest.Mock).mockReturnValue("Linux")
		;(formatLanguage as jest.Mock).mockReturnValue("en-US")
		;(MockClineProvider.getInstance as jest.Mock).mockResolvedValue(mockProvider)

		// Set up global variables that would normally be in scope
		globalThis.cwd = mockCwd
		globalThis.mode = mockMode
		globalThis.language = undefined
	})

	it("should use maxReadFileLine from provider state when available", async () => {
		// Setup
		const mockState = { maxReadFileLine: 1000 }
		mockGetState.mockResolvedValue(mockState)

		// Create test variables
		const provider = await MockClineProvider.getInstance()
		const { maxReadFileLine = 500 } = provider ? await provider.getState() : {}
		const testVariables: PromptVariables = {
			workspace: mockCwd,
			mode: mockMode,
			language: globalThis.language || formatLanguage(vscode.env.language),
			shell: vscode.env.shell,
			operatingSystem: os.type(),
			maxReadFileLine,
		}

		// Verify
		expect(testVariables).toEqual({
			workspace: mockCwd,
			mode: mockMode,
			language: "en-US",
			shell: "/bin/bash",
			operatingSystem: "Linux",
			maxReadFileLine: 1000,
		})
	})

	it("should default maxReadFileLine to 500 when not in provider state", async () => {
		// Setup
		mockGetState.mockResolvedValue({})

		// Create test variables
		const provider = await MockClineProvider.getInstance()
		const { maxReadFileLine = 500 } = provider ? await provider.getState() : {}
		const testVariables: PromptVariables = {
			workspace: mockCwd,
			mode: mockMode,
			language: globalThis.language || formatLanguage(vscode.env.language),
			shell: vscode.env.shell,
			operatingSystem: os.type(),
			maxReadFileLine,
		}

		// Verify
		expect(testVariables.maxReadFileLine).toBe(500)
	})

	it("should default maxReadFileLine to 500 when provider is null", async () => {
		// Setup
		;(MockClineProvider.getInstance as jest.Mock).mockResolvedValue(null)

		// Create test variables
		const provider = await MockClineProvider.getInstance()
		const { maxReadFileLine = 500 } = provider ? await provider.getState() : {}
		const testVariables: PromptVariables = {
			workspace: mockCwd,
			mode: mockMode,
			language: globalThis.language || formatLanguage(vscode.env.language),
			shell: vscode.env.shell,
			operatingSystem: os.type(),
			maxReadFileLine,
		}

		// Verify
		expect(testVariables.maxReadFileLine).toBe(500)
	})

	it("should use provided language when available", async () => {
		// Setup
		const providedLanguage = "fr"
		mockGetState.mockResolvedValue({})
		globalThis.language = providedLanguage

		// Create test variables
		const provider = await MockClineProvider.getInstance()
		const { maxReadFileLine = 500 } = provider ? await provider.getState() : {}
		const testVariables: PromptVariables = {
			workspace: mockCwd,
			mode: mockMode,
			language: globalThis.language || formatLanguage(vscode.env.language),
			shell: vscode.env.shell,
			operatingSystem: os.type(),
			maxReadFileLine,
		}

		// Verify
		expect(testVariables.language).toBe(providedLanguage)
		expect(formatLanguage).not.toHaveBeenCalled()
	})

	it("should use formatted vscode language when input language is not provided", async () => {
		// Setup
		mockGetState.mockResolvedValue({})
		globalThis.language = undefined

		// Create test variables
		const provider = await MockClineProvider.getInstance()
		const { maxReadFileLine = 500 } = provider ? await provider.getState() : {}
		const testVariables: PromptVariables = {
			workspace: mockCwd,
			mode: mockMode,
			language: globalThis.language || formatLanguage(vscode.env.language),
			shell: vscode.env.shell,
			operatingSystem: os.type(),
			maxReadFileLine,
		}

		// Verify
		expect(formatLanguage).toHaveBeenCalledWith("en")
		expect(testVariables.language).toBe("en-US")
	})

	it("should correctly populate all variables with mocked inputs", async () => {
		// Setup
		mockGetState.mockResolvedValue({ maxReadFileLine: 750 })

		// Create test variables
		const provider = await MockClineProvider.getInstance()
		const { maxReadFileLine = 500 } = provider ? await provider.getState() : {}
		const testVariables: PromptVariables = {
			workspace: mockCwd,
			mode: mockMode,
			language: globalThis.language || formatLanguage(vscode.env.language),
			shell: vscode.env.shell,
			operatingSystem: os.type(),
			maxReadFileLine,
		}

		// Verify
		expect(testVariables).toEqual({
			workspace: mockCwd,
			mode: mockMode,
			language: "en-US",
			shell: "/bin/bash",
			operatingSystem: "Linux",
			maxReadFileLine: 750,
		})

		expect(os.type).toHaveBeenCalled()
		expect(MockClineProvider.getInstance).toHaveBeenCalled()
		expect(mockGetState).toHaveBeenCalled()
	})
})
