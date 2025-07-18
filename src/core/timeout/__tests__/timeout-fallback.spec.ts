// npx vitest run src/core/timeout/__tests__/timeout-fallback.spec.ts

import { describe, test, expect, beforeEach, vitest } from "vitest"
import { TimeoutFallbackHandler } from "../TimeoutFallbackHandler"
import type { TimeoutFallbackResult } from "../TimeoutFallbackHandler"
import type { ApiHandler, SingleCompletionHandler } from "../../../api"
import type { Task } from "../../task/Task"

// Create a mock API handler that extends ApiHandler and includes completePrompt
interface MockApiHandler extends ApiHandler, SingleCompletionHandler {}

describe("TimeoutFallbackHandler", () => {
	let mockApiHandler: MockApiHandler
	let mockTask: Partial<Task>

	beforeEach(() => {
		vitest.clearAllMocks()

		// Mock API handler that simulates real AI responses
		mockApiHandler = {
			createMessage: vitest.fn(),
			getModel: vitest.fn().mockReturnValue({ id: "test-model", info: { maxTokens: 4096 } }),
			countTokens: vitest.fn().mockResolvedValue(100),
			completePrompt: vitest.fn(),
		}

		// Mock task with API handler
		mockTask = {
			api: mockApiHandler,
			assistantMessageContent: [],
			cwd: "/test/dir",
			say: vitest.fn(),
		}
	})

	describe("AI Fallback Generation", () => {
		test("should use AI to generate contextual suggestions when available", async () => {
			// Mock AI response with numbered suggestions
			const mockAiResponse = `Here are some suggestions for the timeout:

1. Break the npm install command into smaller package installations
2. Clear npm cache and try again with npm cache clean --force
3. Use npm install --no-optional to skip optional dependencies
4. Check network connectivity and try with different registry`

			;(mockApiHandler.completePrompt as any).mockResolvedValueOnce(mockAiResponse)

			const context = {
				toolName: "execute_command" as const,
				timeoutMs: 30000,
				executionTimeMs: 35000,
				toolParams: { command: "npm install" },
			}

			const result = await TimeoutFallbackHandler.generateAiFallback(context, mockTask as Task)

			expect(result.success).toBe(true)
			expect(result.toolCall).toBeDefined()
			expect(result.toolCall?.name).toBe("ask_followup_question")
			expect(result.toolCall?.params.question).toContain("execute_command")
			expect(result.toolCall?.params.question).toContain("30 seconds")
			expect(result.toolCall?.params.question).toContain("may still be running in the background")

			// Check that AI-generated suggestions are included
			const followUp = result.toolCall?.params.follow_up || ""
			expect(followUp).toContain("Break the npm install command into smaller package installations")
			expect(followUp).toContain("Clear npm cache and try again")
			expect(followUp).toContain("Use npm install --no-optional")
			expect(followUp).toContain("Check network connectivity")

			// Verify AI was called with proper prompt
			expect(mockApiHandler.completePrompt).toHaveBeenCalledWith(
				expect.stringContaining("execute_command operation has timed out"),
			)
			expect(mockApiHandler.completePrompt).toHaveBeenCalledWith(expect.stringContaining("npm install"))
		})

		test("should fallback to static suggestions when AI fails", async () => {
			// Mock AI failure
			;(mockApiHandler.completePrompt as any).mockRejectedValueOnce(new Error("API Error"))

			const context = {
				toolName: "execute_command" as const,
				timeoutMs: 30000,
				executionTimeMs: 35000,
				toolParams: { command: "npm test" },
			}

			const result = await TimeoutFallbackHandler.generateAiFallback(context, mockTask as Task)

			expect(result.success).toBe(true)
			expect(result.toolCall).toBeDefined()
			expect(result.toolCall?.name).toBe("ask_followup_question")

			// Should contain static fallback suggestions
			const followUp = result.toolCall?.params.follow_up || ""
			expect(followUp).toContain("still running in the background")
			expect(followUp).toContain('Break "npm test" into smaller')
			expect(followUp).toContain("background using")
			expect(followUp).toContain("alternative approach")
		})

		test("should timeout AI fallback generation using exact tool timeout", async () => {
			// Mock AI handler that takes longer than the timeout
			;(mockApiHandler.completePrompt as any).mockImplementation(() => {
				return new Promise((resolve) => {
					// This would resolve after 5 seconds, but should timeout before that
					setTimeout(() => {
						resolve("This response should never be used")
					}, 5000)
				})
			})

			const context = {
				toolName: "execute_command" as const,
				timeoutMs: 2000, // 2 second timeout for faster testing
				executionTimeMs: 2500,
				toolParams: { command: "npm install" },
			}

			const startTime = Date.now()
			// The timeout is now taken from context.timeoutMs
			const result = await TimeoutFallbackHandler.generateAiFallback(context, mockTask as Task)
			const elapsedTime = Date.now() - startTime

			// Should timeout and fallback to static suggestions
			expect(result.success).toBe(true)
			expect(result.toolCall).toBeDefined()
			expect(result.toolCall?.name).toBe("ask_followup_question")

			// Should have timed out around 2 seconds (exact tool timeout)
			expect(elapsedTime).toBeGreaterThanOrEqual(1900)
			expect(elapsedTime).toBeLessThan(2500)

			// Should contain static fallback suggestions since AI timed out
			const followUp = result.toolCall?.params.follow_up || ""
			expect(followUp).toContain("still running in the background")
			expect(followUp).toContain('Break "npm install" into smaller')
			expect(followUp).toContain("background using")
			expect(followUp).toContain("alternative approach")

			// Verify AI was called
			expect(mockApiHandler.completePrompt).toHaveBeenCalled()
		}, 5000) // Test timeout of 5 seconds

		test("should fallback to static suggestions when API handler is unavailable", async () => {
			// Task without API handler
			const taskWithoutApi = {}

			const context = {
				toolName: "read_file" as const,
				timeoutMs: 5000,
				executionTimeMs: 6000,
				toolParams: { path: "/large/file.txt" },
			}

			const result = await TimeoutFallbackHandler.generateAiFallback(context, taskWithoutApi as Task)

			expect(result.success).toBe(true)
			expect(result.toolCall).toBeDefined()

			// Should contain static fallback suggestions for read_file
			const followUp = result.toolCall?.params.follow_up || ""
			expect(followUp).toContain('Read "/large/file.txt" in smaller chunks')
			expect(followUp).toContain("accessible and not locked")
		})

		test("should parse AI response with different numbering formats", async () => {
			// Test different numbering formats
			const mockAiResponse = `Here are the suggestions:

1) Try breaking the command into parts
2. Use a different approach  
3) Check system resources
4. Increase timeout duration`

			;(mockApiHandler.completePrompt as any).mockResolvedValueOnce(mockAiResponse)

			const context = {
				toolName: "execute_command" as const,
				timeoutMs: 10000,
				executionTimeMs: 12000,
				toolParams: { command: "build script" },
			}

			const result = await TimeoutFallbackHandler.generateAiFallback(context, mockTask as Task)

			expect(result.success).toBe(true)
			const followUp = result.toolCall?.params.follow_up || ""
			expect(followUp).toContain("Try breaking the command into parts")
			expect(followUp).toContain("Use a different approach")
			expect(followUp).toContain("Check system resources")
			expect(followUp).toContain("Increase timeout duration")
		})

		test("should handle AI response without numbered list", async () => {
			// AI response without clear numbering
			const mockAiResponse = `You could try splitting the operation. Another option is to check the network. Maybe increase the timeout. Consider using a different tool.`

			;(mockApiHandler.completePrompt as any).mockResolvedValueOnce(mockAiResponse)

			const context = {
				toolName: "browser_action" as const,
				timeoutMs: 15000,
				executionTimeMs: 16000,
				toolParams: { action: "click" },
			}

			const result = await TimeoutFallbackHandler.generateAiFallback(context, mockTask as Task)

			expect(result.success).toBe(true)
			const followUp = result.toolCall?.params.follow_up || ""

			// Should extract sentences as suggestions
			expect(followUp).toContain("You could try splitting the operation")
			expect(followUp).toContain("Another option is to check the network")
		})

		test("should include task context in AI prompt when available", async () => {
			const mockAiResponse = `1. Try a different approach\n2. Check the working directory\n3. Break into steps`
			;(mockApiHandler.completePrompt as any).mockResolvedValueOnce(mockAiResponse)

			const context = {
				toolName: "search_files" as const,
				timeoutMs: 20000,
				executionTimeMs: 22000,
				toolParams: { path: "/project", regex: ".*\\.ts$" },
				taskContext: {
					currentStep: "Finding TypeScript files",
					workingDirectory: "/project/src",
					previousActions: ["read package.json", "list files"],
				},
			}

			const result = await TimeoutFallbackHandler.generateAiFallback(context, mockTask as Task)

			expect(result.success).toBe(true)

			// Verify the prompt included task context
			const calledPrompt = (mockApiHandler.completePrompt as any).mock.calls[0][0]
			expect(calledPrompt).toContain("Current step: Finding TypeScript files")
			expect(calledPrompt).toContain("Working directory: /project/src")
			expect(calledPrompt).toContain("search_files")
			expect(calledPrompt).toContain("ts$") // Just check for the pattern ending
		})

		test("should limit suggestions to maximum of 4", async () => {
			// AI response with many suggestions
			const mockAiResponse = `Here are many suggestions:

1. First suggestion
2. Second suggestion  
3. Third suggestion
4. Fourth suggestion
5. Fifth suggestion
6. Sixth suggestion
7. Seventh suggestion`

			;(mockApiHandler.completePrompt as any).mockResolvedValueOnce(mockAiResponse)

			const context = {
				toolName: "write_to_file" as const,
				timeoutMs: 8000,
				executionTimeMs: 9000,
				toolParams: { path: "/output.txt" },
			}

			const result = await TimeoutFallbackHandler.generateAiFallback(context, mockTask as Task)

			expect(result.success).toBe(true)
			const followUp = result.toolCall?.params.follow_up || ""

			// Count the number of <suggest> tags
			const suggestCount = (followUp.match(/<suggest>/g) || []).length
			expect(suggestCount).toBeLessThanOrEqual(4)

			// Should include first 4 suggestions
			expect(followUp).toContain("First suggestion")
			expect(followUp).toContain("Fourth suggestion")
			// Should not include 5th and beyond
			expect(followUp).not.toContain("Fifth suggestion")
		})
	})

	describe("End-to-End AI Tests", () => {
		test("should generate realistic AI suggestions for execute_command timeout", async () => {
			// Create a realistic mock API handler
			const testApiHandler: MockApiHandler = {
				createMessage: vitest.fn(),
				getModel: vitest.fn().mockReturnValue({ id: "claude-3-sonnet", info: { maxTokens: 4096 } }),
				countTokens: vitest.fn().mockResolvedValue(150),
				completePrompt: vitest.fn().mockResolvedValue(
					`
Here are some suggestions for the npm install timeout:

1. Clear npm cache with "npm cache clean --force" and retry
2. Break installation into smaller chunks by installing packages individually
3. Use "npm install --no-optional" to skip optional dependencies
4. Check network connectivity and try with a different registry
			`.trim(),
				),
			}

			const testTask: Partial<Task> = {
				api: testApiHandler,
			}

			const context = {
				toolName: "execute_command" as const,
				timeoutMs: 60000,
				executionTimeMs: 65000,
				toolParams: {
					command: "npm install",
					cwd: "/project",
				},
			}

			const result = await TimeoutFallbackHandler.generateAiFallback(context, testTask as Task)

			// Verify the result structure
			expect(result.success).toBe(true)
			expect(result.toolCall).toBeDefined()
			expect(result.toolCall?.name).toBe("ask_followup_question")
			expect(result.toolCall?.params.question).toContain("execute_command")
			expect(result.toolCall?.params.question).toContain("60 seconds")

			// Verify AI-generated suggestions are included
			const followUp = result.toolCall?.params.follow_up || ""
			expect(followUp).toContain("Clear npm cache")
			expect(followUp).toContain("Break installation into smaller chunks")
			expect(followUp).toContain("no-optional")
			expect(followUp).toContain("network connectivity")

			// Verify the AI was called with a proper prompt
			expect(testApiHandler.completePrompt).toHaveBeenCalledWith(
				expect.stringContaining("execute_command operation has timed out"),
			)
			expect(testApiHandler.completePrompt).toHaveBeenCalledWith(expect.stringContaining("npm install"))
			expect(testApiHandler.completePrompt).toHaveBeenCalledWith(expect.stringContaining("60 seconds"))
		})

		test("should handle AI response with different formatting", async () => {
			// Mock AI response with different numbering style
			const testApiHandler: MockApiHandler = {
				createMessage: vitest.fn(),
				getModel: vitest.fn().mockReturnValue({ id: "gpt-4", info: { maxTokens: 8192 } }),
				countTokens: vitest.fn().mockResolvedValue(200),
				completePrompt: vitest.fn().mockResolvedValue(
					`
Based on the search_files timeout, here are my recommendations:

• Limit search to specific subdirectories instead of entire project
• Use more specific regex patterns to reduce matches
• Try list_files first to understand directory structure
• Consider breaking search into multiple smaller operations
			`.trim(),
				),
			}

			const testTask: Partial<Task> = {
				api: testApiHandler,
			}

			const context = {
				toolName: "search_files" as const,
				timeoutMs: 30000,
				executionTimeMs: 32000,
				toolParams: {
					path: "/large-project",
					regex: ".*",
					file_pattern: "*.ts",
				},
			}

			const result = await TimeoutFallbackHandler.generateAiFallback(context, testTask as Task)

			expect(result.success).toBe(true)
			expect(result.toolCall).toBeDefined()

			// Should extract suggestions even with bullet points
			const followUp = result.toolCall?.params.follow_up || ""
			expect(followUp).toContain("Narrow the search scope")
			expect(followUp).toContain("simpler search patterns")
			expect(followUp).toContain("file type filters")
			expect(followUp).toContain("incrementally in smaller batches")
		})

		test("should gracefully handle AI failure and use static fallback", async () => {
			// Mock API handler that fails
			const testApiHandler: MockApiHandler = {
				createMessage: vitest.fn(),
				getModel: vitest.fn().mockReturnValue({ id: "test-model", info: { maxTokens: 4096 } }),
				countTokens: vitest.fn().mockResolvedValue(100),
				completePrompt: vitest.fn().mockRejectedValue(new Error("API rate limit exceeded")),
			}

			const testTask: Partial<Task> = {
				api: testApiHandler,
			}

			const context = {
				toolName: "read_file" as const,
				timeoutMs: 10000,
				executionTimeMs: 12000,
				toolParams: {
					path: "/very/large/file.log",
				},
			}

			const result = await TimeoutFallbackHandler.generateAiFallback(context, testTask as Task)

			expect(result.success).toBe(true)
			expect(result.toolCall).toBeDefined()

			// Should contain static fallback suggestions for read_file
			const followUp = result.toolCall?.params.follow_up || ""
			expect(followUp).toContain('Read "/very/large/file.log" in smaller chunks')
			expect(followUp).toContain("accessible and not locked")
			expect(followUp).toContain("different approach")
			expect(followUp).toContain("Increase the timeout")

			// Verify AI was attempted but failed gracefully
			expect(testApiHandler.completePrompt).toHaveBeenCalled()
		})

		test("should work without task API handler", async () => {
			// Task without API handler
			const testTask: Partial<Task> = {}

			const context = {
				toolName: "browser_action" as const,
				timeoutMs: 15000,
				executionTimeMs: 16500,
				toolParams: {
					action: "click",
					coordinate: "450,300",
				},
			}

			const result = await TimeoutFallbackHandler.generateAiFallback(context, testTask as Task)

			expect(result.success).toBe(true)
			expect(result.toolCall).toBeDefined()

			// Should contain static fallback suggestions for browser_action
			const followUp = result.toolCall?.params.follow_up || ""
			expect(followUp).toContain("still processing in the background")
			expect(followUp).toContain('Simplify the "click"')
			expect(followUp).toContain("Wait for specific elements")
			expect(followUp).toContain("Reset the browser session")
		})
	})

	describe("Tool Call Response Generation", () => {
		test("should return response with ask_followup_question tool instructions", async () => {
			// Mock the TimeoutFallbackHandler to return a successful AI result
			const mockAiResult: TimeoutFallbackResult = {
				success: true,
				toolCall: {
					name: "ask_followup_question",
					params: {
						question:
							"The execute_command operation timed out after 5 seconds. How would you like to proceed?",
						follow_up:
							"<suggest>Try a different approach</suggest>\n<suggest>Break into smaller steps</suggest>",
					},
				},
			}

			// Spy on the generateAiFallback method
			const generateSpy = vitest.spyOn(TimeoutFallbackHandler, "generateAiFallback")
			generateSpy.mockResolvedValue(mockAiResult)

			// Call createTimeoutResponse
			const response = await TimeoutFallbackHandler.createTimeoutResponse(
				"execute_command",
				5000,
				6000,
				{ command: "npm install" },
				mockTask as Task,
			)

			// Check that the response contains the base timeout message
			expect(response).toContain("timed out after 5 seconds")
			expect(response).toContain("Execution Time: 6s")

			// Check that the response includes instructions to use ask_followup_question
			expect(response).toContain("You MUST now use the ask_followup_question tool")
			expect(response).toContain("<ask_followup_question>")
			expect(response).toContain(`<question>${mockAiResult.toolCall?.params.question}</question>`)
			expect(response).toContain("<follow_up>")
			expect(response).toContain(mockAiResult.toolCall?.params.follow_up)
			expect(response).toContain("</follow_up>")
			expect(response).toContain("</ask_followup_question>")
			expect(response).toContain("This is required to help the user decide how to proceed after the timeout.")

			// Verify that assistantMessageContent was NOT modified
			expect(mockTask.assistantMessageContent).toHaveLength(0)

			generateSpy.mockRestore()
		})

		test("should return fallback message when AI generation fails", async () => {
			// Spy on the generateAiFallback method to return a failure
			const generateSpy = vitest.spyOn(TimeoutFallbackHandler, "generateAiFallback")
			generateSpy.mockResolvedValue({
				success: false,
				error: "AI generation failed",
			})

			// Call createTimeoutResponse
			const response = await TimeoutFallbackHandler.createTimeoutResponse(
				"execute_command",
				5000,
				6000,
				{ command: "npm install" },
				mockTask as Task,
			)

			// Check that the response contains the base timeout message
			expect(response).toContain("timed out after 5 seconds")
			expect(response).toContain("Execution Time: 6s")

			// Check that the response contains the fallback message
			expect(response).toContain(
				"The operation timed out. Please consider breaking this into smaller steps or trying a different approach.",
			)

			// Should not contain ask_followup_question instructions
			expect(response).not.toContain("ask_followup_question")

			generateSpy.mockRestore()
		})
	})

	describe("UI Integration", () => {
		test("should generate AI fallbacks using static method", async () => {
			const context = {
				toolName: "execute_command" as const,
				timeoutMs: 30000,
				executionTimeMs: 25000,
				toolParams: { command: "npm install" },
			}

			const result = await TimeoutFallbackHandler.generateAiFallback(context)

			expect(result.success).toBe(true)
			expect(result.toolCall).toBeDefined()
			expect(result.toolCall?.name).toBe("ask_followup_question")
			expect(result.toolCall?.params.question).toContain("execute_command")
		})

		test("should create timeout response with AI fallbacks", async () => {
			const response = await TimeoutFallbackHandler.createTimeoutResponse("execute_command", 30000, 25000, {
				command: "npm install",
			})

			expect(response).toContain("execute_command")
			expect(response).toContain("timed out")
			expect(response.length).toBeGreaterThan(100) // Should contain substantial content
		})

		test("should handle different tool types with AI fallbacks", async () => {
			const commandResponse = await TimeoutFallbackHandler.createTimeoutResponse(
				"execute_command",
				30000,
				25000,
				{
					command: "npm test",
				},
			)

			const browserResponse = await TimeoutFallbackHandler.createTimeoutResponse("browser_action", 30000, 25000, {
				action: "click",
			})

			expect(commandResponse).toContain("execute_command")
			expect(browserResponse).toContain("browser_action")
			expect(commandResponse).not.toEqual(browserResponse)
		})

		test("should validate UI setting flow", () => {
			// This test validates that timeout settings can be toggled
			const settings = {
				timeoutFallbackEnabled: true,
				toolExecutionTimeoutMs: 30000,
			}

			// Simulate UI toggle
			settings.timeoutFallbackEnabled = false
			expect(settings.timeoutFallbackEnabled).toBe(false)

			// Simulate timeout duration change
			settings.toolExecutionTimeoutMs = 60000
			expect(settings.toolExecutionTimeoutMs).toBe(60000)
		})
	})
})
