import { jest } from "@jest/globals"
import { generateCommitSuggestion, getRepo } from "../commitSuggestion"
import * as vscode from "vscode"

// Mock repository object
const mockInputBox = { value: "" }
const mockRepository = {
	rootUri: { fsPath: "/test/path" },
	inputBox: mockInputBox,
}

// Mock vscode module
jest.mock("vscode", () => ({
	window: {
		showErrorMessage: jest.fn(),
		showInformationMessage: jest.fn(),
	},
	env: {
		clipboard: {
			writeText: jest.fn().mockImplementation(() => Promise.resolve()),
		},
	},
	workspace: {
		workspaceFolders: [{ uri: { fsPath: "/test/path" } }],
	},
	extensions: {
		getExtension: jest.fn().mockImplementation(() => ({
			exports: {
				getAPI: jest.fn().mockImplementation(() => ({
					repositories: [mockRepository],
				})),
			},
		})),
	},
}))

// Mock git.ts
jest.mock("../git", () => ({
	getWorkingState: jest.fn(),
}))

// Mock single-completion-handler.ts
jest.mock("../single-completion-handler", () => ({
	singleCompletionHandler: jest.fn(),
}))

// Mock support-prompt.ts
jest.mock("../../shared/support-prompt", () => ({
	supportPrompt: {
		create: jest.fn().mockReturnValue("mock prompt"),
	},
}))

// Mock extract-text.ts
jest.mock("../../integrations/misc/extract-text", () => ({
	truncateOutput: jest.fn((text) => text),
}))

// Mock child_process and util
jest.mock("child_process", () => ({
	exec: jest.fn(),
}))

jest.mock("util", () => ({
	promisify: jest.fn((fn) => fn),
}))

// Mock fs
jest.mock("fs", () => ({
	existsSync: jest.fn(),
	readFileSync: jest.fn(),
}))

// Mock path
jest.mock("path", () => ({
	join: jest.fn((...args) => args.join("/")),
}))

describe("commitSuggestion", () => {
	// Create a mock provider
	const mockProvider = {
		getState: jest.fn().mockImplementation(() => {
			return Promise.resolve({
				apiConfiguration: { apiProvider: "test" },
				customSupportPrompts: {},
			})
		}),
		providerSettingsManager: {
			loadConfig: jest.fn().mockImplementation(() => Promise.resolve({})),
		},
	} as any

	beforeEach(() => {
		jest.clearAllMocks()
	})

	describe("generateCommitSuggestion", () => {
		it("should show error when no staged changes", async () => {
			// Setup mocks
			const { getWorkingState } = require("../git")
			getWorkingState.mockResolvedValue("No changes in working directory")

			// Call function
			await generateCommitSuggestion(mockProvider, "/test/path")

			// Verify error message
			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("No changes to generate commit message")
		})

		it("should generate commit message and set it in the SCM input box", async () => {
			// Setup mocks
			const { getWorkingState } = require("../git")
			getWorkingState.mockResolvedValue("Working directory changes:\n\nM - file1.txt\n\ndiff content")

			const { singleCompletionHandler } = require("../single-completion-handler")
			singleCompletionHandler.mockResolvedValue("feat(test): add new feature")

			// Reset input box value
			mockInputBox.value = ""

			// Call function
			await generateCommitSuggestion(mockProvider, "/test/path")

			// Verify SCM input box was updated
			expect(mockRepository.inputBox.value).toBe("feat(test): add new feature")
			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith("Commit message set in editor")
		})

		it("should handle error when getting staged changes fails", async () => {
			// Setup mocks
			const { getWorkingState } = require("../git")
			getWorkingState.mockRejectedValue(new Error("Git error"))

			// Call function
			await generateCommitSuggestion(mockProvider, "/test/path")

			// Verify error message
			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Failed to get staged changes")
		})

		it("should handle error when generating commit message fails", async () => {
			// Setup mocks
			const { getWorkingState } = require("../git")
			getWorkingState.mockResolvedValue("Working directory changes:\n\nM - file1.txt\n\ndiff content")

			const { singleCompletionHandler } = require("../single-completion-handler")
			singleCompletionHandler.mockRejectedValue(new Error("API error"))

			// Call function
			await generateCommitSuggestion(mockProvider, "/test/path")

			// Verify error message
			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Failed to generate commit message")
		})

		it("should use enhancement API config when available", async () => {
			// Setup mocks
			const { getWorkingState } = require("../git")
			getWorkingState.mockResolvedValue("Working directory changes:\n\nM - file1.txt\n\ndiff content")

			const { singleCompletionHandler } = require("../single-completion-handler")
			singleCompletionHandler.mockResolvedValue("feat(test): add new feature")

			// Mock provider with enhancement config
			const mockProviderWithEnhancement = {
				getState: jest.fn().mockImplementation(() => {
					return Promise.resolve({
						apiConfiguration: { apiProvider: "test" },
						customSupportPrompts: {},
						enhancementApiConfigId: "enhanced-config",
						listApiConfigMeta: [{ id: "enhanced-config", name: "Enhanced Config" }],
					})
				}),
				providerSettingsManager: {
					loadConfig: jest.fn().mockImplementation(() => Promise.resolve({ apiProvider: "enhanced" })),
				},
			} as any

			// Call function
			await generateCommitSuggestion(mockProviderWithEnhancement, "/test/path")

			// Verify enhanced config was loaded and used
			expect(mockProviderWithEnhancement.providerSettingsManager.loadConfig).toHaveBeenCalledWith(
				"Enhanced Config",
			)
			expect(singleCompletionHandler).toHaveBeenCalledWith({ apiProvider: "enhanced" }, expect.any(String))
		})

		it("should fall back to clipboard if setting SCM input box fails", async () => {
			// Setup mocks
			const { getWorkingState } = require("../git")
			getWorkingState.mockResolvedValue("Working directory changes:\n\nM - file1.txt\n\ndiff content")

			const { singleCompletionHandler } = require("../single-completion-handler")
			singleCompletionHandler.mockResolvedValue("feat(test): add new feature")

			// Mock extensions to throw an error
			const mockedVscode = require("vscode")
			mockedVscode.extensions.getExtension.mockImplementation(() => null)

			// Call function
			await generateCommitSuggestion(mockProvider, "/test/path")

			// Verify fallback to clipboard
			expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith("feat(test): add new feature")
			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith("Commit message copied to clipboard")
		})
	})
})
