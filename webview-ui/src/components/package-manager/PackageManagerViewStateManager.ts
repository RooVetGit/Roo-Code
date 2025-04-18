import { PackageManagerItem, PackageManagerSource, MatchInfo } from "../../../../src/services/package-manager/types"
import { vscode } from "../../utils/vscode"
import { WebviewMessage } from "../../../../src/shared/WebviewMessage"
import { DEFAULT_PACKAGE_MANAGER_SOURCE } from "../../../../src/services/package-manager/constants"

export interface ViewState {
	allItems: PackageManagerItem[]
	displayItems?: PackageManagerItem[] // Items currently being displayed (filtered or all)
	isFetching: boolean
	activeTab: "browse" | "sources"
	refreshingUrls: string[]
	sources: PackageManagerSource[]
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

type TransitionPayloads = {
	FETCH_ITEMS: undefined
	FETCH_COMPLETE: { items: PackageManagerItem[] }
	FETCH_ERROR: undefined
	SET_ACTIVE_TAB: { tab: ViewState["activeTab"] }
	UPDATE_FILTERS: { filters: Partial<ViewState["filters"]> }
	UPDATE_SORT: { sortConfig: Partial<ViewState["sortConfig"]> }
	REFRESH_SOURCE: { url: string }
	REFRESH_SOURCE_COMPLETE: { url: string }
	UPDATE_SOURCES: { sources: PackageManagerSource[] }
}

export interface ViewStateTransition {
	type: keyof TransitionPayloads
	payload?: TransitionPayloads[keyof TransitionPayloads]
}

export type StateChangeHandler = (state: ViewState) => void

export class PackageManagerViewStateManager {
	private state: ViewState = this.loadInitialState()

	private loadInitialState(): ViewState {
		// Try to restore state from sessionStorage if available
		if (typeof sessionStorage !== "undefined") {
			const savedState = sessionStorage.getItem("packageManagerState")
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
			displayItems: [] as PackageManagerItem[],
			isFetching: false,
			activeTab: "browse",
			refreshingUrls: [],
			sources: [DEFAULT_PACKAGE_MANAGER_SOURCE],
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
	private fetchTimeoutId?: NodeJS.Timeout
	private readonly FETCH_TIMEOUT = 30000 // 30 seconds
	private stateChangeHandlers: Set<StateChangeHandler> = new Set()
	private sourcesModified = false // Track if sources have been modified

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
			type: "packageManagerSources",
			sources: [DEFAULT_PACKAGE_MANAGER_SOURCE],
		} as WebviewMessage)
	}

	public onStateChange(handler: StateChangeHandler): () => void {
		this.stateChangeHandlers.add(handler)
		return () => this.stateChangeHandlers.delete(handler)
	}

	public cleanup(): void {
		// Clear any pending timeouts
		if (this.fetchTimeoutId) {
			clearTimeout(this.fetchTimeoutId)
			this.fetchTimeoutId = undefined
		}

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
		const displayItems = this.state.displayItems?.length ? [...this.state.displayItems] : this.state.displayItems
		const refreshingUrls = this.state.refreshingUrls.length ? [...this.state.refreshingUrls] : []
		const tags = this.state.filters.tags.length ? [...this.state.filters.tags] : []

		// Create minimal new state object
		return {
			...this.state,
			allItems: this.state.allItems.length ? [...this.state.allItems] : [],
			displayItems,
			refreshingUrls,
			sources: this.state.sources.length ? [...this.state.sources] : [DEFAULT_PACKAGE_MANAGER_SOURCE],
			filters: {
				...this.state.filters,
				tags,
			},
		}
	}

	private notifyStateChange(): void {
		const newState = this.getState() // Use getState to ensure proper copying
		this.stateChangeHandlers.forEach((handler) => {
			handler(newState)
		})

		// Save state to sessionStorage if available
		if (typeof sessionStorage !== "undefined") {
			try {
				sessionStorage.setItem("packageManagerState", JSON.stringify(this.state))
			} catch (error) {
				console.warn("Failed to save package manager state:", error)
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

				// Clear any existing timeout
				this.clearFetchTimeout()

				// Send fetch request
				vscode.postMessage({
					type: "fetchPackageManagerItems",
					bool: true,
				} as WebviewMessage)

				// Update state after sending request
				this.state = {
					...this.state,
					isFetching: true,
					allItems: [], // Clear items when starting new fetch
					displayItems: [],
				}
				this.notifyStateChange()

				// Set timeout to reset state if fetch takes too long
				this.fetchTimeoutId = setTimeout(() => {
					this.clearFetchTimeout()
					this.state = {
						...this.getDefaultState(),
						sources: [...this.state.sources],
						activeTab: this.state.activeTab,
					}
					this.notifyStateChange()
				}, this.FETCH_TIMEOUT)

				break
			}

			case "FETCH_COMPLETE": {
				const { items } = transition.payload as TransitionPayloads["FETCH_COMPLETE"]
				// Clear any existing timeout
				this.clearFetchTimeout()

				// Always update allItems as source of truth
				const sortedItems = this.sortItems([...items])
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
				this.clearFetchTimeout()

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

				// Update tab first
				this.state = {
					...this.state,
					activeTab: tab,
				}

				// Handle sources tab
				if (tab === "sources" && this.state.sources.length === 0) {
					this.state = {
						...this.state,
						sources: [DEFAULT_PACKAGE_MANAGER_SOURCE],
					}
					vscode.postMessage({
						type: "packageManagerSources",
						sources: [DEFAULT_PACKAGE_MANAGER_SOURCE],
					} as WebviewMessage)
				}

				// Handle browse tab
				if (tab === "browse") {
					// Clear any existing timeouts
					this.clearFetchTimeout()

					// Start fetch if needed
					if (this.sourcesModified || this.state.allItems.length === 0) {
						this.sourcesModified = false
						this.state = {
							...this.state,
							isFetching: true,
						}
						this.notifyStateChange()
						vscode.postMessage({
							type: "fetchPackageManagerItems",
							bool: true,
						} as WebviewMessage)
						return
					}

					// Otherwise just update display items
					if (this.state.allItems.length > 0) {
						this.state = {
							...this.state,
							displayItems: this.isFilterActive()
								? this.filterItems(this.state.allItems)
								: [...this.state.allItems],
						}
					}
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
					type: "filterPackageManagerItems",
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
						type: "refreshPackageManagerSource",
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
				const updatedSources = sources.length === 0 ? [DEFAULT_PACKAGE_MANAGER_SOURCE] : [...sources]
				this.state = {
					...this.state,
					sources: updatedSources,
					isFetching: false, // Reset fetching state first
				}
				this.sourcesModified = true // Set the flag when sources are modified

				this.notifyStateChange()

				// Send sources update to extension
				vscode.postMessage({
					type: "packageManagerSources",
					sources: updatedSources,
				} as WebviewMessage)

				// Only start fetching if we have sources
				if (updatedSources.length > 0) {
					// Set fetching state and notify
					this.state = {
						...this.state,
						isFetching: true,
					}
					this.notifyStateChange()

					// Send fetch request
					vscode.postMessage({
						type: "fetchPackageManagerItems",
						bool: true,
					} as WebviewMessage)
				}
				break
			}
		}
	}

	private clearFetchTimeout(): void {
		// Clear fetch timeout
		if (this.fetchTimeoutId) {
			clearTimeout(this.fetchTimeoutId)
			this.fetchTimeoutId = undefined
		}
	}

	public isFilterActive(): boolean {
		return !!(this.state.filters.type || this.state.filters.search || this.state.filters.tags.length > 0)
	}

	public filterItems(items: PackageManagerItem[]): PackageManagerItem[] {
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
			.filter((item): item is PackageManagerItem => item !== null)
	}

	private sortItems(items: PackageManagerItem[]): PackageManagerItem[] {
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
			if (message.state.sources || message.state.packageManagerSources) {
				const sources = message.state.packageManagerSources || message.state.sources
				this.state = {
					...this.state,
					sources: sources?.length > 0 ? [...sources] : [DEFAULT_PACKAGE_MANAGER_SOURCE],
				}
				this.notifyStateChange()
			}

			// Update items if present
			if (message.state.packageManagerItems) {
				this.state = {
					...this.state,
					isFetching: false,
				}
				this.notifyStateChange()

				void this.transition({
					type: "FETCH_COMPLETE",
					payload: { items: message.state.packageManagerItems },
				})
			}
		}

		// Handle repository refresh completion
		if (message.type === "repositoryRefreshComplete" && message.url) {
			void this.transition({
				type: "REFRESH_SOURCE_COMPLETE",
				payload: { url: message.url },
			})
		}

		// Handle package manager button clicks
		if (message.type === "packageManagerButtonClicked") {
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
