import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { scrollToSetting } from "../searchUtils"

describe("scrollToSetting", () => {
	let mockElement: HTMLElement
	let originalQuerySelector: typeof document.querySelector

	beforeEach(() => {
		// Mock element
		mockElement = document.createElement("div")
		mockElement.scrollIntoView = vi.fn()
		mockElement.classList.add = vi.fn()
		mockElement.classList.remove = vi.fn()

		// Mock querySelector
		originalQuerySelector = document.querySelector
		document.querySelector = vi.fn((selector: string) => {
			if (selector === '[data-setting-id="testSetting"]') {
				return mockElement
			}
			return null
		})

		// Mock setTimeout
		vi.useFakeTimers()
	})

	afterEach(() => {
		document.querySelector = originalQuerySelector
		vi.useRealTimers()
		vi.clearAllMocks()
	})

	it("should find element by data-setting-id and scroll to it", () => {
		scrollToSetting("testSetting")

		expect(document.querySelector).toHaveBeenCalledWith('[data-setting-id="testSetting"]')
		expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
			behavior: "smooth",
			block: "center",
		})
	})

	it("should add highlight class to the element", () => {
		scrollToSetting("testSetting")

		expect(mockElement.classList.add).toHaveBeenCalledWith("setting-highlight")
	})

	it("should remove highlight class after 2 seconds", () => {
		scrollToSetting("testSetting")

		expect(mockElement.classList.remove).not.toHaveBeenCalled()

		// Fast-forward 2 seconds
		vi.advanceTimersByTime(2000)

		expect(mockElement.classList.remove).toHaveBeenCalledWith("setting-highlight")
	})

	it("should handle non-existent setting gracefully", () => {
		// This should not throw an error
		expect(() => scrollToSetting("nonExistentSetting")).not.toThrow()

		expect(document.querySelector).toHaveBeenCalledWith('[data-setting-id="nonExistentSetting"]')
		expect(mockElement.scrollIntoView).not.toHaveBeenCalled()
		expect(mockElement.classList.add).not.toHaveBeenCalled()
	})

	it("should handle empty setting ID", () => {
		expect(() => scrollToSetting("")).not.toThrow()

		expect(document.querySelector).toHaveBeenCalledWith('[data-setting-id=""]')
		expect(mockElement.scrollIntoView).not.toHaveBeenCalled()
	})

	it("should handle null/undefined setting ID", () => {
		expect(() => scrollToSetting(null as any)).not.toThrow()
		expect(() => scrollToSetting(undefined as any)).not.toThrow()

		expect(mockElement.scrollIntoView).not.toHaveBeenCalled()
	})
})
