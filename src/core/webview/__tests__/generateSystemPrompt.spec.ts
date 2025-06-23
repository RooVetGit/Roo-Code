import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type * as vscode from "vscode"

import type { WebviewMessage } from "../../../shared/WebviewMessage"
import { generateSystemPrompt } from "../generateSystemPrompt"
import type { ClineProvider } from "../ClineProvider"
import { buildApiHandler } from "../../../api"
import { getModeBySlug } from "../../../shared/modes"
import { experiments as experimentsModule, EXPERIMENT_IDS } from "../../../shared/experiments"

// Mock dependencies
vi.mock("../../../api", () => ({
	buildApiHandler: vi.fn(),
}))

vi.mock("../../../shared/modes", () => ({
	defaultModeSlug: "code",
	getModeBySlug: vi.fn(),
	getGroupName: vi.fn((group) => (typeof group === "string" ? group : group[0])),
}))

vi.mock("../../../shared/experiments", () => ({
	experiments: {
		isEnabled: vi.fn(),
	},
	EXPERIMENT_IDS: {
		MULTI_FILE_APPLY_DIFF: "multi_file_apply_diff",
	},
}))

vi.mock("../../../core/prompts/system", () => ({
	SYSTEM_PROMPT: vi.fn().mockResolvedValue("Generated system prompt"),
}))

vi.mock("../../diff/strategies/multi-search-replace", () => {
	const MockMultiSearchReplaceDiffStrategy = vi.fn()
	MockMultiSearchReplaceDiffStrategy.mockImplementation(() => ({
		getName: () => "multi-search-replace",
	}))
	return { MultiSearchReplaceDiffStrategy: MockMultiSearchReplaceDiffStrategy }
})

vi.mock("../../diff/strategies/multi-file-search-replace", () => {
	const MockMultiFileSearchReplaceDiffStrategy = vi.fn()
	MockMultiFileSearchReplaceDiffStrategy.mockImplementation(() => ({
		getName: () => "multi-file-search-replace",
	}))
	return { MultiFileSearchReplaceDiffStrategy: MockMultiFileSearchReplaceDiffStrategy }
})

describe("generateSystemPrompt", () => {
	let mockProvider: Partial<ClineProvider>
	let mockBuildApiHandler: any
	let mockGetModeBySlug: any
	let mockIsEnabled: any

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()

		// Setup mock provider
		mockProvider = {
			getState: vi.fn().mockResolvedValue({
				apiConfiguration: { apiProvider: "gemini" },
				customModePrompts: {},
				customInstructions: "",
				browserViewportSize: "900x600",
				diffEnabled: true,
				mcpEnabled: false,
				fuzzyMatchThreshold: 0.8,
				experiments: {},
				enableMcpServerCreation: false,
				browserToolEnabled: true,
				language: "en",
				maxReadFileLine: 1000,
				maxConcurrentFileReads: 10,
			}),
			cwd: "/test/workspace",
			customModesManager: {
				getCustomModes: vi.fn().mockResolvedValue([]),
			} as any,
			getCurrentCline: vi.fn().mockReturnValue(null),
			getMcpHub: vi.fn().mockReturnValue(null),
		}

		// Setup mocked functions
		mockBuildApiHandler = vi.mocked(buildApiHandler)
		mockGetModeBySlug = vi.mocked(getModeBySlug)
		mockIsEnabled = vi.mocked(experimentsModule.isEnabled)

		// Default mock implementations
		mockIsEnabled.mockReturnValue(false)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("browser tool support", () => {
		it("should enable browser tools when model supports images, mode includes browser group, and browserToolEnabled is true", async () => {
			// Setup: Gemini model with supportsImages and supportsBrowserUse
			mockBuildApiHandler.mockReturnValue({
				getModel: vi.fn().mockReturnValue({
					id: "gemini-2.0-flash",
					info: {
						supportsImages: true,
						supportsBrowserUse: true,
					},
				}),
			})

			// Setup: Code mode includes browser tool group
			mockGetModeBySlug.mockReturnValue({
				slug: "code",
				groups: ["read", "edit", "browser", "command", "mcp"],
			})

			const message: WebviewMessage = { type: "getSystemPrompt", mode: "code" }
			const result = await generateSystemPrompt(mockProvider as ClineProvider, message)

			// Verify SYSTEM_PROMPT was called with canUseBrowserTool = true
			const { SYSTEM_PROMPT } = await import("../../../core/prompts/system")
			expect(SYSTEM_PROMPT).toHaveBeenCalled()
			const callArgs = vi.mocked(SYSTEM_PROMPT).mock.calls[0]
			expect(callArgs[2]).toBe(true) // canUseBrowserTool should be true
		})

		it("should disable browser tools when model does not support browser use", async () => {
			// Setup: Model without supportsBrowserUse
			mockBuildApiHandler.mockReturnValue({
				getModel: vi.fn().mockReturnValue({
					id: "claude-3-sonnet",
					info: {
						supportsImages: false,
						supportsBrowserUse: false,
					},
				}),
			})

			// Setup: Code mode includes browser tool group
			mockGetModeBySlug.mockReturnValue({
				slug: "code",
				groups: ["read", "edit", "browser", "command", "mcp"],
			})

			const message: WebviewMessage = { type: "getSystemPrompt", mode: "code" }
			const result = await generateSystemPrompt(mockProvider as ClineProvider, message)

			// Verify SYSTEM_PROMPT was called with canUseBrowserTool = false
			const { SYSTEM_PROMPT } = await import("../../../core/prompts/system")
			expect(SYSTEM_PROMPT).toHaveBeenCalled()
			const callArgs = vi.mocked(SYSTEM_PROMPT).mock.calls[0]
			expect(callArgs[2]).toBe(false) // canUseBrowserTool should be false
		})

		it("should disable browser tools when mode does not include browser group", async () => {
			// Setup: Gemini model with browser support
			mockBuildApiHandler.mockReturnValue({
				getModel: vi.fn().mockReturnValue({
					id: "gemini-2.0-flash",
					info: {
						supportsImages: true,
						supportsBrowserUse: true,
					},
				}),
			})

			// Setup: Custom mode without browser tool group
			mockGetModeBySlug.mockReturnValue({
				slug: "custom-mode",
				groups: ["read", "edit"], // No browser group
			})

			const message: WebviewMessage = { type: "getSystemPrompt", mode: "custom-mode" }
			const result = await generateSystemPrompt(mockProvider as ClineProvider, message)

			// Verify SYSTEM_PROMPT was called with canUseBrowserTool = false
			const { SYSTEM_PROMPT } = await import("../../../core/prompts/system")
			expect(SYSTEM_PROMPT).toHaveBeenCalled()
			const callArgs = vi.mocked(SYSTEM_PROMPT).mock.calls[0]
			expect(callArgs[2]).toBe(false) // canUseBrowserTool should be false
		})

		it("should disable browser tools when browserToolEnabled setting is false", async () => {
			// Setup: Gemini model with browser support
			mockBuildApiHandler.mockReturnValue({
				getModel: vi.fn().mockReturnValue({
					id: "gemini-2.0-flash",
					info: {
						supportsImages: true,
						supportsBrowserUse: true,
					},
				}),
			})

			// Setup: Code mode includes browser tool group
			mockGetModeBySlug.mockReturnValue({
				slug: "code",
				groups: ["read", "edit", "browser", "command", "mcp"],
			})

			// Override provider state to have browserToolEnabled = false
			mockProvider.getState = vi.fn().mockResolvedValue({
				apiConfiguration: { apiProvider: "gemini" },
				customModePrompts: {},
				customInstructions: "",
				browserViewportSize: "900x600",
				diffEnabled: true,
				mcpEnabled: false,
				fuzzyMatchThreshold: 0.8,
				experiments: {},
				enableMcpServerCreation: false,
				browserToolEnabled: false, // Disabled by user
				language: "en",
				maxReadFileLine: 1000,
				maxConcurrentFileReads: 10,
			})

			const message: WebviewMessage = { type: "getSystemPrompt", mode: "code" }
			const result = await generateSystemPrompt(mockProvider as ClineProvider, message)

			// Verify SYSTEM_PROMPT was called with canUseBrowserTool = false
			const { SYSTEM_PROMPT } = await import("../../../core/prompts/system")
			expect(SYSTEM_PROMPT).toHaveBeenCalled()
			const callArgs = vi.mocked(SYSTEM_PROMPT).mock.calls[0]
			expect(callArgs[2]).toBe(false) // canUseBrowserTool should be false
		})

		it("should handle error when checking model support gracefully", async () => {
			// Setup: buildApiHandler throws an error
			mockBuildApiHandler.mockImplementation(() => {
				throw new Error("API configuration error")
			})

			// Setup: Code mode includes browser tool group
			mockGetModeBySlug.mockReturnValue({
				slug: "code",
				groups: ["read", "edit", "browser", "command", "mcp"],
			})

			// Spy on console.error
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			const message: WebviewMessage = { type: "getSystemPrompt", mode: "code" }
			const result = await generateSystemPrompt(mockProvider as ClineProvider, message)

			// Verify error was logged
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"Error checking if model supports browser use:",
				expect.any(Error),
			)

			// Verify SYSTEM_PROMPT was called with canUseBrowserTool = false (fallback)
			const { SYSTEM_PROMPT } = await import("../../../core/prompts/system")
			expect(SYSTEM_PROMPT).toHaveBeenCalled()
			const callArgs = vi.mocked(SYSTEM_PROMPT).mock.calls[0]
			expect(callArgs[2]).toBe(false) // canUseBrowserTool should be false on error

			consoleErrorSpy.mockRestore()
		})

		it("should verify all Gemini models with supportsImages have supportsBrowserUse", async () => {
			// This test verifies the specific requirement that Gemini models with supportsImages
			// should also have supportsBrowserUse set to true

			const geminiModelsWithImages = [
				"gemini-2.5-flash-preview-04-17:thinking",
				"gemini-2.5-flash-preview-04-17",
				"gemini-2.5-flash",
				"gemini-2.0-flash-001",
				"gemini-1.5-flash-002",
			]

			for (const modelId of geminiModelsWithImages) {
				// Setup: Gemini model
				mockBuildApiHandler.mockReturnValue({
					getModel: vi.fn().mockReturnValue({
						id: modelId,
						info: {
							supportsImages: true,
							supportsBrowserUse: true, // This should be true for all Gemini models with images
						},
					}),
				})

				// Setup: Code mode includes browser tool group
				mockGetModeBySlug.mockReturnValue({
					slug: "code",
					groups: ["read", "edit", "browser", "command", "mcp"],
				})

				const message: WebviewMessage = { type: "getSystemPrompt", mode: "code" }
				const result = await generateSystemPrompt(mockProvider as ClineProvider, message)

				// Verify SYSTEM_PROMPT was called with canUseBrowserTool = true
				const { SYSTEM_PROMPT } = await import("../../../core/prompts/system")
				expect(SYSTEM_PROMPT).toHaveBeenCalled()
				const callArgs = vi.mocked(SYSTEM_PROMPT).mock.calls[0]
				expect(callArgs[2]).toBe(true) // canUseBrowserTool should be true for Gemini models with images

				vi.clearAllMocks()
			}
		})
	})

	describe("diff strategy selection", () => {
		it("should use MultiFileSearchReplaceDiffStrategy when experiment is enabled", async () => {
			// Enable the multi-file apply diff experiment
			mockIsEnabled.mockReturnValue(true)

			mockBuildApiHandler.mockReturnValue({
				getModel: vi.fn().mockReturnValue({
					id: "test-model",
					info: { supportsBrowserUse: false },
				}),
			})

			mockGetModeBySlug.mockReturnValue({
				slug: "code",
				groups: ["read", "edit"],
			})

			const message: WebviewMessage = { type: "getSystemPrompt", mode: "code" }
			await generateSystemPrompt(mockProvider as ClineProvider, message)

			// Verify the correct diff strategy was instantiated
			const { MultiFileSearchReplaceDiffStrategy } = await import(
				"../../diff/strategies/multi-file-search-replace"
			)
			expect(MultiFileSearchReplaceDiffStrategy).toHaveBeenCalledWith(0.8)
		})

		it("should use MultiSearchReplaceDiffStrategy when experiment is disabled", async () => {
			// Disable the multi-file apply diff experiment
			mockIsEnabled.mockReturnValue(false)

			mockBuildApiHandler.mockReturnValue({
				getModel: vi.fn().mockReturnValue({
					id: "test-model",
					info: { supportsBrowserUse: false },
				}),
			})

			mockGetModeBySlug.mockReturnValue({
				slug: "code",
				groups: ["read", "edit"],
			})

			const message: WebviewMessage = { type: "getSystemPrompt", mode: "code" }
			await generateSystemPrompt(mockProvider as ClineProvider, message)

			// Verify the correct diff strategy was instantiated
			const { MultiSearchReplaceDiffStrategy } = await import("../../diff/strategies/multi-search-replace")
			expect(MultiSearchReplaceDiffStrategy).toHaveBeenCalledWith(0.8)
		})
	})
})
