import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { VIRTUALIZATION_CONFIG, detectDevicePerformance, getViewportConfigForDevice } from "../virtualizationConfig"

describe("virtualizationConfig", () => {
	describe("VIRTUALIZATION_CONFIG", () => {
		it("should have correct default viewport configurations", () => {
			expect(VIRTUALIZATION_CONFIG.viewport.default).toEqual({ top: 500, bottom: 1000 })
			expect(VIRTUALIZATION_CONFIG.viewport.streaming).toEqual({ top: 500, bottom: 3000 })
			expect(VIRTUALIZATION_CONFIG.viewport.expanded).toEqual({ top: 2000, bottom: 2000 })
			expect(VIRTUALIZATION_CONFIG.viewport.minimal).toEqual({ top: 200, bottom: 500 })
		})

		it("should have correct performance thresholds", () => {
			expect(VIRTUALIZATION_CONFIG.performance.maxMessagesInDOM).toBe(500)
			expect(VIRTUALIZATION_CONFIG.performance.cleanupThreshold).toBe(1000)
			expect(VIRTUALIZATION_CONFIG.performance.minCleanupInterval).toBe(5000)
		})

		it("should have correct auto-scroll configuration", () => {
			expect(VIRTUALIZATION_CONFIG.autoScroll.threshold).toBe(50)
			expect(VIRTUALIZATION_CONFIG.autoScroll.smoothScrollMaxDistance).toBe(5000)
			expect(VIRTUALIZATION_CONFIG.autoScroll.debounceDelay).toBe(100)
		})

		it("should have correct state cache configuration", () => {
			expect(VIRTUALIZATION_CONFIG.stateCache.maxSize).toBe(100)
			expect(VIRTUALIZATION_CONFIG.stateCache.ttl).toBe(30 * 60 * 1000)
		})
	})

	describe("detectDevicePerformance", () => {
		let originalNavigator: any

		beforeEach(() => {
			originalNavigator = global.navigator
			// @ts-expect-error - mocking navigator
			global.navigator = {
				userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124",
			}
		})

		afterEach(() => {
			global.navigator = originalNavigator
		})

		it("should detect high performance device with large heap size", () => {
			// @ts-expect-error - mocking navigator memory
			global.navigator.memory = {
				jsHeapSizeLimit: 3 * 1024 * 1024 * 1024, // 3GB
			}

			expect(detectDevicePerformance()).toBe("high")
		})

		it("should detect medium performance device with medium heap size", () => {
			// @ts-expect-error - mocking navigator memory
			global.navigator.memory = {
				jsHeapSizeLimit: 1.5 * 1024 * 1024 * 1024, // 1.5GB
			}

			expect(detectDevicePerformance()).toBe("medium")
		})

		it("should detect high performance device with many CPU cores", () => {
			// @ts-expect-error - mocking navigator hardwareConcurrency
			global.navigator.hardwareConcurrency = 8

			expect(detectDevicePerformance()).toBe("high")
		})

		it("should detect medium performance device with moderate CPU cores", () => {
			// @ts-expect-error - mocking navigator hardwareConcurrency
			global.navigator.hardwareConcurrency = 4

			expect(detectDevicePerformance()).toBe("medium")
		})

		it("should detect high performance device with high device memory", () => {
			// @ts-expect-error - mocking navigator deviceMemory
			global.navigator.deviceMemory = 8

			expect(detectDevicePerformance()).toBe("high")
		})

		it("should detect low performance on mobile devices", () => {
			// @ts-expect-error - mocking navigator userAgent
			global.navigator.userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15"
			// @ts-expect-error - mocking navigator connection
			global.navigator.connection = { effectiveType: "4g" }

			expect(detectDevicePerformance()).toBe("low")
		})

		it("should default to low performance when no hints available", () => {
			// @ts-expect-error - mocking navigator
			global.navigator = {
				userAgent: "Unknown Browser",
			}

			expect(detectDevicePerformance()).toBe("low")
		})
	})

	describe("getViewportConfigForDevice", () => {
		it("should return correct config for high performance", () => {
			const config = getViewportConfigForDevice("high")
			expect(config).toEqual({ top: 1000, bottom: 2000 })
		})

		it("should return correct config for medium performance", () => {
			const config = getViewportConfigForDevice("medium")
			expect(config).toEqual(VIRTUALIZATION_CONFIG.viewport.default)
		})

		it("should return correct config for low performance", () => {
			const config = getViewportConfigForDevice("low")
			expect(config).toEqual(VIRTUALIZATION_CONFIG.viewport.minimal)
		})
	})
})
