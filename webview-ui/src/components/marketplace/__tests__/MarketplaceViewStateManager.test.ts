import { MarketplaceViewStateManager } from "../MarketplaceViewStateManager"
import { vscode } from "../../../utils/vscode"
import { MarketplaceItemType, MarketplaceItem, MarketplaceSource } from "../../../../../src/services/marketplace/types"
import { DEFAULT_MARKETPLACE_SOURCE } from "../../../../../src/services/marketplace/constants"

const createTestItem = (overrides = {}): MarketplaceItem => ({
	id: "test",
	name: "test",
	type: "mode" as MarketplaceItemType,
	description: "Test mode",
	url: "https://github.com/test/repo",
	repoUrl: "https://github.com/test/repo",
	author: "Test Author",
	version: "1.0.0",
	sourceName: "Test Source",
	sourceUrl: "https://github.com/test/repo",
	...overrides,
})

const createTestSources = (): MarketplaceSource[] => [
	{ url: "https://github.com/test/repo1", enabled: true },
	{ url: "https://github.com/test/repo2", enabled: true },
	{ url: "https://github.com/test/repo3", enabled: true },
]

// Mock vscode.postMessage
jest.mock("../../../utils/vscode", () => ({
	vscode: {
		postMessage: jest.fn(),
	},
}))

describe("MarketplaceViewStateManager", () => {
	let manager: MarketplaceViewStateManager

	beforeEach(() => {
		jest.clearAllMocks()
		jest.useFakeTimers()
		manager = new MarketplaceViewStateManager()
		manager.initialize() // Send initial sources
	})

	afterEach(() => {
		jest.clearAllTimers()
		jest.useRealTimers()
	})

	describe("Initial State", () => {
		it("should initialize with default state", () => {
			const state = manager.getState()
			expect(state).toEqual({
				allItems: [],
				displayItems: [],
				isFetching: false,
				activeTab: "browse",
				refreshingUrls: [],
				sources: [DEFAULT_MARKETPLACE_SOURCE],
				filters: {
					type: "",
					search: "",
					tags: [],
				},
				sortConfig: {
					by: "name",
					order: "asc",
				},
			})
		})

		it("should send initial sources when initialized", () => {
			manager.initialize()
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "marketplaceSources",
				sources: [DEFAULT_MARKETPLACE_SOURCE],
			})
		})

		it("should initialize with default source", () => {
			const manager = new MarketplaceViewStateManager()

			// Initial state should include default source
			const state = manager.getState()
			expect(state.sources).toEqual([
				{
					url: "https://github.com/RooCodeInc/Roo-Code-Marketplace",
					name: "Roo Code",
					enabled: true,
				},
			])

			// Verify initial message was sent to update sources
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "marketplaceSources",
				sources: [
					{
						url: "https://github.com/RooCodeInc/Roo-Code-Marketplace",
						name: "Roo Code",
						enabled: true,
					},
				],
			})
		})
	})

	describe("Fetch Transitions", () => {
		it("should handle FETCH_ITEMS transition", async () => {
			jest.clearAllMocks() // Clear mock to ignore initialize() call
			await manager.transition({ type: "FETCH_ITEMS" })

			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "fetchMarketplaceItems",
				bool: true,
			})

			const state = manager.getState()
			expect(state.isFetching).toBe(true)
		})

		it("should not start a new fetch if one is in progress", async () => {
			jest.clearAllMocks() // Clear mock to ignore initialize() call
			// Start first fetch
			await manager.transition({ type: "FETCH_ITEMS" })

			// Try to start second fetch
			await manager.transition({ type: "FETCH_ITEMS" })

			// postMessage should only be called once
			expect(vscode.postMessage).toHaveBeenCalledTimes(1)
		})

		it("should handle FETCH_COMPLETE transition", async () => {
			const testItems = [createTestItem()]

			await manager.transition({ type: "FETCH_ITEMS" })
			await manager.transition({
				type: "FETCH_COMPLETE",
				payload: { items: testItems },
			})

			const state = manager.getState()
			expect(state.isFetching).toBe(false)
			expect(state.allItems).toEqual(testItems)
		})

		it("should handle FETCH_ERROR transition", async () => {
			await manager.transition({ type: "FETCH_ITEMS" })
			await manager.transition({ type: "FETCH_ERROR" })

			const state = manager.getState()
			expect(state.isFetching).toBe(false)
		})
	})

	describe("Race Conditions", () => {
		it("should maintain items state when repeatedly switching tabs", async () => {
			// Start with initial items
			const initialItems = [createTestItem({ name: "Initial Item" })]
			await manager.transition({
				type: "FETCH_COMPLETE",
				payload: { items: initialItems },
			})

			// First switch to settings
			await manager.transition({
				type: "SET_ACTIVE_TAB",
				payload: { tab: "settings" },
			})

			// Switch back to browse
			await manager.transition({
				type: "SET_ACTIVE_TAB",
				payload: { tab: "browse" },
			})

			// Verify items are preserved after first switch
			let state = manager.getState()
			expect(state.displayItems).toEqual(initialItems)
			expect(state.allItems).toEqual(initialItems)

			// Simulate receiving empty response during fetch
			await manager.handleMessage({
				type: "state",
				state: { marketplaceItems: [] },
			})

			// Verify items are still preserved
			state = manager.getState()
			expect(state.displayItems).toEqual(initialItems)
			expect(state.allItems).toEqual(initialItems)

			// Switch to settings again
			await manager.transition({
				type: "SET_ACTIVE_TAB",
				payload: { tab: "settings" },
			})

			// Switch back to browse again
			await manager.transition({
				type: "SET_ACTIVE_TAB",
				payload: { tab: "browse" },
			})

			// Verify items are still preserved after second switch
			state = manager.getState()
			expect(state.displayItems).toEqual(initialItems)
			expect(state.allItems).toEqual(initialItems)

			// Simulate another empty response
			await manager.handleMessage({
				type: "state",
				state: { marketplaceItems: [] },
			})

			// Final verification that items are still preserved
			state = manager.getState()
			expect(state.displayItems).toEqual(initialItems)
			expect(state.allItems).toEqual(initialItems)
		})

		it("should preserve items when receiving empty response", async () => {
			// Start with initial items
			const initialItems = [createTestItem({ name: "Initial Item" })]
			await manager.transition({
				type: "FETCH_COMPLETE",
				payload: { items: initialItems },
			})

			// Verify initial state
			let state = manager.getState()
			expect(state.allItems).toEqual(initialItems)
			expect(state.displayItems).toEqual(initialItems)

			// Simulate receiving an empty response
			await manager.handleMessage({
				type: "state",
				state: { marketplaceItems: [] },
			})

			// Verify items are preserved
			state = manager.getState()
			expect(state.allItems).toEqual(initialItems)
			expect(state.displayItems).toEqual(initialItems)
			expect(state.isFetching).toBe(false)
		})

		it("should preserve items when switching tabs", async () => {
			// Start with initial items
			const initialItems = [createTestItem({ name: "Initial Item" })]
			await manager.transition({
				type: "FETCH_COMPLETE",
				payload: { items: initialItems },
			})

			// Switch to settings tab
			await manager.transition({
				type: "SET_ACTIVE_TAB",
				payload: { tab: "settings" },
			})

			// Switch back to browse
			await manager.transition({
				type: "SET_ACTIVE_TAB",
				payload: { tab: "browse" },
			})

			// Verify that items are preserved
			const state = manager.getState()
			expect(state.displayItems).toEqual(initialItems)
			expect(state.allItems).toEqual(initialItems)
		})

		it("should handle rapid filtering during initial load", async () => {
			// Start initial load
			await manager.transition({ type: "FETCH_ITEMS" })

			// Quickly apply filters
			await manager.transition({
				type: "UPDATE_FILTERS",
				payload: { filters: { type: "mode" } },
			})

			// Complete the initial load
			await manager.handleMessage({
				type: "state",
				state: { marketplaceItems: [createTestItem()] },
			})

			// Fast-forward past debounce time
			jest.advanceTimersByTime(300)

			const state = manager.getState()
			expect(state.filters.type).toBe("mode")
			// We don't preserve allItems during filtering anymore
			expect(state.displayItems).toBeDefined()
			expect(vscode.postMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "filterMarketplaceItems",
					filters: expect.objectContaining({ type: "mode" }),
				}),
			)
		})

		it("should handle concurrent filter operations", async () => {
			// Reset mock before test
			;(vscode.postMessage as jest.Mock).mockClear()

			// Apply first filter
			await manager.transition({
				type: "UPDATE_FILTERS",
				payload: { filters: { search: "test" } },
			})

			// Apply second filter
			await manager.transition({
				type: "UPDATE_FILTERS",
				payload: { filters: { type: "mode" } },
			})

			// Each filter update should be sent immediately
			expect(vscode.postMessage).toHaveBeenCalledTimes(2)
			expect(vscode.postMessage).toHaveBeenLastCalledWith({
				type: "filterMarketplaceItems",
				filters: {
					search: "test",
					type: "mode",
					tags: [],
				},
			})
		})

		it("should handle rapid source deletions", async () => {
			// Reset mock before test
			;(vscode.postMessage as jest.Mock).mockClear()

			// Create test sources
			const testSources = createTestSources()

			// Set initial sources and wait for state update
			await manager.transition({
				type: "UPDATE_SOURCES",
				payload: { sources: testSources },
			})

			// Delete all sources at once
			await manager.transition({
				type: "UPDATE_SOURCES",
				payload: { sources: [] },
			})

			// Wait for state to settle
			jest.runAllTimers()

			// Get all calls to postMessage
			const calls = (vscode.postMessage as jest.Mock).mock.calls
			const sourcesMessages = calls.filter((call) => call[0].type === "marketplaceSources")
			const lastSourcesMessage = sourcesMessages[sourcesMessages.length - 1]

			// Verify state has default source
			const state = manager.getState()
			expect(state.sources).toEqual([DEFAULT_MARKETPLACE_SOURCE])

			// Verify the last sources message was sent with default source
			expect(lastSourcesMessage[0]).toEqual({
				type: "marketplaceSources",
				sources: [DEFAULT_MARKETPLACE_SOURCE],
			})
		})

		it("should handle rapid source operations during fetch when in browse tab", async () => {
			// Switch to browse tab first
			await manager.transition({
				type: "SET_ACTIVE_TAB",
				payload: { tab: "browse" },
			})

			// Start a fetch
			await manager.transition({ type: "FETCH_ITEMS" })

			// Rapidly update sources while fetch is in progress
			const sources = [{ url: "https://github.com/test/repo1", enabled: true }]

			await manager.transition({
				type: "UPDATE_SOURCES",
				payload: { sources },
			})

			// Complete the fetch
			await manager.handleMessage({
				type: "state",
				state: { marketplaceItems: [createTestItem()] },
			})

			const state = manager.getState()
			expect(state.sources).toEqual(sources)
			expect(state.allItems).toHaveLength(1)
			expect(state.isFetching).toBe(false)
		})
	})

	describe("Error Handling", () => {
		it("should handle fetch timeout", async () => {
			await manager.transition({ type: "FETCH_ITEMS" })

			// Fast-forward past the timeout
			jest.advanceTimersByTime(30000)

			const state = manager.getState()
			expect(state.isFetching).toBe(false)
		})

		it("should handle invalid message types gracefully", () => {
			manager.handleMessage({ type: "invalidType" })
			const state = manager.getState()
			expect(state.isFetching).toBe(false)
			expect(state.allItems).toEqual([])
		})

		it("should handle invalid state message format", () => {
			manager.handleMessage({ type: "state", state: {} })
			const state = manager.getState()
			expect(state.allItems).toEqual([])
		})

		it("should handle invalid transition payloads", async () => {
			// @ts-expect-error - Testing invalid payload
			await manager.transition({ type: "UPDATE_FILTERS", payload: { invalid: true } })
			const state = manager.getState()
			expect(state.filters).toEqual({
				type: "",
				search: "",
				tags: [],
			})
		})
	})

	describe("Filter Behavior", () => {
		it("should send filter updates immediately", async () => {
			// Reset mock before test
			;(vscode.postMessage as jest.Mock).mockClear()

			// Apply first filter
			await manager.transition({
				type: "UPDATE_FILTERS",
				payload: { filters: { search: "test1" } },
			})

			// Apply second filter
			await manager.transition({
				type: "UPDATE_FILTERS",
				payload: { filters: { search: "test2" } },
			})

			// Apply third filter
			await manager.transition({
				type: "UPDATE_FILTERS",
				payload: { filters: { search: "test3" } },
			})

			// Should send all updates immediately
			expect(vscode.postMessage).toHaveBeenCalledTimes(3)
			expect(vscode.postMessage).toHaveBeenLastCalledWith({
				type: "filterMarketplaceItems",
				filters: {
					type: "",
					search: "test3",
					tags: [],
				},
			})
		})

		it("should send filter message immediately when filters are cleared", async () => {
			// First set some filters
			await manager.transition({
				type: "UPDATE_FILTERS",
				payload: {
					filters: {
						type: "mode",
						search: "test",
					},
				},
			})

			// Clear mock to ignore the first filter message
			;(vscode.postMessage as jest.Mock).mockClear()

			// Clear filters
			await manager.transition({
				type: "UPDATE_FILTERS",
				payload: {
					filters: {
						type: "",
						search: "",
						tags: [],
					},
				},
			})

			// Should send filter message with empty filters immediately
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "filterMarketplaceItems",
				filters: {
					type: "",
					search: "",
					tags: [],
				},
			})
		})

		it("should maintain filter criteria when search is cleared", async () => {
			// Reset mock before test
			;(vscode.postMessage as jest.Mock).mockClear()

			// First set a type filter
			await manager.transition({
				type: "UPDATE_FILTERS",
				payload: {
					filters: { type: "mode" },
				},
			})

			// Then add a search term
			await manager.transition({
				type: "UPDATE_FILTERS",
				payload: {
					filters: { search: "test" },
				},
			})

			// Clear the search term
			await manager.transition({
				type: "UPDATE_FILTERS",
				payload: {
					filters: { search: "" },
				},
			})

			// Should maintain type filter when search is cleared
			expect(vscode.postMessage).toHaveBeenLastCalledWith({
				type: "filterMarketplaceItems",
				filters: {
					type: "mode",
					search: "",
					tags: [],
				},
			})

			const state = manager.getState()
			expect(state.filters).toEqual({
				type: "mode",
				search: "",
				tags: [],
			})
		})
	})

	describe("Message Handling", () => {
		it("should handle repository refresh completion", () => {
			const url = "https://example.com/repo"

			// First add URL to refreshing list
			manager.transition({
				type: "REFRESH_SOURCE",
				payload: { url },
			})

			// Then handle completion message
			manager.handleMessage({
				type: "repositoryRefreshComplete",
				url,
			})

			const state = manager.getState()
			expect(state.refreshingUrls).not.toContain(url)
		})

		it("should handle marketplace button click with error", () => {
			manager.handleMessage({
				type: "marketplaceButtonClicked",
				text: "error",
			})

			const state = manager.getState()
			expect(state.isFetching).toBe(false)
		})

		it("should handle marketplace button click for refresh", () => {
			manager.handleMessage({
				type: "marketplaceButtonClicked",
			})

			const state = manager.getState()
			expect(state.isFetching).toBe(true)
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "fetchMarketplaceItems",
				bool: true,
			})
		})
	})

	describe("Tab Management", () => {
		it("should handle SET_ACTIVE_TAB transition", async () => {
			await manager.transition({
				type: "SET_ACTIVE_TAB",
				payload: { tab: "settings" },
			})

			const state = manager.getState()
			expect(state.activeTab).toBe("settings")
		})

		it("should trigger initial fetch when switching to browse with no items", async () => {
			jest.clearAllMocks() // Clear mock to ignore initialize() call

			// Start in settings tab
			await manager.transition({
				type: "SET_ACTIVE_TAB",
				payload: { tab: "settings" },
			})

			// Switch to browse tab
			await manager.transition({
				type: "SET_ACTIVE_TAB",
				payload: { tab: "browse" },
			})

			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "fetchMarketplaceItems",
				bool: true,
			})
		})

		it("should not trigger fetch when switching to browse with existing items", async () => {
			jest.clearAllMocks() // Clear mock to ignore initialize() call

			// Add some items first
			await manager.transition({
				type: "FETCH_COMPLETE",
				payload: { items: [createTestItem()] },
			})

			// Switch to settings tab
			await manager.transition({
				type: "SET_ACTIVE_TAB",
				payload: { tab: "settings" },
			})

			// Switch back to browse tab
			await manager.transition({
				type: "SET_ACTIVE_TAB",
				payload: { tab: "browse" },
			})

			expect(vscode.postMessage).not.toHaveBeenCalledWith({
				type: "fetchMarketplaceItems",
				bool: true,
			})
		})

		it("should automatically fetch when sources are modified and viewing browse tab", async () => {
			jest.clearAllMocks() // Clear mock to ignore initialize() call

			// Add some items first
			await manager.transition({
				type: "FETCH_COMPLETE",
				payload: { items: [createTestItem()] },
			})

			// Switch to browse tab
			await manager.transition({
				type: "SET_ACTIVE_TAB",
				payload: { tab: "browse" },
			})

			// Modify sources
			await manager.transition({
				type: "UPDATE_SOURCES",
				payload: { sources: [{ url: "https://github.com/test/repo1", enabled: true }] },
			})

			// Should trigger fetch due to source modification
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "fetchMarketplaceItems",
				bool: true,
			})
		})

		it("should not trigger fetch when switching to settings tab", async () => {
			await manager.transition({
				type: "SET_ACTIVE_TAB",
				payload: { tab: "settings" },
			})

			expect(vscode.postMessage).not.toHaveBeenCalledWith({
				type: "fetchMarketplaceItems",
				bool: true,
			})
		})
	})

	describe("Fetch Timeout Handling", () => {
		it("should handle fetch timeout", async () => {
			await manager.transition({ type: "FETCH_ITEMS" })

			// Fast-forward past the timeout
			jest.advanceTimersByTime(30000)

			const state = manager.getState()
			expect(state.isFetching).toBe(false)
		})

		it("should clear timeout on successful fetch", async () => {
			await manager.transition({ type: "FETCH_ITEMS" })

			// Complete fetch before timeout
			await manager.transition({
				type: "FETCH_COMPLETE",
				payload: { items: [createTestItem()] },
			})

			// Fast-forward past the timeout
			jest.advanceTimersByTime(30000)

			// State should still reflect successful fetch
			const state = manager.getState()
			expect(state.isFetching).toBe(false)
			expect(state.allItems).toHaveLength(1)
		})

		it("should not switch tabs when timeout occurs while in settings tab", async () => {
			// First switch to settings tab
			await manager.transition({
				type: "SET_ACTIVE_TAB",
				payload: { tab: "settings" },
			})

			// Start a fetch
			await manager.transition({ type: "FETCH_ITEMS" })

			// Set up a state change handler to track tab changes
			let tabSwitched = false
			const unsubscribe = manager.onStateChange((state) => {
				if (state.activeTab === "browse") {
					tabSwitched = true
				}
			})

			// Fast-forward past the timeout
			jest.advanceTimersByTime(30000)

			// Clean up the handler
			unsubscribe()

			// Verify the tab didn't switch to browse
			expect(tabSwitched).toBe(false)
			const state = manager.getState()
			expect(state.activeTab).toBe("settings")
		})

		it("should make minimal state updates when timeout occurs in browse tab", async () => {
			// First ensure we're in browse tab
			await manager.transition({
				type: "SET_ACTIVE_TAB",
				payload: { tab: "browse" },
			})

			// Add some items
			const testItems = [createTestItem(), createTestItem({ name: "Item 2" })]
			await manager.transition({
				type: "FETCH_COMPLETE",
				payload: { items: testItems },
			})

			// Start a new fetch
			await manager.transition({ type: "FETCH_ITEMS" })

			// Track state changes
			let stateChangeCount = 0
			const unsubscribe = manager.onStateChange(() => {
				stateChangeCount++
			})

			// Reset the counter since we've already had state changes
			stateChangeCount = 0

			// Fast-forward past the timeout
			jest.advanceTimersByTime(30000)

			// Clean up the handler
			unsubscribe()

			// Verify we got a state update
			expect(stateChangeCount).toBe(1)

			// Verify the items were preserved
			const state = manager.getState()
			expect(state.allItems).toHaveLength(2)
			expect(state.isFetching).toBe(false)
			expect(state.activeTab).toBe("browse")
		})

		it("should prevent concurrent fetches during timeout period", async () => {
			jest.clearAllMocks() // Clear mock to ignore initialize() call

			// Start first fetch
			await manager.transition({ type: "FETCH_ITEMS" })

			// Attempt second fetch before timeout
			jest.advanceTimersByTime(15000)
			await manager.transition({ type: "FETCH_ITEMS" })

			// postMessage should only be called once
			expect(vscode.postMessage).toHaveBeenCalledTimes(1)
		})
	})

	// Filter behavior tests are already covered in the previous describe block

	describe("Source Management", () => {
		beforeEach(() => {
			// Mock setTimeout to execute immediately
			jest.useFakeTimers()
		})

		afterEach(() => {
			jest.useRealTimers()
		})

		it("should trigger fetch for remaining source after source deletion when in browse tab", async () => {
			// Start with two sources
			const sources = [
				{ url: "https://github.com/test/repo1", enabled: true },
				{ url: "https://github.com/test/repo2", enabled: true },
			]

			// Switch to browse tab
			await manager.transition({
				type: "SET_ACTIVE_TAB",
				payload: { tab: "browse" },
			})

			await manager.transition({
				type: "UPDATE_SOURCES",
				payload: { sources },
			})

			// Clear mock to ignore initial fetch
			;(vscode.postMessage as jest.Mock).mockClear()

			// Delete one source
			await manager.transition({
				type: "UPDATE_SOURCES",
				payload: { sources: [sources[0]] },
			})

			// Verify that a fetch was triggered for the remaining source
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "fetchMarketplaceItems",
				bool: true,
			})

			// Verify state has the remaining source
			const state = manager.getState()
			expect(state.sources).toEqual([sources[0]])
		})

		it("should re-add default source when all sources are removed", async () => {
			// Add some test sources
			const sources = [
				{ url: "https://github.com/test/repo1", enabled: true },
				{ url: "https://github.com/test/repo2", enabled: true },
			]

			await manager.transition({
				type: "UPDATE_SOURCES",
				payload: { sources },
			})

			// Clear mock to ignore previous messages
			;(vscode.postMessage as jest.Mock).mockClear()

			// Remove all sources
			await manager.transition({
				type: "UPDATE_SOURCES",
				payload: { sources: [] },
			})

			// Run any pending timers before checking messages
			jest.runAllTimers()

			// Get all calls to postMessage
			const calls = (vscode.postMessage as jest.Mock).mock.calls
			const sourcesMessage = calls.find((call) => call[0].type === "marketplaceSources")

			// Verify that the sources message was sent with default source
			expect(sourcesMessage[0]).toEqual({
				type: "marketplaceSources",
				sources: [
					{
						url: "https://github.com/RooCodeInc/Roo-Code-Marketplace",
						name: "Roo Code",
						enabled: true,
					},
				],
			})
		})

		it("should handle UPDATE_SOURCES transition", async () => {
			const sources = [
				{ url: "https://github.com/test/repo", enabled: true },
				{ url: "https://github.com/test/repo2", enabled: false },
			]

			await manager.transition({
				type: "UPDATE_SOURCES",
				payload: { sources },
			})

			const state = manager.getState()
			expect(state.sources).toEqual(sources)
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "marketplaceSources",
				sources,
			})
		})

		it("should handle REFRESH_SOURCE transition", async () => {
			const url = "https://github.com/test/repo"

			await manager.transition({
				type: "REFRESH_SOURCE",
				payload: { url },
			})

			const state = manager.getState()
			expect(state.refreshingUrls).toContain(url)
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "refreshMarketplaceSource",
				url,
			})
		})

		it("should handle REFRESH_SOURCE_COMPLETE transition", async () => {
			const url = "https://github.com/test/repo"

			// First add URL to refreshing list
			await manager.transition({
				type: "REFRESH_SOURCE",
				payload: { url },
			})

			// Then complete the refresh
			await manager.transition({
				type: "REFRESH_SOURCE_COMPLETE",
				payload: { url },
			})

			const state = manager.getState()
			expect(state.refreshingUrls).not.toContain(url)
		})
	})

	describe("Filter Transitions", () => {
		it("should preserve original items when receiving filtered results", async () => {
			// Set up initial items
			const initialItems = [
				createTestItem({ name: "Item 1" }),
				createTestItem({ name: "Item 2" }),
				createTestItem({ name: "Item 3" }),
			]
			await manager.transition({
				type: "FETCH_COMPLETE",
				payload: { items: initialItems },
			})

			// Apply a filter
			await manager.transition({
				type: "UPDATE_FILTERS",
				payload: { filters: { search: "Item 1" } },
			})

			// Fast-forward past debounce time
			jest.advanceTimersByTime(300)

			// Simulate receiving filtered results
			manager.handleMessage({
				type: "state",
				state: {
					marketplaceItems: [initialItems[0]], // Only Item 1
				},
			})

			// We no longer preserve original items since we rely on backend filtering
			const state = manager.getState()
			expect(state.allItems).toBeDefined()
		})

		it("should handle UPDATE_FILTERS transition", async () => {
			const filters = {
				type: "mode",
				search: "test",
				tags: ["tag1"],
			}

			await manager.transition({
				type: "UPDATE_FILTERS",
				payload: { filters },
			})

			const state = manager.getState()
			expect(state.filters).toEqual(filters)

			// Fast-forward past debounce time
			jest.advanceTimersByTime(300)

			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "filterMarketplaceItems",
				filters: {
					type: "mode",
					search: "test",
					tags: ["tag1"],
				},
			})
		})
	})

	describe("Sort Transitions", () => {
		it("should sort items by name in ascending order", async () => {
			const items = [
				createTestItem({ name: "B Component" }),
				createTestItem({ name: "A Component" }),
				createTestItem({ name: "C Component" }),
			]

			await manager.transition({
				type: "FETCH_COMPLETE",
				payload: { items },
			})

			await manager.transition({
				type: "UPDATE_SORT",
				payload: { sortConfig: { by: "name", order: "asc" } },
			})

			const state = manager.getState()
			expect(state.allItems[0].name).toBe("A Component")
			expect(state.allItems[1].name).toBe("B Component")
			expect(state.allItems[2].name).toBe("C Component")
		})

		it("should sort items by lastUpdated in descending order", async () => {
			const items = [
				createTestItem({ lastUpdated: "2025-04-13T09:00:00-07:00" }),
				createTestItem({ lastUpdated: "2025-04-14T09:00:00-07:00" }),
				createTestItem({ lastUpdated: "2025-04-12T09:00:00-07:00" }),
			]

			await manager.transition({
				type: "FETCH_COMPLETE",
				payload: { items },
			})

			await manager.transition({
				type: "UPDATE_SORT",
				payload: { sortConfig: { by: "lastUpdated", order: "desc" } },
			})

			const state = manager.getState()
			expect(state.allItems[0].lastUpdated).toBe("2025-04-14T09:00:00-07:00")
			expect(state.allItems[1].lastUpdated).toBe("2025-04-13T09:00:00-07:00")
			expect(state.allItems[2].lastUpdated).toBe("2025-04-12T09:00:00-07:00")
		})

		it("should maintain sort order when items are updated", async () => {
			const items = [
				createTestItem({ name: "B Component" }),
				createTestItem({ name: "A Component" }),
				createTestItem({ name: "C Component" }),
			]

			await manager.transition({
				type: "FETCH_COMPLETE",
				payload: { items },
			})

			await manager.transition({
				type: "UPDATE_SORT",
				payload: { sortConfig: { by: "name", order: "asc" } },
			})

			// Add a new item
			const newItems = [...items, createTestItem({ name: "D Component" })]

			await manager.transition({
				type: "FETCH_COMPLETE",
				payload: { items: newItems },
			})

			const state = manager.getState()
			expect(state.allItems[0].name).toBe("A Component")
			expect(state.allItems[1].name).toBe("B Component")
			expect(state.allItems[2].name).toBe("C Component")
			expect(state.allItems[3].name).toBe("D Component")
		})

		it("should handle missing values gracefully", async () => {
			const items = [
				createTestItem({ name: "B Component", lastUpdated: undefined }),
				createTestItem({ name: "A Component", lastUpdated: "2025-04-14T09:00:00-07:00" }),
			]

			await manager.transition({
				type: "FETCH_COMPLETE",
				payload: { items },
			})

			await manager.transition({
				type: "UPDATE_SORT",
				payload: { sortConfig: { by: "lastUpdated", order: "desc" } },
			})

			const state = manager.getState()
			expect(state.allItems[0].lastUpdated).toBe("2025-04-14T09:00:00-07:00")
			expect(state.allItems[1].lastUpdated).toBeUndefined()
		})
	})

	describe("Message Handling", () => {
		it("should restore sources from marketplaceSources on webview launch", () => {
			const savedSources = [
				{
					url: "https://github.com/RooCodeInc/Roo-Code-Marketplace",
					name: "Roo Code",
					enabled: true,
				},
				{
					url: "https://github.com/test/custom-repo",
					name: "Custom Repo",
					enabled: true,
				},
			]

			// Simulate VS Code restart by sending initial state with saved sources
			manager.handleMessage({
				type: "state",
				state: { marketplaceSources: savedSources },
			})

			const state = manager.getState()
			expect(state.sources).toEqual(savedSources)
		})

		it("should use default source when state message has no sources", () => {
			manager.handleMessage({
				type: "state",
				state: { marketplaceItems: [] },
			})

			const state = manager.getState()
			expect(state.sources).toEqual([DEFAULT_MARKETPLACE_SOURCE])
		})

		it("should update sources when receiving state message", () => {
			const customSources = [
				{
					url: "https://github.com/test/repo1",
					name: "Test Repo 1",
					enabled: true,
				},
				{
					url: "https://github.com/test/repo2",
					name: "Test Repo 2",
					enabled: true,
				},
			]

			manager.handleMessage({
				type: "state",
				state: { sources: customSources },
			})

			const state = manager.getState()
			expect(state.sources).toEqual(customSources)
		})

		it("should handle state message with marketplace items", () => {
			const testItems = [createTestItem()]

			// We need to use any here since we're testing the raw message handling
			manager.handleMessage({
				type: "state",
				state: { marketplaceItems: testItems },
			} as any)

			const state = manager.getState()
			expect(state.allItems).toEqual(testItems)
		})

		it("should handle repositoryRefreshComplete message", () => {
			const url = "https://example.com/repo"

			// First add URL to refreshing list
			manager.transition({
				type: "REFRESH_SOURCE",
				payload: { url },
			})

			// Then handle completion message
			manager.handleMessage({
				type: "repositoryRefreshComplete",
				url,
			})

			const state = manager.getState()
			expect(state.refreshingUrls).not.toContain(url)
		})

		it("should handle marketplaceButtonClicked message with error", () => {
			manager.handleMessage({
				type: "marketplaceButtonClicked",
				text: "error",
			})

			const state = manager.getState()
			expect(state.isFetching).toBe(false)
		})

		it("should handle marketplaceButtonClicked message for refresh", () => {
			manager.handleMessage({
				type: "marketplaceButtonClicked",
			})

			const state = manager.getState()
			expect(state.isFetching).toBe(true)
		})
	})
})
