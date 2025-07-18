// npx vitest src/core/tools/__tests__/codebaseSearchTool.spec.ts

import { describe, it, expect, vi, beforeEach } from "vitest"
import * as path from "path"
import { codebaseSearchTool } from "../codebaseSearchTool"
import { Task } from "../../task/Task"
import { CodeIndexManager } from "../../../services/code-index/manager"
import { ToolUse } from "../../../shared/tools"
import { formatResponse } from "../../prompts/responses"

// Mock vscode
vi.mock("vscode", () => ({
	workspace: {
		asRelativePath: vi.fn().mockImplementation((filePath) => {
			// Simple mock that just returns the path without workspace prefix
			return filePath.replace("/test/workspace/", "")
		}),
	},
}))

// Mock dependencies
vi.mock("../../../utils/path", () => ({
	getWorkspacePath: vi.fn().mockReturnValue("/test/workspace"),
}))

vi.mock("../../../services/code-index/manager")

vi.mock("../../prompts/responses", () => ({
	formatResponse: {
		toolDenied: vi.fn().mockReturnValue("Tool denied"),
	},
}))

describe("codebaseSearchTool", () => {
	let mockCline: Task
	let mockAskApproval: any
	let mockHandleError: any
	let mockPushToolResult: any
	let mockRemoveClosingTag: any
	let mockCodeIndexManager: any

	beforeEach(() => {
		vi.clearAllMocks()

		// Mock Cline/Task
		mockCline = {
			ask: vi.fn().mockResolvedValue(undefined),
			sayAndCreateMissingParamError: vi.fn().mockResolvedValue("Missing parameter error"),
			say: vi.fn().mockResolvedValue(undefined),
			consecutiveMistakeCount: 0,
			providerRef: {
				deref: vi.fn().mockReturnValue({
					context: {},
				}),
			},
		} as any

		// Mock callback functions
		mockAskApproval = vi.fn().mockResolvedValue(true)
		mockHandleError = vi.fn().mockResolvedValue(undefined)
		mockPushToolResult = vi.fn()
		mockRemoveClosingTag = vi.fn().mockImplementation((tag, value) => value)

		// Mock CodeIndexManager instance
		mockCodeIndexManager = {
			isFeatureEnabled: true,
			isFeatureConfigured: true,
			state: "Indexed",
			searchIndex: vi.fn().mockResolvedValue([
				{
					score: 0.9,
					payload: {
						filePath: "/test/workspace/src/example.ts",
						startLine: 10,
						endLine: 20,
						codeChunk: "function example() { return 'test'; }",
					},
				},
			]),
		}

		// Mock CodeIndexManager.getInstance
		vi.mocked(CodeIndexManager).getInstance = vi.fn().mockReturnValue(mockCodeIndexManager)
	})

	describe("indexing state checks", () => {
		it("should throw error when indexing state is 'Indexing'", async () => {
			// Arrange
			mockCodeIndexManager.state = "Indexing"
			const block: ToolUse = {
				type: "tool_use",
				name: "codebase_search",
				params: {
					query: "test query",
				},
				partial: false,
			}

			// Act
			await codebaseSearchTool(
				mockCline,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Assert
			expect(mockHandleError).toHaveBeenCalledWith(
				"codebase_search",
				expect.objectContaining({
					message: expect.stringContaining("Semantic search isn't ready yet (currently Indexing)"),
				}),
			)
		})

		it("should throw error when indexing state is 'Standby'", async () => {
			// Arrange
			mockCodeIndexManager.state = "Standby"
			const block: ToolUse = {
				type: "tool_use",
				name: "codebase_search",
				params: {
					query: "test query",
				},
				partial: false,
			}

			// Act
			await codebaseSearchTool(
				mockCline,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Assert
			expect(mockHandleError).toHaveBeenCalledWith(
				"codebase_search",
				expect.objectContaining({
					message: expect.stringContaining("Semantic search isn't ready yet (currently Standby)"),
				}),
			)
		})

		it("should throw error when indexing state is 'Error'", async () => {
			// Arrange
			mockCodeIndexManager.state = "Error"
			const block: ToolUse = {
				type: "tool_use",
				name: "codebase_search",
				params: {
					query: "test query",
				},
				partial: false,
			}

			// Act
			await codebaseSearchTool(
				mockCline,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Assert
			expect(mockHandleError).toHaveBeenCalledWith(
				"codebase_search",
				expect.objectContaining({
					message: expect.stringContaining("Semantic search isn't ready yet (currently Error)"),
				}),
			)
		})

		it("should proceed with search when indexing state is 'Indexed'", async () => {
			// Arrange
			mockCodeIndexManager.state = "Indexed"
			const block: ToolUse = {
				type: "tool_use",
				name: "codebase_search",
				params: {
					query: "test query",
				},
				partial: false,
			}

			// Act
			await codebaseSearchTool(
				mockCline,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Assert
			expect(mockHandleError).not.toHaveBeenCalled()
			expect(mockCodeIndexManager.searchIndex).toHaveBeenCalledWith("test query", undefined)
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("test query"))
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("example.ts"))
		})
	})

	describe("feature availability checks", () => {
		it("should throw error when feature is disabled", async () => {
			// Arrange
			mockCodeIndexManager.isFeatureEnabled = false
			const block: ToolUse = {
				type: "tool_use",
				name: "codebase_search",
				params: {
					query: "test query",
				},
				partial: false,
			}

			// Act
			await codebaseSearchTool(
				mockCline,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Assert
			expect(mockHandleError).toHaveBeenCalledWith(
				"codebase_search",
				expect.objectContaining({
					message: "Code Indexing is disabled in the settings.",
				}),
			)
		})

		it("should throw error when feature is not configured", async () => {
			// Arrange
			mockCodeIndexManager.isFeatureConfigured = false
			const block: ToolUse = {
				type: "tool_use",
				name: "codebase_search",
				params: {
					query: "test query",
				},
				partial: false,
			}

			// Act
			await codebaseSearchTool(
				mockCline,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Assert
			expect(mockHandleError).toHaveBeenCalledWith(
				"codebase_search",
				expect.objectContaining({
					message: "Code Indexing is not configured (Missing OpenAI Key or Qdrant URL).",
				}),
			)
		})
	})

	describe("parameter validation", () => {
		it("should handle missing query parameter", async () => {
			// Arrange
			const block: ToolUse = {
				type: "tool_use",
				name: "codebase_search",
				params: {},
				partial: false,
			}

			// Act
			await codebaseSearchTool(
				mockCline,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Assert
			expect(mockCline.sayAndCreateMissingParamError).toHaveBeenCalledWith("codebase_search", "query")
			expect(mockPushToolResult).toHaveBeenCalledWith("Missing parameter error")
		})

		it("should handle user denial", async () => {
			// Arrange
			mockAskApproval.mockResolvedValue(false)
			const block: ToolUse = {
				type: "tool_use",
				name: "codebase_search",
				params: {
					query: "test query",
				},
				partial: false,
			}

			// Act
			await codebaseSearchTool(
				mockCline,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Assert
			expect(mockPushToolResult).toHaveBeenCalledWith("Tool denied")
			expect(mockCodeIndexManager.searchIndex).not.toHaveBeenCalled()
		})
	})

	describe("search results handling", () => {
		it("should handle empty search results", async () => {
			// Arrange
			mockCodeIndexManager.searchIndex.mockResolvedValue([])
			const block: ToolUse = {
				type: "tool_use",
				name: "codebase_search",
				params: {
					query: "nonexistent query",
				},
				partial: false,
			}

			// Act
			await codebaseSearchTool(
				mockCline,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Assert
			expect(mockPushToolResult).toHaveBeenCalledWith(
				'No relevant code snippets found for the query: "nonexistent query"',
			)
		})

		it("should handle search with directory prefix", async () => {
			// Arrange
			const block: ToolUse = {
				type: "tool_use",
				name: "codebase_search",
				params: {
					query: "test query",
					path: "src/components",
				},
				partial: false,
			}

			// Act
			await codebaseSearchTool(
				mockCline,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Assert
			// The path gets normalized in the tool, so we need to check for the normalized version
			expect(mockCodeIndexManager.searchIndex).toHaveBeenCalledWith(
				"test query",
				path.normalize("src/components"),
			)
		})
	})
})
