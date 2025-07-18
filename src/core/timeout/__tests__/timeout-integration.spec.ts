// npx vitest run src/core/timeout/__tests__/timeout-integration.spec.ts

import { describe, test, expect, beforeEach, vitest } from "vitest"
import { TimeoutManager } from "../TimeoutManager"
import { ToolExecutionWrapper } from "../ToolExecutionWrapper"
import { TimeoutFallbackHandler } from "../TimeoutFallbackHandler"
import type { Task } from "../../task/Task"

describe("Timeout Integration Tests", () => {
	beforeEach(() => {
		vitest.clearAllMocks()
	})

	describe("TimeoutManager Integration", () => {
		test("should handle basic timeout operations", async () => {
			const manager = TimeoutManager.getInstance()

			// Test successful operation within timeout
			const result = await manager.executeWithTimeout(
				async () => {
					await new Promise((resolve) => setTimeout(resolve, 10))
					return "success"
				},
				{
					toolName: "execute_command",
					timeoutMs: 100,
					enableFallback: true,
				},
			)

			expect(result.success).toBe(true)
			expect(result.result).toBe("success")
			expect(result.timedOut).toBe(false)
		})

		test("should handle timeout scenarios", async () => {
			const manager = TimeoutManager.getInstance()

			// Test operation that times out
			const result = await manager.executeWithTimeout(
				async () => {
					await new Promise((resolve) => setTimeout(resolve, 200))
					return "should not reach here"
				},
				{
					toolName: "execute_command",
					timeoutMs: 50,
					enableFallback: true,
				},
			)

			expect(result.success).toBe(false)
			expect(result.timedOut).toBe(true)
			expect(result.error?.message).toContain("Operation timed out")
		})
	})

	describe("ToolExecutionWrapper Integration", () => {
		test("should wrap operations correctly", async () => {
			const mockOperation = vitest.fn().mockImplementation(async (signal: AbortSignal) => {
				// Simulate checking abort signal
				if (signal.aborted) {
					throw new Error("Operation was aborted")
				}
				await new Promise((resolve) => setTimeout(resolve, 10))
				return [false, "test result"]
			})

			const result = await ToolExecutionWrapper.execute(
				mockOperation,
				{
					toolName: "execute_command",
					taskId: "test-task",
					timeoutMs: 100,
					enableFallback: true,
				},
				100,
			)

			expect(result.success).toBe(true)
			expect(result.result).toEqual([false, "test result"])
			expect(mockOperation).toHaveBeenCalledWith(expect.any(AbortSignal))
		})

		test("should handle timeout with fallback", async () => {
			const mockOperation = vitest.fn().mockImplementation(async () => {
				await new Promise((resolve) => setTimeout(resolve, 200))
				return [false, "should not reach here"]
			})

			const result = await ToolExecutionWrapper.execute(
				mockOperation,
				{
					toolName: "execute_command",
					taskId: "test-task",
					timeoutMs: 50,
					enableFallback: true,
				},
				50,
			)

			expect(result.success).toBe(false)
			expect(result.timedOut).toBe(true)
			expect(result.fallbackTriggered).toBe(true)
		})
	})

	describe("TimeoutFallbackHandler Integration", () => {
		test("should create AI-powered responses", async () => {
			// Create a mock task to test tool injection
			const mockTask = {
				assistantMessageContent: [],
				cwd: "/test/dir",
				say: vitest.fn().mockResolvedValue(undefined),
			} as unknown as Task

			const response = await TimeoutFallbackHandler.createTimeoutResponse(
				"execute_command",
				5000,
				6000,
				{ command: "npm install" },
				mockTask,
			)

			// The response should contain the basic timeout information
			expect(response).toContain("execute_command")
			expect(response).toContain("5 seconds")
			expect(response).toContain("6s")
			expect(response.length).toBeGreaterThan(50)

			// The response should now contain instructions to use ask_followup_question
			expect(response).toContain("You MUST now use the ask_followup_question tool")
			expect(response).toContain("<ask_followup_question>")
			expect(response).toContain("<question>")
			expect(response).toContain("timed out")
			expect(response).toContain("</question>")
			expect(response).toContain("<follow_up>")
			expect(response).toContain("</follow_up>")
			expect(response).toContain("</ask_followup_question>")

			// Verify that assistantMessageContent was NOT modified
			expect(mockTask.assistantMessageContent).toHaveLength(0)
		})
	})

	describe("AbortSignal Integration", () => {
		test("should be properly handled", async () => {
			const mockOperation = vitest.fn().mockImplementation(async (signal: AbortSignal) => {
				// Simulate a long-running operation that checks abort signal
				return new Promise((resolve, reject) => {
					const timeout = setTimeout(() => {
						if (signal.aborted) {
							reject(new Error("Operation was aborted"))
						} else {
							resolve("success")
						}
					}, 100)

					signal.addEventListener("abort", () => {
						clearTimeout(timeout)
						reject(new Error("Operation was aborted"))
					})
				})
			})

			const result = await ToolExecutionWrapper.execute(
				mockOperation,
				{
					toolName: "execute_command",
					taskId: "test-task",
					timeoutMs: 50, // Shorter timeout to trigger abort
					enableFallback: false,
				},
				50,
			)

			expect(result.success).toBe(false)
			expect(result.timedOut).toBe(true)
		})
	})

	describe("Cross-Component Integration", () => {
		test("should coordinate between TimeoutManager and ToolExecutionWrapper", async () => {
			const manager = TimeoutManager.getInstance()

			const mockOperation = vitest.fn().mockImplementation(async (signal: AbortSignal) => {
				// Simulate operation that respects abort signal
				await new Promise((resolve, reject) => {
					const timeout = setTimeout(resolve, 150)
					signal.addEventListener("abort", () => {
						clearTimeout(timeout)
						reject(new Error("Operation was aborted"))
					})
				})
				return [false, "completed"]
			})

			// Use ToolExecutionWrapper directly
			const result = await ToolExecutionWrapper.execute(
				mockOperation,
				{
					toolName: "read_file",
					taskId: "integration-test",
					timeoutMs: 100,
					enableFallback: true,
				},
				100,
			)

			expect(result.success).toBe(false)
			expect(result.timedOut).toBe(true)
		})

		test("should handle nested timeout scenarios", async () => {
			const manager = TimeoutManager.getInstance()

			// Test nested timeout operations
			const outerResult = await manager.executeWithTimeout(
				async () => {
					// Inner timeout operation
					return await manager.executeWithTimeout(
						async () => {
							await new Promise((resolve) => setTimeout(resolve, 150))
							return "inner success"
						},
						{
							toolName: "search_files",
							timeoutMs: 100,
							enableFallback: true,
						},
					)
				},
				{
					toolName: "execute_command",
					timeoutMs: 200,
					enableFallback: true,
				},
			)

			// The inner operation should timeout, but the outer should succeed with the timeout result
			expect(outerResult.success).toBe(true)
			if (outerResult.result) {
				expect(outerResult.result.success).toBe(false)
				expect(outerResult.result.timedOut).toBe(true)
			}
		})

		test("should maintain timeout event tracking across components", async () => {
			const manager = TimeoutManager.getInstance()
			manager.clearLastTimeoutEvent()

			// Execute operation that will timeout
			await manager.executeWithTimeout(
				async () => {
					await new Promise((resolve) => setTimeout(resolve, 200))
					return "should timeout"
				},
				{
					toolName: "browser_action",
					timeoutMs: 50,
					enableFallback: true,
					taskId: "tracking-test",
				},
			)

			// Verify timeout event was tracked
			const timeoutEvent = manager.getLastTimeoutEvent()
			expect(timeoutEvent).toBeTruthy()
			expect(timeoutEvent?.toolName).toBe("browser_action")
			expect(timeoutEvent?.taskId).toBe("tracking-test")
			expect(timeoutEvent?.timeoutMs).toBe(50)
		})
	})
})
