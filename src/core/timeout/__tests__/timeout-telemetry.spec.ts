import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TimeoutManager } from "../TimeoutManager"
import { TelemetryService } from "@roo-code/telemetry"

// Mock TelemetryService
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		hasInstance: vi.fn(),
		instance: {
			captureToolTimeout: vi.fn(),
		},
	},
}))

describe("TimeoutManager Telemetry and Logging", () => {
	let timeoutManager: TimeoutManager
	let mockLogger: ReturnType<typeof vi.fn>
	let originalInstance: TimeoutManager | undefined

	beforeEach(() => {
		// Store the original instance
		originalInstance = (TimeoutManager as any).instance
		// Reset the singleton instance
		;(TimeoutManager as any).instance = undefined

		// Create mock logger
		mockLogger = vi.fn()

		// Create new instance with mock logger
		timeoutManager = TimeoutManager.getInstance(mockLogger)

		// Setup TelemetryService mock
		vi.mocked(TelemetryService.hasInstance).mockReturnValue(true)
		vi.mocked(TelemetryService.instance.captureToolTimeout).mockClear()
	})

	afterEach(() => {
		// Restore the original instance
		;(TimeoutManager as any).instance = originalInstance
		vi.clearAllMocks()
	})

	describe("Logging", () => {
		it("should log operation start", async () => {
			const operation = vi.fn().mockResolvedValue("result")

			await timeoutManager.executeWithTimeout(operation, {
				toolName: "execute_command",
				timeoutMs: 1000,
				enableFallback: false,
				taskId: "task-123",
			})

			expect(mockLogger).toHaveBeenCalledWith(
				expect.stringContaining(
					"[TimeoutManager] Starting operation execute_command:task-123 with timeout 1000ms",
				),
			)
		})

		it("should log successful operation completion", async () => {
			const operation = vi.fn().mockResolvedValue("result")

			await timeoutManager.executeWithTimeout(operation, {
				toolName: "execute_command",
				timeoutMs: 1000,
				enableFallback: false,
				taskId: "task-123",
			})

			expect(mockLogger).toHaveBeenCalledWith(
				expect.stringMatching(
					/\[TimeoutManager\] Operation execute_command:task-123 completed successfully in \d+ms/,
				),
			)
		})

		it("should log timeout events", async () => {
			const operation = vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 2000)))

			await timeoutManager.executeWithTimeout(operation, {
				toolName: "execute_command",
				timeoutMs: 100,
				enableFallback: false,
				taskId: "task-123",
			})

			expect(mockLogger).toHaveBeenCalledWith(
				expect.stringMatching(
					/\[TimeoutManager\] Operation execute_command:task-123 timed out after \d+ms \(limit: 100ms\)/,
				),
			)
		})

		it("should log non-timeout errors", async () => {
			const error = new Error("Test error")
			const operation = vi.fn().mockRejectedValue(error)

			await timeoutManager.executeWithTimeout(operation, {
				toolName: "execute_command",
				timeoutMs: 1000,
				enableFallback: false,
				taskId: "task-123",
			})

			expect(mockLogger).toHaveBeenCalledWith(
				expect.stringMatching(
					/\[TimeoutManager\] Operation execute_command:task-123 failed after \d+ms: Test error/,
				),
			)
		})
	})

	describe("Telemetry", () => {
		it("should capture telemetry for timeout events when TelemetryService is available", async () => {
			const operation = vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 2000)))

			const result = await timeoutManager.executeWithTimeout(operation, {
				toolName: "execute_command",
				timeoutMs: 100,
				enableFallback: false,
				taskId: "task-123",
			})

			expect(result.timedOut).toBe(true)
			expect(TelemetryService.instance.captureToolTimeout).toHaveBeenCalledWith(
				"task-123",
				"execute_command",
				100,
				expect.any(Number),
			)
		})

		it("should not capture telemetry when taskId is not provided", async () => {
			const operation = vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 2000)))

			await timeoutManager.executeWithTimeout(operation, {
				toolName: "execute_command",
				timeoutMs: 100,
				enableFallback: false,
			})

			expect(TelemetryService.instance.captureToolTimeout).not.toHaveBeenCalled()
		})

		it("should not capture telemetry when TelemetryService is not available", async () => {
			vi.mocked(TelemetryService.hasInstance).mockReturnValue(false)

			const operation = vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 2000)))

			await timeoutManager.executeWithTimeout(operation, {
				toolName: "execute_command",
				timeoutMs: 100,
				enableFallback: false,
				taskId: "task-123",
			})

			expect(TelemetryService.instance.captureToolTimeout).not.toHaveBeenCalled()
		})

		it("should not capture telemetry for successful operations", async () => {
			const operation = vi.fn().mockResolvedValue("result")

			await timeoutManager.executeWithTimeout(operation, {
				toolName: "execute_command",
				timeoutMs: 1000,
				enableFallback: false,
				taskId: "task-123",
			})

			expect(TelemetryService.instance.captureToolTimeout).not.toHaveBeenCalled()
		})

		it("should not capture telemetry for non-timeout errors", async () => {
			const operation = vi.fn().mockRejectedValue(new Error("Test error"))

			await timeoutManager.executeWithTimeout(operation, {
				toolName: "execute_command",
				timeoutMs: 1000,
				enableFallback: false,
				taskId: "task-123",
			})

			expect(TelemetryService.instance.captureToolTimeout).not.toHaveBeenCalled()
		})
	})

	describe("getTimeoutStats", () => {
		it("should return timeout statistics", async () => {
			// Execute an operation that will timeout
			const operation = vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 2000)))

			await timeoutManager.executeWithTimeout(operation, {
				toolName: "execute_command",
				timeoutMs: 100,
				enableFallback: false,
				taskId: "task-123",
			})

			const stats = timeoutManager.getTimeoutStats()

			expect(stats.lastTimeout).toBeTruthy()
			expect(stats.lastTimeout?.toolName).toBe("execute_command")
			expect(stats.lastTimeout?.taskId).toBe("task-123")
			expect(stats.lastTimeout?.timeoutMs).toBe(100)
			expect(stats.activeOperations).toBe(0) // Should be 0 after operation completes
		})

		it("should track active operations", async () => {
			// Start a long-running operation
			const operation = vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 5000)))

			const promise = timeoutManager.executeWithTimeout(operation, {
				toolName: "execute_command",
				timeoutMs: 10000,
				enableFallback: false,
				taskId: "task-123",
			})

			// Check stats while operation is running
			const stats = timeoutManager.getTimeoutStats()
			expect(stats.activeOperations).toBe(1)
			expect(stats.operationIds).toContain("execute_command:task-123")

			// Cancel to clean up
			timeoutManager.cancelOperation("execute_command", "task-123")
			await promise.catch(() => {}) // Ignore cancellation error
		})
	})

	describe("Timeout event emission", () => {
		it("should emit timeout event with correct data", async () => {
			const timeoutHandler = vi.fn()
			timeoutManager.on("timeout", timeoutHandler)

			const operation = vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 2000)))

			await timeoutManager.executeWithTimeout(operation, {
				toolName: "execute_command",
				timeoutMs: 100,
				enableFallback: true,
				taskId: "task-123",
			})

			expect(timeoutHandler).toHaveBeenCalledWith({
				toolName: "execute_command",
				timeoutMs: 100,
				executionTimeMs: expect.any(Number),
				taskId: "task-123",
				timestamp: expect.any(Number),
			})

			timeoutManager.off("timeout", timeoutHandler)
		})
	})
})
