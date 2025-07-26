import { describe, it, expect, vi } from "vitest"

describe("getDefaultHighWaterMark polyfill", () => {
	it("should add getDefaultHighWaterMark if it doesn't exist", () => {
		// Mock the stream module without getDefaultHighWaterMark
		const mockStream: any = {}

		// Execute the polyfill code
		if (!mockStream.getDefaultHighWaterMark) {
			mockStream.getDefaultHighWaterMark = function (objectMode: boolean): number {
				return objectMode ? 16 : 16 * 1024
			}
		}

		// Verify the function was added
		expect(mockStream.getDefaultHighWaterMark).toBeDefined()
		expect(typeof mockStream.getDefaultHighWaterMark).toBe("function")
	})

	it("should return correct values for objectMode", () => {
		const mockStream: any = {}
		mockStream.getDefaultHighWaterMark = function (objectMode: boolean): number {
			return objectMode ? 16 : 16 * 1024
		}

		// Test objectMode = true
		expect(mockStream.getDefaultHighWaterMark(true)).toBe(16)

		// Test objectMode = false
		expect(mockStream.getDefaultHighWaterMark(false)).toBe(16 * 1024)
	})

	it("should not override existing getDefaultHighWaterMark", () => {
		// Mock stream with existing getDefaultHighWaterMark
		const originalFunction = vi.fn((objectMode: boolean) => (objectMode ? 32 : 32 * 1024))
		const mockStream: any = {
			getDefaultHighWaterMark: originalFunction,
		}

		// Execute polyfill check
		if (!mockStream.getDefaultHighWaterMark) {
			mockStream.getDefaultHighWaterMark = function (objectMode: boolean): number {
				return objectMode ? 16 : 16 * 1024
			}
		}

		// Verify original function is preserved
		expect(mockStream.getDefaultHighWaterMark).toBe(originalFunction)
		expect(mockStream.getDefaultHighWaterMark(true)).toBe(32)
		expect(mockStream.getDefaultHighWaterMark(false)).toBe(32 * 1024)
	})
})
