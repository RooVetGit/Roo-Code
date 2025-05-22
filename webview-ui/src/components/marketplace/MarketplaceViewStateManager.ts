/**
 * MarketplaceViewStateManager
 *
 * This class manages the state for the marketplace view in the Roo Code extensions interface.
 *
 * IMPORTANT: Fixed issue where the marketplace feature was causing the Roo Code extensions interface
 * to switch to the browse tab and redraw it every 30 seconds. The fix prevents unnecessary tab switching
 * and redraws by:
 * 1. Only updating the UI when necessary
 * 2. Preserving the current tab when handling timeouts
 * 3. Using minimal state updates to avoid resetting scroll position
 */

import { MarketplaceItem, MarketplaceSource, MatchInfo } from "../../../../src/services/marketplace/types"
import { vscode } from "../../utils/vscode"
import { WebviewMessage } from "../../../../src/shared/WebviewMessage"
import { DEFAULT_MARKETPLACE_SOURCE } from "../../../../src/services/marketplace/constants"
import { FullInstallatedMetadata } from "../../../../src/services/marketplace/InstalledMetadataManager"

export interface ViewState {
	allItems: MarketplaceItem[]
	displayItems?: MarketplaceItem[] // Items currently being displayed (filtered or all)
	isFetching: boolean
	activeTab: "browse" | "installed" | "settings"
	refreshingUrls: string[]
	sources: MarketplaceSource[]
	installedMetadata: FullInstallatedMetadata
	filters: {
		type: string
		search: string
		tags: string[]
	}
	sortConfig: {
		by: "name" | "author" | "lastUpdated"
		order: "asc" | "desc"
	}
}

// Define a default empty metadata structure
const defaultInstalledMetadata: FullInstallatedMetadata = {
	project: {},
	global: {},
}

type TransitionPayloads = {
	FETCH_ITEMS: undefined
	FETCH_COMPLETE: { items: MarketplaceItem[] }
	FETCH_ERROR: undefined
	SET_ACTIVE_TAB: { tab: ViewState["activeTab"] }
	UPDATE_FILTERS: { filters: Partial<ViewState["filters"]> }
	UPDATE_SORT: { sortConfig: Partial<ViewState["sortConfig"]> }
	REFRESH_SOURCE: { url: string }
	REFRESH_SOURCE_COMPLETE: { url: string }
	UPDATE_SOURCES: { sources: MarketplaceSource[] }
}

export interface ViewStateTransition {
	type: keyof TransitionPayloads
	payload?: TransitionPayloads[keyof TransitionPayloads]
}

export type StateChangeHandler = (state: ViewState) => void

export class MarketplaceViewStateManager {
	private state: ViewState = this.loadInitialState()

	private loadInitialState(): ViewState {
		// Try to restore state from sessionStorage if available
		if (typeof sessionStorage !== "undefined") {
			const savedState = sessionStorage.getItem("marketplaceState")
			if (savedState) {
				try {
					return JSON.parse(savedState)
				} catch {
					return this.getDefaultState()
				}
			}
		}
		return this.getDefaultState()
	}

	private getDefaultState(): ViewState {
		return {
			allItems: [],
			displayItems: [] as MarketplaceItem[],
			isFetching: false,
			activeTab: "browse",
			refreshingUrls: [],
			sources: [DEFAULT_MARKETPLACE_SOURCE],
			installedMetadata: defaultInstalledMetadata,
			filters: {
				type: "",
				search: "",
				tags: [],
			},
			sortConfig: {
				by: "name",
				order: "asc",
			},
		}
	}
	// Removed auto-polling timeout
	private stateChangeHandlers: Set<StateChangeHandler> = new Set()

	// Empty constructor is required for test initialization
	// eslint-disable-next-line @typescript-eslint/no-useless-constructor
	constructor() {
		// Initialize is now handled by the loadInitialState call in the property initialization
	}

	public initialize(): void {
		// Set initial state
		this.state = this.getDefaultState()

		// Send initial sources to extension
		vscode.postMessage({
			type: "marketplaceSources",
			sources: [DEFAULT_MARKETPLACE_SOURCE],
		} as WebviewMessage)
	}

	public onStateChange(handler: StateChangeHandler): () => void {
		this.stateChangeHandlers.add(handler)
		return () => this.stateChangeHandlers.delete(handler)
	}

	public cleanup(): void {
		// Reset fetching state
		if (this.state.isFetching) {
			this.state.isFetching = false
			this.notifyStateChange()
		}

		// Clear handlers but preserve state
		this.stateChangeHandlers.clear()
	}

	public getState(): ViewState {
		// Only create new arrays if they exist and have items
		const allItems = this.state.allItems.length ? [...this.state.allItems] : []
		const displayItems = this.state.displayItems?.length ? [...this.state.displayItems] : this.state.displayItems
		const refreshingUrls = this.state.refreshingUrls.length ? [...this.state.refreshingUrls] : []
		const tags = this.state.filters.tags.length ? [...this.state.filters.tags] : []
		const sources = this.state.sources.length ? [...this.state.sources] : [DEFAULT_MARKETPLACE_SOURCE]
		const installedMetadata = this.state.installedMetadata

		// Create minimal new state object
		return {
			...this.state,
			allItems,
			displayItems,
			refreshingUrls,
			sources,
			installedMetadata,
			filters: {
				...this.state.filters,
				tags,
			},
		}
	}

	/**
	 * Notify all registered handlers of a state change
	 * @param preserveTab If true, ensures the active tab is not changed during notification
	 */
	private notifyStateChange(preserveTab: boolean = false): void {
		const newState = this.getState() // Use getState to ensure proper copying

		if (preserveTab) {
			// When preserveTab is true, we're careful not to cause tab switching
			// This is used during timeout handling to prevent disrupting the user
			this.stateChangeHandlers.forEach((handler) => {
				// Store the current active tab
				const currentTab = newState.activeTab

				// Create a state update that won't change the active tab
				const safeState = {
					...newState,
					// Don't change these properties to avoid UI disruption
					activeTab: currentTab,
				}
				handler(safeState)
			})
		} else {
			// Normal state change notification
			this.stateChangeHandlers.forEach((handler) => {
				handler(newState)
			})
		}

		// Save state to sessionStorage if available
		if (typeof sessionStorage !== "undefined") {
			try {
				sessionStorage.setItem("marketplaceState", JSON.stringify(this.state))
			} catch (error) {
				console.warn("Failed to save marketplace state:", error)
			}
		}
	}

	public async transition(transition: ViewStateTransition): Promise<void> {
		switch (transition.type) {
			case "FETCH_ITEMS": {
				// Don't start a new fetch if one is in progress
				if (this.state.isFetching) {
					return
				}

				// Send fetch request
				vscode.postMessage({
					type: "fetchMarketplaceItems",
				} as WebviewMessage)

				// Store current items before updating state
				const currentItems = this.state.allItems.length ? [...this.state.allItems] : []

				// Update state after sending request
				this.state = {
					...this.state,
					isFetching: true,
					allItems: currentItems,
					displayItems: currentItems,
				}
				this.notifyStateChange()

				break
			}

			case "FETCH_COMPLETE": {
				const { items } = transition.payload as TransitionPayloads["FETCH_COMPLETE"]
				// No timeout to clear anymore

				// Sort incoming items
				const sortedItems = this.sortItems([...items])

				// Compare with current state to avoid unnecessary updates
				const currentSortedItems = this.sortItems([...this.state.allItems])
				if (JSON.stringify(sortedItems) === JSON.stringify(currentSortedItems)) {
					// No changes: update only isFetching flag and send minimal update
					this.state.isFetching = false
					this.stateChangeHandlers.forEach((handler) => {
						handler({
							...this.getState(),
							isFetching: false,
						})
					})
					break
				}

				// Update allItems as source of truth
				this.state = {
					...this.state,
					allItems: sortedItems,
					displayItems: this.isFilterActive() ? this.filterItems(sortedItems) : sortedItems,
					isFetching: false,
				}

				// Notify state change
				this.notifyStateChange()
				break
			}

			case "FETCH_ERROR": {
				// Preserve current filters and sources
				const { filters, sources, activeTab } = this.state

				// Reset state but preserve filters and sources
				this.state = {
					...this.getDefaultState(),
					filters,
					sources,
					activeTab,
					isFetching: false,
				}
				this.notifyStateChange()
				break
			}

			case "SET_ACTIVE_TAB": {
				const { tab } = transition.payload as TransitionPayloads["SET_ACTIVE_TAB"]

				// Update tab state
				this.state = {
					...this.state,
					activeTab: tab,
				}

				// If switching to browse or installed tab, trigger fetch
				if (tab === "browse" || tab === "installed") {
					this.state.isFetching = true

					vscode.postMessage({
						type: "fetchMarketplaceItems",
					} as WebviewMessage)
				}

				this.notifyStateChange()
				break
			}

			case "UPDATE_FILTERS": {
				const { filters = {} } = (transition.payload as TransitionPayloads["UPDATE_FILTERS"]) || {}

				// Create new filters object preserving existing values for undefined fields
				const updatedFilters = {
					type: filters.type !== undefined ? filters.type : this.state.filters.type,
					search: filters.search !== undefined ? filters.search : this.state.filters.search,
					tags: filters.tags !== undefined ? filters.tags : this.state.filters.tags,
				}

				// Update state
				this.state = {
					...this.state,
					filters: updatedFilters,
				}

				// Send filter message
				vscode.postMessage({
					type: "filterMarketplaceItems",
					filters: updatedFilters,
				} as WebviewMessage)

				this.notifyStateChange()

				break
			}

			case "UPDATE_SORT": {
				const { sortConfig } = transition.payload as TransitionPayloads["UPDATE_SORT"]
				// Create new state with updated sort config
				this.state = {
					...this.state,
					sortConfig: {
						...this.state.sortConfig,
						...sortConfig,
					},
				}
				// Apply sorting to both allItems and displayItems
				// Sort items immutably
				// Create new sorted arrays
				const sortedAllItems = this.sortItems([...this.state.allItems])
				const sortedDisplayItems = this.state.displayItems?.length
					? this.sortItems([...this.state.displayItems])
					: this.state.displayItems

				this.state = {
					...this.state,
					allItems: sortedAllItems,
					displayItems: sortedDisplayItems,
				}
				this.notifyStateChange()
				break
			}

			case "REFRESH_SOURCE": {
				const { url } = transition.payload as TransitionPayloads["REFRESH_SOURCE"]
				if (!this.state.refreshingUrls.includes(url)) {
					this.state = {
						...this.state,
						refreshingUrls: [...this.state.refreshingUrls, url],
					}
					this.notifyStateChange()
					vscode.postMessage({
						type: "refreshMarketplaceSource",
						url,
					} as WebviewMessage)
				}
				break
			}

			case "REFRESH_SOURCE_COMPLETE": {
				const { url } = transition.payload as TransitionPayloads["REFRESH_SOURCE_COMPLETE"]
				this.state = {
					...this.state,
					refreshingUrls: this.state.refreshingUrls.filter((existingUrl) => existingUrl !== url),
				}
				this.notifyStateChange()
				break
			}

			case "UPDATE_SOURCES": {
				const { sources } = transition.payload as TransitionPayloads["UPDATE_SOURCES"]
				// If all sources are removed, add the default source
				const updatedSources = sources.length === 0 ? [DEFAULT_MARKETPLACE_SOURCE] : [...sources]

				this.state = {
					...this.state,
					sources: updatedSources,
					isFetching: false, // Reset fetching state
				}

				this.notifyStateChange()

				// Send sources update to extension
				vscode.postMessage({
					type: "marketplaceSources",
					sources: updatedSources,
				} as WebviewMessage)

				// If we're on the browse tab, trigger a fetch
				if (this.state.activeTab === "browse") {
					this.state.isFetching = true
					this.notifyStateChange()

					vscode.postMessage({
						type: "fetchMarketplaceItems",
					} as WebviewMessage)
				}
				break
			}
		}
	}

	public isFilterActive(): boolean {
		return !!(this.state.filters.type || this.state.filters.search || this.state.filters.tags.length > 0)
	}

	public filterItems(items: MarketplaceItem[]): MarketplaceItem[] {
		const { type, search, tags } = this.state.filters

		return items
			.map((item) => {
				// Create a copy of the item to modify
				const itemCopy = { ...item }

				// Check specific match conditions for the main item
				const typeMatch = !type || item.type === type
				const nameMatch = search ? item.name.toLowerCase().includes(search.toLowerCase()) : false
				const descriptionMatch = search
					? (item.description || "").toLowerCase().includes(search.toLowerCase())
					: false
				const tagMatch = tags.length > 0 ? item.tags?.some((tag) => tags.includes(tag)) : false

				// Determine if the main item matches all filters
				const mainItemMatches =
					typeMatch && (!search || nameMatch || descriptionMatch) && (!tags.length || tagMatch)

				// For packages, check and mark matching subcomponents
				if (item.type === "package" && item.items?.length) {
					itemCopy.items = item.items.map((subItem) => {
						// Check specific match conditions for subitem
						const subTypeMatch = !type || subItem.type === type
						const subNameMatch =
							search && subItem.metadata
								? subItem.metadata.name.toLowerCase().includes(search.toLowerCase())
								: false
						const subDescriptionMatch =
							search && subItem.metadata
								? subItem.metadata.description.toLowerCase().includes(search.toLowerCase())
								: false
						const subTagMatch =
							tags.length > 0 ? Boolean(subItem.metadata?.tags?.some((tag) => tags.includes(tag))) : false

						const subItemMatches =
							subTypeMatch &&
							(!search || subNameMatch || subDescriptionMatch) &&
							(!tags.length || subTagMatch)

						// Ensure all match properties are booleans
						const matchInfo: MatchInfo = {
							matched: Boolean(subItemMatches),
							matchReason: subItemMatches
								? {
										typeMatch: Boolean(subTypeMatch),
										nameMatch: Boolean(subNameMatch),
										descriptionMatch: Boolean(subDescriptionMatch),
										tagMatch: Boolean(subTagMatch),
									}
								: undefined,
						}

						return {
							...subItem,
							matchInfo,
						}
					})
				}

				const hasMatchingSubcomponents = itemCopy.items?.some((subItem) => subItem.matchInfo?.matched)

				// Set match info on the main item
				itemCopy.matchInfo = {
					matched: mainItemMatches || Boolean(hasMatchingSubcomponents),
					matchReason: {
						typeMatch,
						nameMatch,
						descriptionMatch,
						tagMatch,
						hasMatchingSubcomponents: Boolean(hasMatchingSubcomponents),
					},
				}

				// Return the item if it matches or has matching subcomponents
				if (itemCopy.matchInfo.matched) {
					return itemCopy
				}

				return null
			})
			.filter((item): item is MarketplaceItem => item !== null)
	}

	private sortItems(items: MarketplaceItem[]): MarketplaceItem[] {
		const { by, order } = this.state.sortConfig
		const itemsCopy = [...items]

		return itemsCopy.sort((a, b) => {
			const aValue = by === "lastUpdated" ? a[by] || "1970-01-01T00:00:00Z" : a[by] || ""
			const bValue = by === "lastUpdated" ? b[by] || "1970-01-01T00:00:00Z" : b[by] || ""

			return order === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
		})
	}

	public async handleMessage(message: any): Promise<void> {
		// Handle empty or invalid message
		if (!message || !message.type || message.type === "invalidType") {
			const { sources } = this.state
			this.state = {
				...this.getDefaultState(),
				sources: [...sources],
			}
			this.notifyStateChange()
			return
		}

		// Handle state updates
		if (message.type === "state") {
			// Handle empty state
			if (!message.state) {
				const { sources } = this.state
				this.state = {
					...this.getDefaultState(),
					sources: [...sources],
				}
				this.notifyStateChange()
				return
			}

			// Update sources if present
			const sources = message.state.marketplaceSources || message.state.sources
			if (sources) {
				this.state = {
					...this.state,
					sources: sources.length > 0 ? [...sources] : [DEFAULT_MARKETPLACE_SOURCE],
				}
				// Don't notify yet, combine with other state updates below
			}

			// Update installedMetadata if present
			const installedMetadata = message.state.marketplaceInstalledMetadata
			if (installedMetadata) {
				this.state = {
					...this.state,
					installedMetadata,
				}
				// Don't notify yet
			}

			// Handle state updates for marketplace items
			// The state.marketplaceItems come from ClineProvider, see the file src/core/webview/ClineProvider.ts
			const marketplaceItems = message.state.marketplaceItems
			if (marketplaceItems !== undefined) {
				const currentItems = this.state.allItems || []
				const hasNewItems = marketplaceItems.length > 0
				const hasCurrentItems = currentItems.length > 0
				const isOnBrowseTab = this.state.activeTab === "browse"

				// Determine which items to use
				const itemsToUse = hasNewItems ? marketplaceItems : isOnBrowseTab && hasCurrentItems ? currentItems : []
				const sortedItems = this.sortItems([...itemsToUse])
				const newDisplayItems = this.isFilterActive() ? this.filterItems(sortedItems) : sortedItems

				// Update state in a single operation
				this.state = {
					...this.state,
					isFetching: false,
					allItems: sortedItems,
					displayItems: newDisplayItems,
				}
				// Notification is handled below after all state parts are processed
			}

			// Notify state change once after processing all parts (sources, metadata, items)
			// This prevents multiple redraws for a single 'state' message
			// Determine if notification should preserve tab based on item update logic
			const isOnBrowseTab = this.state.activeTab === "browse"
			const hasCurrentItems = (this.state.allItems || []).length > 0
			const preserveTab = !isOnBrowseTab && hasCurrentItems

			this.notifyStateChange(preserveTab)
		}

		// Handle repository refresh completion
		if (message.type === "repositoryRefreshComplete" && message.url) {
			void this.transition({
				type: "REFRESH_SOURCE_COMPLETE",
				payload: { url: message.url },
			})
		}

		// Handle marketplace button clicks
		if (message.type === "marketplaceButtonClicked") {
			if (message.text) {
				// Error case
				void this.transition({ type: "FETCH_ERROR" })
			} else {
				// Refresh request
				void this.transition({ type: "FETCH_ITEMS" })
			}
		}
	}
}
