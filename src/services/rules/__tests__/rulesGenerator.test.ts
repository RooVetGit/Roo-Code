import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"
import { createRulesGenerationTaskMessage, handleGenerateRules } from "../rulesGenerator"
import { ClineProvider } from "../../../core/webview/ClineProvider"

// Mock fs module
vi.mock("fs/promises", () => ({
	mkdir: vi.fn(),
}))

// Mock vscode module
vi.mock("vscode", () => ({
	window: {
		showErrorMessage: vi.fn(),
	},
}))

// Mock getWorkspacePath
vi.mock("../../../utils/path", () => ({
	getWorkspacePath: vi.fn(),
}))

describe("rulesGenerator", () => {
	const mockWorkspacePath = "/test/workspace"

	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("createRulesGenerationTaskMessage", () => {
		it("should create directories when alwaysAllowWriteProtected is true", async () => {
			await createRulesGenerationTaskMessage(mockWorkspacePath, ["general"], false, true)

			// Verify mkdir was called for each directory
			expect(fs.mkdir).toHaveBeenCalledWith(path.join(mockWorkspacePath, ".roo", "rules"), { recursive: true })
			expect(fs.mkdir).toHaveBeenCalledWith(path.join(mockWorkspacePath, ".roo", "rules-code"), {
				recursive: true,
			})
			expect(fs.mkdir).toHaveBeenCalledWith(path.join(mockWorkspacePath, ".roo", "rules-architect"), {
				recursive: true,
			})
			expect(fs.mkdir).toHaveBeenCalledWith(path.join(mockWorkspacePath, ".roo", "rules-debug"), {
				recursive: true,
			})
			expect(fs.mkdir).toHaveBeenCalledWith(path.join(mockWorkspacePath, ".roo", "rules-docs-extractor"), {
				recursive: true,
			})
		})

		it("should NOT create directories when alwaysAllowWriteProtected is false", async () => {
			await createRulesGenerationTaskMessage(mockWorkspacePath, ["general"], false, false)

			// Verify mkdir was NOT called
			expect(fs.mkdir).not.toHaveBeenCalled()
		})

		it("should include auto-approval note in message when alwaysAllowWriteProtected is true", async () => {
			const message = await createRulesGenerationTaskMessage(mockWorkspacePath, ["general"], false, true)

			expect(message).toContain("The directory has already been created for you")
			expect(message).toContain("Auto-approval for protected file writes is enabled")
		})

		it("should include manual approval note in message when alwaysAllowWriteProtected is false", async () => {
			const message = await createRulesGenerationTaskMessage(mockWorkspacePath, ["general"], false, false)

			expect(message).toContain("Create the necessary directories if they don't exist")
			expect(message).toContain("You will need to approve the creation of protected directories and files")
		})

		it("should handle multiple rule types", async () => {
			const message = await createRulesGenerationTaskMessage(
				mockWorkspacePath,
				["general", "code", "architect"],
				false,
				true,
			)

			expect(message).toContain(".roo/rules/coding-standards.md")
			expect(message).toContain(".roo/rules-code/implementation-rules.md")
			expect(message).toContain(".roo/rules-architect/architecture-rules.md")
		})

		it("should include gitignore instructions when addToGitignore is true", async () => {
			const message = await createRulesGenerationTaskMessage(mockWorkspacePath, ["general"], true, false)

			expect(message).toContain("Add the generated files to .gitignore")
		})

		it("should include analysis steps for each rule type", async () => {
			const message = await createRulesGenerationTaskMessage(mockWorkspacePath, ["code"], false, false)

			// Check that code-specific analysis steps are included
			expect(message).toContain("Analyze package.json or equivalent files")
			expect(message).toContain("Check for linting and formatting tools")
			expect(message).toContain("Examine test files to understand testing patterns")
		})

		it("should include different analysis steps for different rule types", async () => {
			const message = await createRulesGenerationTaskMessage(mockWorkspacePath, ["architect"], false, false)

			// Check that architect-specific analysis steps are included
			expect(message).toContain("Analyze the overall directory structure")
			expect(message).toContain("Identify architectural patterns")
			expect(message).toContain("separation of concerns")
		})

		it("should include custom rules when includeCustomRules is true", async () => {
			const customRulesText = "Always use TypeScript interfaces instead of types"
			const message = await createRulesGenerationTaskMessage(
				mockWorkspacePath,
				["general"],
				false,
				false,
				true,
				customRulesText,
			)

			expect(message).toContain("Additional rules from User to add to the rules file:")
			expect(message).toContain(customRulesText)
		})

		it("should not include custom rules when includeCustomRules is false", async () => {
			const customRulesText = "Always use TypeScript interfaces instead of types"
			const message = await createRulesGenerationTaskMessage(
				mockWorkspacePath,
				["general"],
				false,
				false,
				false,
				customRulesText,
			)

			expect(message).not.toContain("Additional rules from User to add to the rules file:")
			expect(message).not.toContain(customRulesText)
		})

		it("should handle empty custom rules text", async () => {
			const message = await createRulesGenerationTaskMessage(
				mockWorkspacePath,
				["general"],
				false,
				false,
				true,
				"",
			)

			expect(message).not.toContain("Additional rules from User to add to the rules file:")
		})

		it("should handle mkdir errors gracefully", async () => {
			// Mock mkdir to throw an error
			vi.mocked(fs.mkdir).mockRejectedValueOnce(new Error("Permission denied"))

			// Should not throw even if mkdir fails
			await expect(
				createRulesGenerationTaskMessage(mockWorkspacePath, ["general"], false, true),
			).resolves.toBeDefined()
		})

		it("should filter out invalid rule types", async () => {
			const message = await createRulesGenerationTaskMessage(
				mockWorkspacePath,
				["general", "invalid-type", "code"],
				false,
				false,
			)

			// Should include valid types
			expect(message).toContain(".roo/rules/coding-standards.md")
			expect(message).toContain(".roo/rules-code/implementation-rules.md")

			// Should not include invalid type
			expect(message).not.toContain("invalid-type")
		})

		it("should handle all rule types", async () => {
			const allRuleTypes = ["general", "code", "architect", "debug", "docs-extractor"]
			const message = await createRulesGenerationTaskMessage(mockWorkspacePath, allRuleTypes, false, false)

			// Check all rule files are mentioned
			expect(message).toContain(".roo/rules/coding-standards.md")
			expect(message).toContain(".roo/rules-code/implementation-rules.md")
			expect(message).toContain(".roo/rules-architect/architecture-rules.md")
			expect(message).toContain(".roo/rules-debug/debugging-rules.md")
			expect(message).toContain(".roo/rules-docs-extractor/documentation-rules.md")
		})
	})

	describe("handleGenerateRules", () => {
		let mockProvider: ClineProvider
		let mockGetGlobalState: any
		let mockUpdateGlobalState: any
		let mockGetWorkspacePath: any

		beforeEach(async () => {
			// Mock provider
			mockProvider = {
				activateProviderProfile: vi.fn(),
				initClineWithTask: vi.fn(),
				postMessageToWebview: vi.fn(),
			} as any

			// Mock global state functions
			mockGetGlobalState = vi.fn()
			mockUpdateGlobalState = vi.fn()

			// Import and mock getWorkspacePath
			const pathModule = await import("../../../utils/path")
			mockGetWorkspacePath = vi.spyOn(pathModule, "getWorkspacePath")
			mockGetWorkspacePath.mockReturnValue(mockWorkspacePath)
		})

		it("should show error when no workspace is open", async () => {
			mockGetWorkspacePath.mockReturnValue(undefined)

			await handleGenerateRules(mockProvider, {}, mockGetGlobalState, mockUpdateGlobalState)

			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
				"No workspace folder open. Please open a folder to generate rules.",
			)
			expect(mockProvider.initClineWithTask).not.toHaveBeenCalled()
		})

		it("should switch API config when different from current", async () => {
			mockGetGlobalState.mockReturnValue("current-config")

			await handleGenerateRules(
				mockProvider,
				{ apiConfigName: "new-config" },
				mockGetGlobalState,
				mockUpdateGlobalState,
			)

			expect(mockUpdateGlobalState).toHaveBeenCalledWith("currentApiConfigName", "new-config")
			expect(mockProvider.activateProviderProfile).toHaveBeenCalledWith({ name: "new-config" })
		})

		it("should not switch API config when same as current", async () => {
			mockGetGlobalState.mockReturnValue("current-config")

			await handleGenerateRules(
				mockProvider,
				{ apiConfigName: "current-config" },
				mockGetGlobalState,
				mockUpdateGlobalState,
			)

			expect(mockUpdateGlobalState).not.toHaveBeenCalled()
			expect(mockProvider.activateProviderProfile).not.toHaveBeenCalled()
		})

		it("should create task and switch to chat tab", async () => {
			await handleGenerateRules(
				mockProvider,
				{ selectedRuleTypes: ["general"] },
				mockGetGlobalState,
				mockUpdateGlobalState,
			)

			expect(mockProvider.initClineWithTask).toHaveBeenCalled()
			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "action",
				action: "switchTab",
				tab: "chat",
			})
		})

		it("should pass all options to createRulesGenerationTaskMessage", async () => {
			const options = {
				selectedRuleTypes: ["general", "code"],
				addToGitignore: true,
				alwaysAllowWriteProtected: true,
				includeCustomRules: true,
				customRulesText: "Custom rules text",
			}

			await handleGenerateRules(mockProvider, options, mockGetGlobalState, mockUpdateGlobalState)

			// Verify the task was created with the correct message
			expect(mockProvider.initClineWithTask).toHaveBeenCalled()
			const taskMessage = vi.mocked(mockProvider.initClineWithTask).mock.calls[0][0]
			expect(taskMessage).toContain("Custom rules text")
		})

		it("should use default values when options are not provided", async () => {
			await handleGenerateRules(mockProvider, {}, mockGetGlobalState, mockUpdateGlobalState)

			expect(mockProvider.initClineWithTask).toHaveBeenCalled()
			// The default selectedRuleTypes should be ["general"]
			const taskMessage = vi.mocked(mockProvider.initClineWithTask).mock.calls[0][0]
			expect(taskMessage).toContain(".roo/rules/coding-standards.md")
		})
	})
})
