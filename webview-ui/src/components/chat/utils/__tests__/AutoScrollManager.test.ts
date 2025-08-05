import { describe, it, expect, beforeEach, vi } from "vitest"
import { AutoScrollManager } from "../AutoScrollManager"

describe("AutoScrollManager", () => {
	let manager: AutoScrollManager

	beforeEach(() => {
		manager = new AutoScrollManager(50) // 50px threshold
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
		manager.dispose()
	})

	describe("scroll detection", () => {
		it("should detect user scrolling up", () => {
			// Initial state at bottom
			manager.handleScroll(950, 1000, 50)
			expect(manager.getState().isUserScrolling).toBe(false)

			// Scroll up significantly
			manager.handleScroll(800, 1000, 50)
			expect(manager.getState().isUserScrolling).toBe(true)
		})

		it("should reset user scrolling when returning to bottom", () => {
			// Scroll up
			manager.handleScroll(800, 1000, 50)
			expect(manager.getState().isUserScrolling).toBe(true)

			// Return to bottom (within threshold)
			manager.handleScroll(960, 1000, 50)
			expect(manager.getState().isUserScrolling).toBe(false)
		})

		it("should not detect small scroll movements as user scrolling", () => {
			manager.handleScroll(945, 1000, 50)
			manager.handleScroll(940, 1000, 50) // Small movement
			expect(manager.getState().isUserScrolling).toBe(false)
		})
	})

	describe("auto-scroll decisions", () => {
		it("should allow auto-scroll when not user scrolling", () => {
			expect(manager.shouldAutoScroll()).toBe(true)
		})

		it("should prevent auto-scroll when user is scrolling", () => {
			manager.forceUserScrolling()
			expect(manager.shouldAutoScroll()).toBe(false)
		})

		it("should prevent auto-scroll when there are expanded messages", () => {
			expect(manager.shouldAutoScroll(true)).toBe(false)
		})

		it("should prevent auto-scroll during active scrolling", () => {
			manager.handleScroll(100, 1000, 50)
			expect(manager.getState().isScrolling).toBe(true)
			expect(manager.shouldAutoScroll()).toBe(false)

			// After timeout, scrolling should stop
			vi.advanceTimersByTime(200)
			expect(manager.getState().isScrolling).toBe(false)
		})
	})

	describe("position checks", () => {
		it("should correctly identify near bottom position", () => {
			expect(manager.isNearBottom(960, 1000, 50)).toBe(true) // 40px from bottom
			expect(manager.isNearBottom(940, 1000, 50)).toBe(false) // 60px from bottom
		})

		it("should correctly identify at bottom position", () => {
			expect(manager.isAtBottom(999, 1000, 50)).toBe(true) // 1px from bottom
			expect(manager.isAtBottom(995, 1000, 50)).toBe(false) // 5px from bottom
		})
	})

	describe("scroll velocity", () => {
		it("should calculate scroll velocity", () => {
			const now = Date.now()
			manager.handleScroll(100, 1000, 50, now)
			manager.handleScroll(200, 1000, 50, now + 100) // 100px in 100ms

			expect(manager.getScrollVelocity()).toBeCloseTo(1.0) // 1px/ms
		})

		it("should reset velocity after scrolling stops", () => {
			manager.handleScroll(100, 1000, 50)
			manager.handleScroll(200, 1000, 50)
			expect(manager.getScrollVelocity()).toBeGreaterThan(0)

			vi.advanceTimersByTime(200)
			expect(manager.getScrollVelocity()).toBe(0)
		})
	})

	describe("scroll behavior optimization", () => {
		it("should recommend instant scroll for large distances", () => {
			expect(manager.getScrollBehavior(0, 10000, 5000)).toBe("auto")
		})

		it("should recommend smooth scroll for small distances", () => {
			expect(manager.getScrollBehavior(0, 1000, 5000)).toBe("smooth")
		})
	})

	describe("performance metrics", () => {
		it("should track scroll metrics", () => {
			// Simulate scroll events
			const now = Date.now()
			for (let i = 0; i < 10; i++) {
				manager.handleScroll(i * 10, 1000, 50, now + i * 16) // ~60fps
			}

			const metrics = manager.getScrollMetrics()
			expect(metrics.fps).toBeGreaterThan(0)
			expect(metrics.isUserScrolling).toBe(false)
			expect(metrics.velocity).toBeGreaterThan(0)
			expect(metrics.isScrolling).toBe(true)
		})
	})

	describe("threshold management", () => {
		it("should update bottom threshold", () => {
			expect(manager.getState().atBottomThreshold).toBe(50)

			manager.setBottomThreshold(100)
			expect(manager.getState().atBottomThreshold).toBe(100)

			// Check with new threshold
			expect(manager.isNearBottom(920, 1000, 50)).toBe(true) // 80px from bottom, within 100px
		})
	})

	describe("state management", () => {
		it("should reset all state", () => {
			manager.forceUserScrolling()
			manager.handleScroll(500, 1000, 50)

			manager.reset()

			const state = manager.getState()
			expect(state.isUserScrolling).toBe(false)
			expect(state.lastScrollTop).toBe(0)
			expect(state.scrollVelocity).toBe(0)
			expect(state.isScrolling).toBe(false)
		})

		it("should clean up timers on dispose", () => {
			manager.handleScroll(100, 1000, 50)

			const clearTimeoutSpy = vi.spyOn(global, "clearTimeout")
			manager.dispose()

			expect(clearTimeoutSpy).toHaveBeenCalled()
		})
	})
})
