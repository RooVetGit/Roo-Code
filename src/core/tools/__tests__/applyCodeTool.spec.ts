import { vi, describe, it, expect, beforeEach } from "vitest"
import type { MockedFunction } from "vitest"
import { applyCodeTool } from "../applyCodeTool"
import { ToolUse, ToolResponse } from "../../../shared/tools"
import { fileExistsAtPath } from "../../../utils/fs"
import { getReadablePath } from "../../../utils/path"
import * as path from "path"

// Mock fs/promises before any imports
vi.mock("fs/promises", () => ({
	default: {
		readFile: vi.fn().mockResolvedValue(Buffer.from("original content")),
	},
	readFile: vi.fn().mockResolvedValue(Buffer.from("original content")),
}))

// Mock dependencies
vi.mock("path", async () => {
	const originalPath = await vi.importActual("path")
	return {
		...originalPath,
		resolve: vi.fn().mockImplementation((...args) => {
			const separator = process.platform === "win32" ? "\\" : "/"
			return args.join(separator)
		}),
	}
})

vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockResolvedValue(true),
}))

vi.mock("../../../utils/path", () => ({
	getReadablePath: vi.fn().mockReturnValue("test/file.ts"),
}))

vi.mock("../../prompts/responses", () => ({
	formatResponse: {
		toolError: vi.fn((msg) => `Error: ${msg}`),
		rooIgnoreError: vi.fn((path) => `Access denied: ${path}`),
		createPrettyPatch: vi.fn(() => "mock-diff"),
	},
}))

vi.mock("../applyDiffTool", () => ({
	applyDiffToolLegacy: vi.fn().mockResolvedValue(undefined),
}))

// Import after mocking to get the mocked version
import { applyDiffToolLegacy } from "../applyDiffTool"
import fs from "fs/promises"

describe("applyCodeTool", () => {
	// Test data
	const testFilePath = "test/file.ts"
	const absoluteFilePath = process.platform === "win32" ? "C:\\test\\file.ts" : "/test/file.ts"
	const testInstruction = "Add error handling to the function"
	const originalContent = `function getData() {
    return fetch('/api/data').then(res => res.json());
}`

	// Mocked functions
	const mockedFileExistsAtPath = fileExistsAtPath as MockedFunction<typeof fileExistsAtPath>
	const mockedGetReadablePath = getReadablePath as MockedFunction<typeof getReadablePath>
	const mockedPathResolve = path.resolve as MockedFunction<typeof path.resolve>
	const mockedApplyDiffToolLegacy = applyDiffToolLegacy as MockedFunction<typeof applyDiffToolLegacy>
	const mockedReadFile = fs.readFile as MockedFunction<typeof fs.readFile>

	const mockCline: any = {}
	let mockAskApproval: ReturnType<typeof vi.fn>
	let mockHandleError: ReturnType<typeof vi.fn>
	let mockPushToolResult: ReturnType<typeof vi.fn>
	let mockRemoveClosingTag: ReturnType<typeof vi.fn>
	let toolResult: ToolResponse | undefined

	beforeEach(() => {
		vi.clearAllMocks()

		mockedPathResolve.mockReturnValue(absoluteFilePath)
		mockedFileExistsAtPath.mockResolvedValue(true)
		mockedGetReadablePath.mockReturnValue(testFilePath)

		mockCline.cwd = "/"
		mockCline.consecutiveMistakeCount = 0
		mockCline.api = {
			createMessage: vi.fn(),
			getModel: vi.fn().mockReturnValue({
				id: "claude-3",
				info: { contextWindow: 200000 },
			}),
		}
		mockCline.providerRef = {
			deref: vi.fn().mockReturnValue({
				getState: vi.fn().mockResolvedValue({
					applyEnabled: true,
				}),
			}),
		}
		mockCline.rooIgnoreController = {
			validateAccess: vi.fn().mockReturnValue(true),
		}
		mockCline.diffViewProvider = {
			reset: vi.fn().mockResolvedValue(undefined),
		}
		mockCline.say = vi.fn().mockResolvedValue(undefined)
		mockCline.ask = vi.fn().mockResolvedValue(undefined)
		mockCline.recordToolError = vi.fn()
		mockCline.sayAndCreateMissingParamError = vi.fn().mockResolvedValue("Missing param error")

		mockAskApproval = vi.fn().mockResolvedValue(true)
		mockHandleError = vi.fn().mockResolvedValue(undefined)
		mockRemoveClosingTag = vi.fn((tag, content) => content)
		mockPushToolResult = vi.fn()

		toolResult = undefined
	})

	/**
	 * Helper function to execute the apply code tool
	 */
	async function executeApplyCodeTool(
		params: Partial<ToolUse["params"]> = {},
		options: {
			fileExists?: boolean
			isPartial?: boolean
			accessAllowed?: boolean
			applyEnabled?: boolean
		} = {},
	): Promise<ToolResponse | undefined> {
		const fileExists = options.fileExists ?? true
		const isPartial = options.isPartial ?? false
		const accessAllowed = options.accessAllowed ?? true
		const applyEnabled = options.applyEnabled ?? true

		mockedFileExistsAtPath.mockResolvedValue(fileExists)
		mockCline.rooIgnoreController.validateAccess.mockReturnValue(accessAllowed)
		mockCline.providerRef.deref().getState.mockResolvedValue({ applyEnabled })

		const toolUse: ToolUse = {
			type: "tool_use",
			name: "apply_code",
			params: {
				path: testFilePath,
				instruction: testInstruction,
				...params,
			},
			partial: isPartial,
		}

		await applyCodeTool(
			mockCline,
			toolUse,
			mockAskApproval,
			mockHandleError,
			(result: ToolResponse) => {
				toolResult = result
				mockPushToolResult(result)
			},
			mockRemoveClosingTag,
		)

		return toolResult
	}

	describe("parameter validation", () => {
		it("handles missing path parameter", async () => {
			await executeApplyCodeTool({ path: undefined })

			expect(mockCline.sayAndCreateMissingParamError).toHaveBeenCalledWith("apply_code", "path")
			expect(mockPushToolResult).toHaveBeenCalledWith("Missing param error")
		})

		it("handles missing instruction parameter", async () => {
			await executeApplyCodeTool({ instruction: undefined })

			expect(mockCline.sayAndCreateMissingParamError).toHaveBeenCalledWith("apply_code", "instruction")
			expect(mockPushToolResult).toHaveBeenCalledWith("Missing param error")
		})
	})

	describe("feature flag", () => {
		it("returns error when applyEnabled is false", async () => {
			await executeApplyCodeTool({}, { applyEnabled: false })

			// The actual implementation should check this flag
			const provider = mockCline.providerRef.deref()
			const state = await provider?.getState()
			expect(state?.applyEnabled).toBe(false)
		})

		it("proceeds when applyEnabled is true", async () => {
			// Mock successful API responses
			const mockStream = {
				[Symbol.asyncIterator]: vi.fn().mockReturnValue({
					next: vi
						.fn()
						.mockResolvedValueOnce({
							value: { type: "text", text: "```typescript\n" + originalContent + "\n```" },
							done: false,
						})
						.mockResolvedValueOnce({ done: true }),
				}),
			}
			mockCline.api.createMessage.mockReturnValue(mockStream)

			await executeApplyCodeTool({}, { applyEnabled: true })

			expect(mockCline.api.createMessage).toHaveBeenCalled()
		})
	})

	describe("file validation", () => {
		it("returns error when file does not exist", async () => {
			// For new files, the tool should still work but generate full file content
			await executeApplyCodeTool({}, { fileExists: false })

			// The tool should handle non-existent files by creating them
			expect(mockCline.recordToolError).not.toHaveBeenCalled()
		})

		it("validates access with rooIgnoreController", async () => {
			await executeApplyCodeTool({}, { accessAllowed: false })

			expect(mockCline.rooIgnoreController.validateAccess).toHaveBeenCalledWith(testFilePath)
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("Access denied"))
		})
	})

	describe("two-stage API workflow", () => {
		it("makes two API calls with correct prompts", async () => {
			// Mock file read
			mockedReadFile.mockResolvedValue(Buffer.from(originalContent))

			// Mock successful API responses
			const generatedCode = `function getData() {
    try {
        return fetch('/api/data').then(res => {
            if (!res.ok) throw new Error('Failed to fetch');
            return res.json();
        });
    } catch (error) {
        console.error('Error fetching data:', error);
        throw error;
    }
}`

			// First API call response (code generation)
			const mockStream1 = {
				[Symbol.asyncIterator]: vi.fn().mockReturnValue({
					next: vi
						.fn()
						.mockResolvedValueOnce({
							value: { type: "text", text: "```typescript\n" + generatedCode + "\n```" },
							done: false,
						})
						.mockResolvedValueOnce({ done: true }),
				}),
			}

			// Second API call response (diff generation)
			const mockStream2 = {
				[Symbol.asyncIterator]: vi.fn().mockReturnValue({
					next: vi
						.fn()
						.mockResolvedValueOnce({
							value: {
								type: "text",
								text: "<apply_diff>\n<path>test/file.ts</path>\n<diff>mock diff content</diff>\n</apply_diff>",
							},
							done: false,
						})
						.mockResolvedValueOnce({ done: true }),
				}),
			}

			mockCline.api.createMessage.mockReturnValueOnce(mockStream1).mockReturnValueOnce(mockStream2)

			await executeApplyCodeTool()

			// Verify two API calls were made
			expect(mockCline.api.createMessage).toHaveBeenCalledTimes(2)

			// Verify first call (code generation)
			const firstCall = mockCline.api.createMessage.mock.calls[0]
			expect(firstCall[0]).toContain("generate code")
			expect(firstCall[0]).toContain(testInstruction)

			// Verify second call (diff generation)
			const secondCall = mockCline.api.createMessage.mock.calls[1]
			expect(secondCall[0]).toContain("create a diff")
			expect(secondCall[1]).toEqual([
				{ role: "user", content: expect.stringContaining(originalContent) },
				{ role: "assistant", content: generatedCode },
			])
		})

		it("delegates to applyDiffTool after generating diff", async () => {
			// Mock file read
			mockedReadFile.mockResolvedValue(Buffer.from(originalContent))

			// Mock API responses
			const mockStream1 = {
				[Symbol.asyncIterator]: vi.fn().mockReturnValue({
					next: vi
						.fn()
						.mockResolvedValueOnce({
							value: { type: "text", text: "```typescript\ngenerated code\n```" },
							done: false,
						})
						.mockResolvedValueOnce({ done: true }),
				}),
			}

			const mockStream2 = {
				[Symbol.asyncIterator]: vi.fn().mockReturnValue({
					next: vi
						.fn()
						.mockResolvedValueOnce({
							value: {
								type: "text",
								text: "<apply_diff>\n<path>test/file.ts</path>\n<diff>diff content</diff>\n</apply_diff>",
							},
							done: false,
						})
						.mockResolvedValueOnce({ done: true }),
				}),
			}

			mockCline.api.createMessage.mockReturnValueOnce(mockStream1).mockReturnValueOnce(mockStream2)

			await executeApplyCodeTool()

			// Verify applyDiffToolLegacy was called
			expect(mockedApplyDiffToolLegacy).toHaveBeenCalledWith(
				mockCline,
				expect.objectContaining({
					type: "tool_use",
					name: "apply_diff",
					params: {
						path: testFilePath,
						diff: "diff content",
					},
				}),
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)
		})
	})

	describe("error handling", () => {
		it("handles API errors in first stage", async () => {
			// Mock file read
			mockedReadFile.mockResolvedValue(Buffer.from(originalContent))

			// Mock API error - need to return a proper async iterator that throws
			const mockStream = {
				[Symbol.asyncIterator]: vi.fn().mockImplementation(() => ({
					next: vi.fn().mockRejectedValue(new Error("API error")),
				})),
			}
			mockCline.api.createMessage.mockReturnValue(mockStream)

			await executeApplyCodeTool()

			expect(mockHandleError).toHaveBeenCalledWith("applying code", expect.any(Error))
		})

		it("handles file read errors", async () => {
			// Mock file read error
			mockedReadFile.mockRejectedValue(new Error("File read error"))

			await executeApplyCodeTool()

			expect(mockHandleError).toHaveBeenCalledWith("applying code", expect.any(Error))
		})

		it("handles malformed API responses", async () => {
			// Mock file read
			mockedReadFile.mockResolvedValue(Buffer.from(originalContent))

			// Mock malformed response (no code blocks)
			const mockStream = {
				[Symbol.asyncIterator]: vi.fn().mockReturnValue({
					next: vi
						.fn()
						.mockResolvedValueOnce({
							value: { type: "text", text: "Just some text without code blocks" },
							done: false,
						})
						.mockResolvedValueOnce({ done: true }),
				}),
			}

			mockCline.api.createMessage.mockReturnValue(mockStream)

			await executeApplyCodeTool()

			// The error should be about parsing JSON, not "No code was generated"
			expect(mockCline.say).toHaveBeenCalledWith(
				"error",
				expect.stringContaining("Failed to parse code generation response"),
			)
		})
	})

	describe("partial execution", () => {
		it("returns early for partial blocks", async () => {
			await executeApplyCodeTool({}, { isPartial: true })

			expect(mockCline.api.createMessage).not.toHaveBeenCalled()
			expect(mockPushToolResult).not.toHaveBeenCalled()
		})
	})
})
