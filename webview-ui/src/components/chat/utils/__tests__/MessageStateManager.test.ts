import { describe, it, expect, beforeEach } from "vitest"
import { MessageStateManager } from "../MessageStateManager"

describe("MessageStateManager", () => {
	let manager: MessageStateManager

	beforeEach(() => {
		manager = new MessageStateManager(5, 1000) // Small cache for testing
	})

	describe("basic state management", () => {
		it("should set and get message state", () => {
			const ts = 12345
			manager.setState(ts, { isExpanded: true })

			const state = manager.getState(ts)
			expect(state).toBeDefined()
			expect(state?.isExpanded).toBe(true)
			expect(state?.isPinned).toBe(false)
		})

		it("should return undefined for non-existent state", () => {
			expect(manager.getState(99999)).toBeUndefined()
		})

		it("should check if message is expanded", () => {
			const ts = 12345
			expect(manager.isExpanded(ts)).toBe(false)

			manager.setState(ts, { isExpanded: true })
			expect(manager.isExpanded(ts)).toBe(true)
		})

		it("should toggle expanded state", () => {
			const ts = 12345
			expect(manager.toggleExpanded(ts)).toBe(true)
			expect(manager.isExpanded(ts)).toBe(true)

			expect(manager.toggleExpanded(ts)).toBe(false)
			expect(manager.isExpanded(ts)).toBe(false)
		})
	})

	describe("expanded count tracking", () => {
		it("should track expanded count correctly", () => {
			expect(manager.getExpandedCount()).toBe(0)
			expect(manager.hasExpandedMessages()).toBe(false)

			manager.setState(1, { isExpanded: true })
			expect(manager.getExpandedCount()).toBe(1)
			expect(manager.hasExpandedMessages()).toBe(true)

			manager.setState(2, { isExpanded: true })
			expect(manager.getExpandedCount()).toBe(2)

			manager.setState(1, { isExpanded: false })
			expect(manager.getExpandedCount()).toBe(1)
		})

		it("should handle expanded count when cache evicts items", () => {
			// Fill cache to capacity
			for (let i = 1; i <= 5; i++) {
				manager.setState(i, { isExpanded: true })
			}
			expect(manager.getExpandedCount()).toBe(5)

			// Add one more, should evict the oldest
			manager.setState(6, { isExpanded: true })
			expect(manager.getExpandedCount()).toBe(5) // Should still be 5 due to eviction
		})
	})

	describe("pinned messages", () => {
		it("should pin and unpin messages", () => {
			const ts = 12345
			expect(manager.isPinned(ts)).toBe(false)

			manager.pinMessage(ts)
			expect(manager.isPinned(ts)).toBe(true)
			expect(manager.getState(ts)?.isPinned).toBe(true)

			manager.unpinMessage(ts)
			expect(manager.isPinned(ts)).toBe(false)
			expect(manager.getState(ts)?.isPinned).toBe(false)
		})

		it("should preserve pinned messages during clear", () => {
			manager.pinMessage(1)
			manager.setState(2, { isExpanded: true })
			manager.setState(3, { isExpanded: true })

			manager.clear()

			expect(manager.isPinned(1)).toBe(true)
			expect(manager.getState(1)).toBeDefined()
			expect(manager.getState(2)).toBeUndefined()
			expect(manager.getState(3)).toBeUndefined()
		})
	})

	describe("height caching", () => {
		it("should cache message heights", () => {
			const ts = 12345
			manager.setCachedHeight(ts, 200)

			expect(manager.getCachedHeight(ts)).toBe(200)
			expect(manager.getState(ts)?.height).toBe(200)
		})

		it("should preserve height when updating other properties", () => {
			const ts = 12345
			manager.setCachedHeight(ts, 200)
			manager.setState(ts, { isExpanded: true })

			expect(manager.getCachedHeight(ts)).toBe(200)
			expect(manager.isExpanded(ts)).toBe(true)
		})
	})

	describe("range operations", () => {
		it("should get expanded messages in range", () => {
			manager.setState(1, { isExpanded: true })
			manager.setState(2, { isExpanded: false })
			manager.setState(3, { isExpanded: true })
			manager.setState(4, { isExpanded: false })

			const messages = [{ ts: 1 }, { ts: 2 }, { ts: 3 }, { ts: 4 }]
			const expanded = manager.getExpandedInRange(messages)

			expect(expanded.size).toBe(2)
			expect(expanded.has(1)).toBe(true)
			expect(expanded.has(3)).toBe(true)
		})
	})

	describe("statistics", () => {
		it("should provide accurate stats", () => {
			manager.setState(1, { isExpanded: true })
			manager.setState(2, { isExpanded: false })
			manager.pinMessage(1)
			manager.pinMessage(3)

			const stats = manager.getStats()
			expect(stats.totalStates).toBe(3) // 1, 2, and 3 (pinned creates state)
			expect(stats.expandedCount).toBe(1)
			expect(stats.pinnedCount).toBe(2)
			expect(stats.cacheSize).toBe(3)
		})
	})

	describe("import/export", () => {
		it("should export and import states", () => {
			manager.setState(1, { isExpanded: true })
			manager.setState(2, { isExpanded: false })
			manager.pinMessage(1)

			const exported = manager.exportStates()
			expect(exported.length).toBe(2)

			// Create new manager and import
			const newManager = new MessageStateManager()
			newManager.importStates(exported)

			expect(newManager.isExpanded(1)).toBe(true)
			expect(newManager.isExpanded(2)).toBe(false)
			expect(newManager.isPinned(1)).toBe(true)
			expect(newManager.getExpandedCount()).toBe(1)
		})
	})
})
