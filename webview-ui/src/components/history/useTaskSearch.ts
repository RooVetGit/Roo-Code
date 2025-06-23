import { useState, useEffect, useRef, useCallback } from "react"
import {
	HistoryItem,
	HistorySearchOptions,
	HistorySortOption,
	HistorySearchResultItem,
	HistoryWorkspaceItem,
} from "@roo-code/types"
import { vscode } from "@src/utils/vscode"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { highlightFzfMatch } from "@/utils/highlight"

// Static counter for generating unique request IDs
let nextRequestId = 1

export const useTaskSearch = (options: HistorySearchOptions = {}) => {
	const { cwd } = useExtensionState()
	const [tasks, setTasks] = useState<(HistoryItem & { highlight?: string })[]>([])
	const [loading, setLoading] = useState(true)
	const [isSearching, setIsSearching] = useState(false) // New state for tracking search in progress
	const [searchQuery, setSearchQuery] = useState(options.searchQuery || "")
	const [pendingSearchQuery, setPendingSearchQuery] = useState(options.searchQuery || "")
	const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
	const previousTasksRef = useRef<(HistoryItem & { highlight?: string })[]>([])
	const [sortOption, setSortOption] = useState<HistorySortOption>(options.sortOption || "newest")
	const [lastNonRelevantSort, setLastNonRelevantSort] = useState<HistorySortOption | null>("newest")
	const [workspaceItems, setWorkspaceItems] = useState<HistoryWorkspaceItem[]>([])
	const [workspacePath, setWorkspacePath] = useState<string | undefined>(options.workspacePath)
	const [resultLimit, setResultLimit] = useState<number | undefined>(options.limit)
	const currentRequestId = useRef<string>("")

	// Wrap state setters to set loading state when values change
	const setWorkspacePathWithLoading = useCallback(
		(path: string) => {
			if (path !== workspacePath) {
				setLoading(true)
			}
			setWorkspacePath(path)
		},
		[workspacePath],
	)

	const setResultLimitWithLoading = useCallback((limit: number | undefined) => {
		setLoading(true)
		setResultLimit(limit)
	}, [])

	// Debounced search query setter
	const debouncedSetSearchQuery = useCallback((query: string) => {
		if (searchTimeoutRef.current) {
			clearTimeout(searchTimeoutRef.current)
		}

		setPendingSearchQuery(query)

		searchTimeoutRef.current = setTimeout(() => {
			if (query) {
				setIsSearching(true) // Set searching to true when a new search query is submitted
			}
			setSearchQuery(query)
		}, 125) // 125ms debounce
	}, [])

	// Handle automatic sort switching for relevance
	useEffect(() => {
		if (searchQuery && sortOption !== "mostRelevant" && !lastNonRelevantSort) {
			setLastNonRelevantSort(sortOption)
			setSortOption("mostRelevant")
		} else if (!searchQuery && sortOption === "mostRelevant" && lastNonRelevantSort) {
			setSortOption(lastNonRelevantSort)
			setLastNonRelevantSort(null)
		}
	}, [searchQuery, sortOption, lastNonRelevantSort])
	useEffect(() => {
		// Set loading to true on initial render
		// or if we've never fetched results before
		if (tasks.length === 0 && !loading) {
			setLoading(true)
		}

		// Store current tasks as previous
		previousTasksRef.current = tasks

		const handler = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "historyItems" && message.requestId === currentRequestId.current) {
				// Process the items to add highlight HTML based on match positions
				const processedItems = (message.items || []).map((item: HistorySearchResultItem) => {
					if (item.match?.positions) {
						return {
							...item,
							highlight: highlightFzfMatch(item.task, item.match.positions),
						}
					}
					return item
				})

				// Update workspace items if provided
				if (message.workspaceItems && Array.isArray(message.workspaceItems)) {
					setWorkspaceItems(message.workspaceItems)
				} else {
					console.error("No workspaceItems in message:", message)
				}

				// Atomic update - no flickering
				setTasks(processedItems)
				setLoading(false)
				setIsSearching(false) // Set searching to false when results are received
			}
		}

		window.addEventListener("message", handler)

		// Listen for task deletion confirmation and refresh the list
		const deletionHandler = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "taskDeletedConfirmation") {
				console.log("Task deletion confirmed, refreshing list...")

				// Refresh the task list without showing loading state
				// Generate a new request ID for this search
				const refreshRequestId = `search_${nextRequestId++}`
				currentRequestId.current = refreshRequestId

				vscode.postMessage({
					type: "getHistoryItems",
					historySearchOptions: searchOptions,
					requestId: refreshRequestId,
				})
			}
		}

		window.addEventListener("message", deletionHandler)

		// Always send the initial request
		// Construct search options
		const searchOptions: HistorySearchOptions = {
			searchQuery,
			sortOption,
			// If workspacePath is undefined, so current workspace
			// Otherwise, use the specified workspacePath
			workspacePath,
			limit: resultLimit,
		}

		// Generate a new request ID for this search
		const requestId = `search_${nextRequestId++}`
		currentRequestId.current = requestId

		vscode.postMessage({
			type: "getHistoryItems",
			historySearchOptions: searchOptions,
			requestId,
		})

		return () => {
			window.removeEventListener("message", handler)
			window.removeEventListener("message", deletionHandler)
		}
		// Intentionally excluding tasks from deps to prevent infinite loop and flickering
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchQuery, sortOption, workspacePath, cwd, resultLimit])

	return {
		tasks,
		loading,
		isSearching,
		searchQuery: pendingSearchQuery, // Return the pending query for immediate UI feedback
		setSearchQuery: debouncedSetSearchQuery,
		sortOption,
		setSortOption,
		lastNonRelevantSort,
		setLastNonRelevantSort,
		workspaceItems,
		workspacePath,
		setWorkspacePath: setWorkspacePathWithLoading,
		resultLimit,
		setResultLimit: setResultLimitWithLoading,
	}
}
