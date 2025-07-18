// npx vitest run src/core/timeout/__tests__/timeout-manager.spec.ts

import { describe, test, expect, beforeEach, vitest } from "vitest"
import { TimeoutManager } from "../TimeoutManager"

describe("TimeoutManager", () => {
	let manager: TimeoutManager

	beforeEach(() => {
		manager = TimeoutManager.getInstance()
		manager.clearLastTimeoutEvent()
		vitest.clearAllMocks()
	})

	describe("Basic Operations", () => {
		test("should handle successful operation within timeout", async () => {
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

	describe("Timeout Event Tracking", () => {
		test("should track only the last timeout event", async () => {
			// First timeout
			await manager.executeWithTimeout(
				async () => {
					await new Promise((resolve) => setTimeout(resolve, 200))
					return "should timeout"
				},
				{
					toolName: "execute_command",
					timeoutMs: 50,
					enableFallback: true,
					taskId: "task-1",
				},
			)

			const firstTimeout = manager.getLastTimeoutEvent()
			expect(firstTimeout).toBeTruthy()
			expect(firstTimeout?.toolName).toBe("execute_command")
			expect(firstTimeout?.taskId).toBe("task-1")

			// Second timeout should replace the first
			await manager.executeWithTimeout(
				async () => {
					await new Promise((resolve) => setTimeout(resolve, 200))
					return "should timeout"
				},
				{
					toolName: "read_file",
					timeoutMs: 50,
					enableFallback: true,
					taskId: "task-2",
				},
			)

			const secondTimeout = manager.getLastTimeoutEvent()
			expect(secondTimeout).toBeTruthy()
			expect(secondTimeout?.toolName).toBe("read_file")
			expect(secondTimeout?.taskId).toBe("task-2")
			expect(secondTimeout?.timestamp).toBeGreaterThan(firstTimeout!.timestamp)
		})

		test("should clear last timeout event", async () => {
			// Create a timeout
			await manager.executeWithTimeout(
				async () => {
					await new Promise((resolve) => setTimeout(resolve, 200))
					return "should timeout"
				},
				{
					toolName: "execute_command",
					timeoutMs: 50,
					enableFallback: true,
				},
			)

			expect(manager.getLastTimeoutEvent()).toBeTruthy()

			// Clear it
			manager.clearLastTimeoutEvent()
			expect(manager.getLastTimeoutEvent()).toBeNull()
		})

		test("should return null when no timeout has occurred", () => {
			expect(manager.getLastTimeoutEvent()).toBeNull()
		})
	})

	describe("Operation Management", () => {
		test("cancelOperation should work with simplified operation IDs", async () => {
			// Start a long-running operation
			const operationPromise = manager.executeWithTimeout(
				async (signal) => {
					await new Promise((resolve, reject) => {
						const timeout = setTimeout(resolve, 1000)
						signal.addEventListener("abort", () => {
							clearTimeout(timeout)
							reject(new Error("Operation was aborted"))
						})
					})
					return "should be cancelled"
				},
				{
					toolName: "execute_command",
					timeoutMs: 2000,
					enableFallback: true,
					taskId: "cancel-test",
				},
			)

			// Cancel it immediately
			const cancelled = manager.cancelOperation("execute_command", "cancel-test")
			expect(cancelled).toBe(true)

			// Verify it was cancelled
			const result = await operationPromise
			expect(result.success).toBe(false)
			expect(result.error?.message).toContain("Operation was aborted")
		})

		test("isOperationActive should work with simplified operation IDs", async () => {
			// Start an operation
			const operationPromise = manager.executeWithTimeout(
				async () => {
					await new Promise((resolve) => setTimeout(resolve, 100))
					return "success"
				},
				{
					toolName: "read_file",
					timeoutMs: 200,
					enableFallback: true,
					taskId: "active-test",
				},
			)

			// Check if it's active
			expect(manager.isOperationActive("read_file", "active-test")).toBe(true)

			// Wait for completion
			await operationPromise

			// Should no longer be active
			expect(manager.isOperationActive("read_file", "active-test")).toBe(false)
		})
	})
})
