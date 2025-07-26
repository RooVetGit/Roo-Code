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
		readFile: vi.fn(),
	},
	readFile: vi.fn(),
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

vi.mock("../../../api", () => ({
	buildApiHandler: vi.fn().mockReturnValue({
		createMessage: vi.fn(),
		getModel: vi.fn().mockReturnValue({
			id: "claude-3",
			info: { contextWindow: 200000 },
		}),
	}),
}))

// Import after mocking to get the mocked version
import fs from "fs/promises"
import { buildApiHandler } from "../../../api"

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
	const mockedReadFile = fs.readFile as MockedFunction<typeof fs.readFile>
	const mockedBuildApiHandler = buildApiHandler as MockedFunction<typeof buildApiHandler>

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
		mockCline.taskId = "test-task-id"
		mockCline.apiConfiguration = { apiProvider: "anthropic", apiKey: "test-key" }
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
					diagnosticsEnabled: true,
					writeDelayMs: 0,
				}),
			}),
		}
		mockCline.rooIgnoreController = {
			validateAccess: vi.fn().mockReturnValue(true),
		}
		mockCline.rooProtectedController = {
			isWriteProtected: vi.fn().mockReturnValue(false),
		}
		mockCline.diffStrategy = {
			applyDiff: vi.fn().mockResolvedValue({
				success: true,
				content: "modified content",
			}),
		}
		mockCline.diffViewProvider = {
			reset: vi.fn().mockResolvedValue(undefined),
			editType: undefined,
			open: vi.fn().mockResolvedValue(undefined),
			update: vi.fn().mockResolvedValue(undefined),
			scrollToFirstDiff: vi.fn(),
			revertChanges: vi.fn().mockResolvedValue(undefined),
			saveChanges: vi.fn().mockResolvedValue(undefined),
			pushToolWriteResult: vi.fn().mockResolvedValue("File updated successfully"),
		}
		mockCline.fileContextTracker = {
			trackFileContext: vi.fn().mockResolvedValue(undefined),
		}
		mockCline.say = vi.fn().mockResolvedValue(undefined)
		mockCline.ask = vi.fn().mockResolvedValue(undefined)
		mockCline.recordToolError = vi.fn()
		mockCline.recordToolUsage = vi.fn()
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

	describe("file validation", () => {
		it("validates access with rooIgnoreController", async () => {
			await executeApplyCodeTool({}, { accessAllowed: false })

			expect(mockCline.rooIgnoreController.validateAccess).toHaveBeenCalledWith(testFilePath)
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("Access denied"))
		})
	})

	describe("two-stage API workflow", () => {
		it("makes two API calls with correct prompts and isolated context", async () => {
			// Mock file read
			mockedReadFile.mockResolvedValue(originalContent)

			// Mock successful API responses
			const generatedCode = `try {
    return fetch('/api/data').then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
    });
} catch (error) {
    console.error('Error fetching data:', error);
    throw error;
}`

			// First API call response (code generation) - returns JSON
			const mockStream1 = {
				[Symbol.asyncIterator]: vi.fn().mockReturnValue({
					next: vi
						.fn()
						.mockResolvedValueOnce({
							value: {
								type: "text",
								text: JSON.stringify({
									file: testFilePath,
									type: "snippet",
									code: generatedCode,
								}),
							},
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
								text: `<<<<<<< SEARCH
function getData() {
    return fetch('/api/data').then(res => res.json());
}
=======
function getData() {
    try {
        return fetch('/api/data').then(res => {
            if (!res.ok) throw new Error('Failed to fetch');
            return res.json();
        });
    } catch (error) {
        console.error('Error fetching data:', error);
        throw error;
    }
}
>>>>>>> REPLACE`,
							},
							done: false,
						})
						.mockResolvedValueOnce({ done: true }),
				}),
			}

			// Mock the isolated API handler
			const mockIsolatedApiHandler = {
				createMessage: vi.fn().mockReturnValue(mockStream2),
				getModel: vi.fn().mockReturnValue({
					id: "claude-3",
					info: { contextWindow: 200000 },
				}),
				countTokens: vi.fn().mockResolvedValue(100),
			}

			mockCline.api.createMessage.mockReturnValueOnce(mockStream1)
			mockedBuildApiHandler.mockReturnValue(mockIsolatedApiHandler)

			await executeApplyCodeTool()

			// Verify first API call (code generation) uses main API
			expect(mockCline.api.createMessage).toHaveBeenCalledTimes(1)
			const firstCall = mockCline.api.createMessage.mock.calls[0]
			expect(firstCall[0]).toContain("code generation expert")
			expect(firstCall[1][0].content[0].text).toContain(testInstruction)

			// Verify second API call uses isolated handler
			expect(mockedBuildApiHandler).toHaveBeenCalledWith(mockCline.apiConfiguration)
			expect(mockIsolatedApiHandler.createMessage).toHaveBeenCalledTimes(1)

			// Verify the isolated call has the hardcoded system prompt
			const secondCall = mockIsolatedApiHandler.createMessage.mock.calls[0]
			expect(secondCall[0]).toContain("specialized diff generation model")
			expect(secondCall[0]).toContain("Your ONLY task is to generate accurate diff patches")

			// Verify the isolated call has clean context (no conversation history)
			expect(secondCall[1]).toHaveLength(1)
			expect(secondCall[1][0].role).toBe("user")
			expect(secondCall[1][0].content[0].text).toContain("Original file content:")
			expect(secondCall[1][0].content[0].text).toContain("New code to integrate:")
		})

		it("applies the generated diff using diffStrategy", async () => {
			// Mock file read
			mockedReadFile.mockResolvedValue(originalContent)

			// Mock API responses
			const mockStream1 = {
				[Symbol.asyncIterator]: vi.fn().mockReturnValue({
					next: vi
						.fn()
						.mockResolvedValueOnce({
							value: {
								type: "text",
								text: JSON.stringify({
									file: testFilePath,
									type: "snippet",
									code: "generated code",
								}),
							},
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
								text: "<<<<<<< SEARCH\noriginal\n=======\nmodified\n>>>>>>> REPLACE",
							},
							done: false,
						})
						.mockResolvedValueOnce({ done: true }),
				}),
			}

			const mockIsolatedApiHandler = {
				createMessage: vi.fn().mockReturnValue(mockStream2),
				getModel: vi.fn().mockReturnValue({
					id: "claude-3",
					info: { contextWindow: 200000 },
				}),
				countTokens: vi.fn().mockResolvedValue(100),
			}

			mockCline.api.createMessage.mockReturnValueOnce(mockStream1)
			mockedBuildApiHandler.mockReturnValue(mockIsolatedApiHandler)

			await executeApplyCodeTool()

			// Verify diffStrategy.applyDiff was called with the generated diff
			expect(mockCline.diffStrategy.applyDiff).toHaveBeenCalledWith(
				originalContent,
				"<<<<<<< SEARCH\noriginal\n=======\nmodified\n>>>>>>> REPLACE",
			)

			// Verify the diff view was updated
			expect(mockCline.diffViewProvider.update).toHaveBeenCalledWith("modified content", true)
			expect(mockPushToolResult).toHaveBeenCalledWith("File updated successfully")
		})

		it("handles new file creation", async () => {
			// Mock file doesn't exist
			mockedFileExistsAtPath.mockResolvedValue(false)

			// Mock API response for new file
			const newFileContent = `export function newFunction() {
    return "Hello, World!";
}`

			const mockStream = {
				[Symbol.asyncIterator]: vi.fn().mockReturnValue({
					next: vi
						.fn()
						.mockResolvedValueOnce({
							value: {
								type: "text",
								text: JSON.stringify({
									file: testFilePath,
									type: "full_file",
									code: newFileContent,
								}),
							},
							done: false,
						})
						.mockResolvedValueOnce({ done: true }),
				}),
			}

			mockCline.api.createMessage.mockReturnValue(mockStream)

			await executeApplyCodeTool({}, { fileExists: false })

			// Verify only one API call was made (no diff generation for new files)
			expect(mockCline.api.createMessage).toHaveBeenCalledTimes(1)
			expect(mockedBuildApiHandler).not.toHaveBeenCalled()

			// Verify the file was created
			expect(mockCline.diffViewProvider.editType).toBe("create")
			expect(mockCline.diffViewProvider.update).toHaveBeenCalledWith(newFileContent, true)
		})
	})

	describe("error handling", () => {
		it("handles API errors in first stage", async () => {
			// Mock file read
			mockedReadFile.mockResolvedValue(originalContent)

			// Mock API error
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

		it("handles malformed JSON responses", async () => {
			// Mock file read
			mockedReadFile.mockResolvedValue(originalContent)

			// Mock malformed response (invalid JSON)
			const mockStream = {
				[Symbol.asyncIterator]: vi.fn().mockReturnValue({
					next: vi
						.fn()
						.mockResolvedValueOnce({
							value: { type: "text", text: "Just some text without valid JSON" },
							done: false,
						})
						.mockResolvedValueOnce({ done: true }),
				}),
			}

			mockCline.api.createMessage.mockReturnValue(mockStream)

			await executeApplyCodeTool()

			expect(mockCline.say).toHaveBeenCalledWith(
				"error",
				expect.stringContaining("Failed to parse code generation response"),
			)
		})

		it("handles diff application failures", async () => {
			// Mock file read
			mockedReadFile.mockResolvedValue(originalContent)

			// Mock successful code generation
			const mockStream1 = {
				[Symbol.asyncIterator]: vi.fn().mockReturnValue({
					next: vi
						.fn()
						.mockResolvedValueOnce({
							value: {
								type: "text",
								text: JSON.stringify({
									file: testFilePath,
									type: "snippet",
									code: "generated code",
								}),
							},
							done: false,
						})
						.mockResolvedValueOnce({ done: true }),
				}),
			}

			// Mock successful diff generation
			const mockStream2 = {
				[Symbol.asyncIterator]: vi.fn().mockReturnValue({
					next: vi
						.fn()
						.mockResolvedValueOnce({
							value: {
								type: "text",
								text: "<<<<<<< SEARCH\nwrong content\n=======\nmodified\n>>>>>>> REPLACE",
							},
							done: false,
						})
						.mockResolvedValueOnce({ done: true }),
				}),
			}

			const mockIsolatedApiHandler = {
				createMessage: vi.fn().mockReturnValue(mockStream2),
				getModel: vi.fn().mockReturnValue({
					id: "claude-3",
					info: { contextWindow: 200000 },
				}),
				countTokens: vi.fn().mockResolvedValue(100),
			}

			mockCline.api.createMessage.mockReturnValueOnce(mockStream1)
			mockedBuildApiHandler.mockReturnValue(mockIsolatedApiHandler)

			// Mock diff application failure
			mockCline.diffStrategy.applyDiff.mockResolvedValue({
				success: false,
				error: "Could not find search content",
			})

			await executeApplyCodeTool()

			expect(mockCline.say).toHaveBeenCalledWith(
				"error",
				"Failed to apply generated diff: Could not find search content",
			)
			expect(mockPushToolResult).toHaveBeenCalledWith(
				"Failed to apply generated diff: Could not find search content",
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

	describe("user approval", () => {
		it("reverts changes when user denies approval", async () => {
			// Mock file read
			mockedReadFile.mockResolvedValue(originalContent)

			// Mock successful API responses
			const mockStream1 = {
				[Symbol.asyncIterator]: vi.fn().mockReturnValue({
					next: vi
						.fn()
						.mockResolvedValueOnce({
							value: {
								type: "text",
								text: JSON.stringify({
									file: testFilePath,
									type: "snippet",
									code: "generated code",
								}),
							},
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
								text: "<<<<<<< SEARCH\noriginal\n=======\nmodified\n>>>>>>> REPLACE",
							},
							done: false,
						})
						.mockResolvedValueOnce({ done: true }),
				}),
			}

			const mockIsolatedApiHandler = {
				createMessage: vi.fn().mockReturnValue(mockStream2),
				getModel: vi.fn().mockReturnValue({
					id: "claude-3",
					info: { contextWindow: 200000 },
				}),
				countTokens: vi.fn().mockResolvedValue(100),
			}

			mockCline.api.createMessage.mockReturnValueOnce(mockStream1)
			mockedBuildApiHandler.mockReturnValue(mockIsolatedApiHandler)

			// User denies approval
			mockAskApproval.mockResolvedValue(false)

			await executeApplyCodeTool()

			expect(mockCline.diffViewProvider.revertChanges).toHaveBeenCalled()
			expect(mockCline.diffViewProvider.saveChanges).not.toHaveBeenCalled()
			expect(mockPushToolResult).not.toHaveBeenCalled()
		})
	})
})
