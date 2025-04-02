import { jest } from "@jest/globals"
import { generateCommitSuggestion } from "../commitSuggestion"
import * as vscode from "vscode"

// Mock vscode module
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
	scm: {
		inputBox: {
			value: "",
		},
	},
}))

// Mock git.ts
jest.mock("../git", () => ({
	getStagedDiff: jest.fn(),
	getStagedStatus: jest.fn(),
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
			const { getStagedStatus } = require("../git")
			getStagedStatus.mockResolvedValue("")

			// Call function
			await generateCommitSuggestion(mockProvider, "/test/path")

			// Verify error message
			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("No staged changes to generate commit message")
		})

		it("should generate commit message and set it in the SCM input box", async () => {
			// Setup mocks
			const { getStagedStatus, getStagedDiff } = require("../git")
			getStagedStatus.mockResolvedValue("M - file1.txt")
			getStagedDiff.mockResolvedValue("diff content")

			const { singleCompletionHandler } = require("../single-completion-handler")
			singleCompletionHandler.mockResolvedValue("feat(test): add new feature")

			// Call function
			await generateCommitSuggestion(mockProvider, "/test/path")

			// Verify SCM input box was updated
			expect(vscode.scm.inputBox.value).toBe("feat(test): add new feature")
			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith("Commit suggestion applied to input box")
		})

		it("should handle error when getting staged changes fails", async () => {
			// Setup mocks
			const { getStagedStatus } = require("../git")
			getStagedStatus.mockRejectedValue(new Error("Git error"))

			// Call function
			await generateCommitSuggestion(mockProvider, "/test/path")

			// Verify error message
			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Failed to get staged changes")
		})

		it("should handle error when generating commit message fails", async () => {
			// Setup mocks
			const { getStagedStatus, getStagedDiff } = require("../git")
			getStagedStatus.mockResolvedValue("M - file1.txt")
			getStagedDiff.mockResolvedValue("diff content")

			const { singleCompletionHandler } = require("../single-completion-handler")
			singleCompletionHandler.mockRejectedValue(new Error("API error"))

			// Call function
			await generateCommitSuggestion(mockProvider, "/test/path")

			// Verify error message
			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("Failed to generate commit message")
		})

		it("should use enhancement API config when available", async () => {
			// Setup mocks
			const { getStagedStatus, getStagedDiff } = require("../git")
			getStagedStatus.mockResolvedValue("M - file1.txt")
			getStagedDiff.mockResolvedValue("diff content")

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
	})
})
