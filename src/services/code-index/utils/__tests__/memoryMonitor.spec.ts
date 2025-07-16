// npx vitest services/code-index/utils/__tests__/memoryMonitor.spec.ts

import { describe, it, expect, beforeEach, vi } from "vitest"
import { MemoryMonitor } from "../memoryMonitor"

describe("MemoryMonitor", () => {
	let memoryMonitor: MemoryMonitor

	beforeEach(() => {
		memoryMonitor = MemoryMonitor.getInstance()
		vi.clearAllMocks()
	})

	describe("getInstance", () => {
		it("should return singleton instance", () => {
			const instance1 = MemoryMonitor.getInstance()
			const instance2 = MemoryMonitor.getInstance()
			expect(instance1).toBe(instance2)
		})
	})

	describe("getMemoryStats", () => {
		it("should return memory statistics", () => {
			const stats = memoryMonitor.getMemoryStats()
			expect(stats).toHaveProperty("used")
			expect(stats).toHaveProperty("total")
			expect(stats).toHaveProperty("percentage")
			expect(typeof stats.used).toBe("number")
			expect(typeof stats.total).toBe("number")
			expect(typeof stats.percentage).toBe("number")
			expect(stats.used).toBeGreaterThan(0)
			expect(stats.total).toBeGreaterThan(0)
			expect(stats.percentage).toBeGreaterThanOrEqual(0)
			expect(stats.percentage).toBeLessThanOrEqual(1)
		})
	})

	describe("isMemoryPressure", () => {
		it("should return boolean indicating memory pressure", () => {
			const result = memoryMonitor.isMemoryPressure()
			expect(typeof result).toBe("boolean")
		})

		it("should return true when memory usage is above threshold", () => {
			// Mock high memory usage
			const originalGetMemoryStats = memoryMonitor.getMemoryStats
			memoryMonitor.getMemoryStats = vi.fn().mockReturnValue({
				used: 900 * 1024 * 1024, // 900MB
				total: 1000 * 1024 * 1024, // 1GB
				percentage: 0.9, // 90%
			})

			const result = memoryMonitor.isMemoryPressure()
			expect(result).toBe(true)

			// Restore original method
			memoryMonitor.getMemoryStats = originalGetMemoryStats
		})

		it("should return false when memory usage is below threshold", () => {
			// Mock low memory usage
			const originalGetMemoryStats = memoryMonitor.getMemoryStats
			memoryMonitor.getMemoryStats = vi.fn().mockReturnValue({
				used: 500 * 1024 * 1024, // 500MB
				total: 1000 * 1024 * 1024, // 1GB
				percentage: 0.5, // 50%
			})

			const result = memoryMonitor.isMemoryPressure()
			expect(result).toBe(false)

			// Restore original method
			memoryMonitor.getMemoryStats = originalGetMemoryStats
		})
	})

	describe("getMemoryUsageMB", () => {
		it("should return memory usage in MB", () => {
			const usage = memoryMonitor.getMemoryUsageMB()
			expect(typeof usage).toBe("number")
			expect(usage).toBeGreaterThan(0)
		})
	})

	describe("forceGC", () => {
		it("should call global.gc if available", () => {
			const originalGC = global.gc
			global.gc = vi.fn()

			memoryMonitor.forceGC()
			expect(global.gc).toHaveBeenCalled()

			global.gc = originalGC
		})

		it("should not throw if global.gc is not available", () => {
			const originalGC = global.gc
			delete (global as any).gc

			expect(() => memoryMonitor.forceGC()).not.toThrow()

			global.gc = originalGC
		})
	})

	describe("checkAndCleanup", () => {
		it("should return false if called too frequently", () => {
			// First call should work
			const result1 = memoryMonitor.checkAndCleanup()
			expect(typeof result1).toBe("boolean")

			// Immediate second call should return false (throttled)
			const result2 = memoryMonitor.checkAndCleanup()
			expect(result2).toBe(false)
		})

		it("should force GC when memory pressure is detected", () => {
			const originalGC = global.gc
			const originalGetMemoryStats = memoryMonitor.getMemoryStats
			global.gc = vi.fn()

			// Mock high memory usage
			memoryMonitor.getMemoryStats = vi.fn().mockReturnValue({
				used: 900 * 1024 * 1024,
				total: 1000 * 1024 * 1024,
				percentage: 0.9,
			})

			// Wait for throttle to reset
			setTimeout(() => {
				const result = memoryMonitor.checkAndCleanup()
				expect(result).toBe(true)
				expect(global.gc).toHaveBeenCalled()
			}, 6000)

			// Restore
			global.gc = originalGC
			memoryMonitor.getMemoryStats = originalGetMemoryStats
		})
	})
})
