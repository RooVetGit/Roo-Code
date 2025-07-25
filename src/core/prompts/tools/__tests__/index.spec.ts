import { describe, it, expect, vi, beforeEach } from "vitest"
import { getToolDescriptionsForMode } from "../index"
import { CodeIndexManager } from "../../../../services/code-index/manager"

// Mock dependencies
vi.mock("../../../../services/code-index/manager")
vi.mock("../../../../services/mcp/McpHub")
vi.mock("../../../config/ContextProxy", () => ({
	ContextProxy: {
		instance: {
			getSettings: vi.fn(() => ({ todoListEnabled: true })),
		},
	},
}))

describe("getToolDescriptionsForMode", () => {
	let mockCodeIndexManager: any

	beforeEach(() => {
		vi.clearAllMocks()

		// Setup mock CodeIndexManager
		mockCodeIndexManager = {
			isFeatureEnabled: true,
			isFeatureConfigured: true,
			isInitialized: true,
			state: "Indexed",
		}

		vi.mocked(CodeIndexManager).getInstance = vi.fn((_context: any) => mockCodeIndexManager as any)
	})

	describe("codebase_search tool availability", () => {
		it("should include codebase_search when feature is enabled, configured, and indexing is complete", () => {
			mockCodeIndexManager.isFeatureEnabled = true
			mockCodeIndexManager.isFeatureConfigured = true
			mockCodeIndexManager.state = "Indexed"

			const result = getToolDescriptionsForMode(
				"code",
				"/test/path",
				false,
				mockCodeIndexManager,
				undefined,
				undefined,
				undefined,
				[],
				{},
				false,
				{ todoListEnabled: true },
			)

			expect(result).toContain("codebase_search")
			expect(result).toContain("Find files most relevant to the search query")
		})

		it("should exclude codebase_search when feature is disabled", () => {
			mockCodeIndexManager.isFeatureEnabled = false
			mockCodeIndexManager.isFeatureConfigured = true
			mockCodeIndexManager.state = "Indexed"

			const result = getToolDescriptionsForMode(
				"code",
				"/test/path",
				false,
				mockCodeIndexManager,
				undefined,
				undefined,
				undefined,
				[],
				{},
				false,
				{ todoListEnabled: true },
			)

			expect(result).not.toContain("codebase_search")
		})

		it("should exclude codebase_search when feature is not configured", () => {
			mockCodeIndexManager.isFeatureEnabled = true
			mockCodeIndexManager.isFeatureConfigured = false
			mockCodeIndexManager.state = "Indexed"

			const result = getToolDescriptionsForMode(
				"code",
				"/test/path",
				false,
				mockCodeIndexManager,
				undefined,
				undefined,
				undefined,
				[],
				{},
				false,
				{ todoListEnabled: true },
			)

			expect(result).not.toContain("codebase_search")
		})

		it("should exclude codebase_search when indexing is in Standby state", () => {
			mockCodeIndexManager.isFeatureEnabled = true
			mockCodeIndexManager.isFeatureConfigured = true
			mockCodeIndexManager.state = "Standby"

			const result = getToolDescriptionsForMode(
				"code",
				"/test/path",
				false,
				mockCodeIndexManager,
				undefined,
				undefined,
				undefined,
				[],
				{},
				false,
				{ todoListEnabled: true },
			)

			expect(result).not.toContain("codebase_search")
		})

		it("should exclude codebase_search when indexing is in progress", () => {
			mockCodeIndexManager.isFeatureEnabled = true
			mockCodeIndexManager.isFeatureConfigured = true
			mockCodeIndexManager.state = "Indexing"

			const result = getToolDescriptionsForMode(
				"code",
				"/test/path",
				false,
				mockCodeIndexManager,
				undefined,
				undefined,
				undefined,
				[],
				{},
				false,
				{ todoListEnabled: true },
			)

			expect(result).not.toContain("codebase_search")
		})

		it("should exclude codebase_search when indexing is in Error state", () => {
			mockCodeIndexManager.isFeatureEnabled = true
			mockCodeIndexManager.isFeatureConfigured = true
			mockCodeIndexManager.state = "Error"

			const result = getToolDescriptionsForMode(
				"code",
				"/test/path",
				false,
				mockCodeIndexManager,
				undefined,
				undefined,
				undefined,
				[],
				{},
				false,
				{ todoListEnabled: true },
			)

			expect(result).not.toContain("codebase_search")
		})

		it("should exclude codebase_search when codeIndexManager is undefined", () => {
			const result = getToolDescriptionsForMode(
				"code",
				"/test/path",
				false,
				undefined,
				undefined,
				undefined,
				undefined,
				[],
				{},
				false,
				{ todoListEnabled: true },
			)

			expect(result).not.toContain("codebase_search")
		})
	})
})
