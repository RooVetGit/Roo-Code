import { useState, useEffect, useRef, useCallback } from "react"
import { HistoryItem, HistorySearchOptions, HistorySortOption, HistorySearchResultItem } from "@roo-code/types"
import { vscode } from "@src/utils/vscode"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { highlightFzfMatch } from "@/utils/highlight"

export const useTaskSearch = (options: HistorySearchOptions = {}) => {
	const { cwd } = useExtensionState()
	const [tasks, setTasks] = useState<(HistoryItem & { highlight?: string })[]>([])
	const [loading, setLoading] = useState(true)
	const [searchQuery, setSearchQuery] = useState(options.searchQuery || "")
	const [pendingSearchQuery, setPendingSearchQuery] = useState(options.searchQuery || "")
	const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
	const previousTasksRef = useRef<(HistoryItem & { highlight?: string })[]>([])
	const [sortOption, setSortOption] = useState<HistorySortOption>(options.sortOption || "newest")
	const [lastNonRelevantSort, setLastNonRelevantSort] = useState<HistorySortOption | null>("newest")
	const [showAllWorkspaces, setShowAllWorkspaces] = useState(options.showAllWorkspaces || false)

	// Debounced search query setter
	const debouncedSetSearchQuery = useCallback((query: string) => {
		if (searchTimeoutRef.current) {
			clearTimeout(searchTimeoutRef.current)
		}

		setPendingSearchQuery(query)

		searchTimeoutRef.current = setTimeout(() => {
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
		// Always set loading to true on initial render
		// or if we've never fetched results before
		if (tasks.length === 0) {
			setLoading(true)
		}

		// Store current tasks as previous
		previousTasksRef.current = tasks

		const handler = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "historyItems") {
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

				// Atomic update - no flickering
				setTasks(processedItems)
				setLoading(false)
			}
		}

		window.addEventListener("message", handler)

		// Listen for task deletion confirmation and refresh the list
		const deletionHandler = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "taskDeletedConfirmation") {
				console.log("Task deletion confirmed, refreshing list...")

				// Refresh the task list without showing loading state
				vscode.postMessage({
					type: "getHistoryItems",
					historySearchOptions: {
						searchQuery,
						sortOption,
						workspacePath: showAllWorkspaces ? undefined : cwd,
						limit: options.limit,
					},
				})
			}
		}

		window.addEventListener("message", deletionHandler)

		// Always send the initial request
		// Construct search options
		const searchOptions: HistorySearchOptions = {
			searchQuery,
			sortOption,
			workspacePath: showAllWorkspaces ? undefined : cwd,
			limit: options.limit,
		}

		vscode.postMessage({
			type: "getHistoryItems",
			historySearchOptions: searchOptions,
		})

		return () => {
			window.removeEventListener("message", handler)
			window.removeEventListener("message", deletionHandler)
		}
		// Intentionally excluding tasks from deps to prevent infinite loop and flickering
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchQuery, sortOption, showAllWorkspaces, cwd, options.limit])

	return {
		tasks,
		loading,
		searchQuery: pendingSearchQuery, // Return the pending query for immediate UI feedback
		setSearchQuery: debouncedSetSearchQuery,
		sortOption,
		setSortOption,
		lastNonRelevantSort,
		setLastNonRelevantSort,
		showAllWorkspaces,
		setShowAllWorkspaces,
	}
}
