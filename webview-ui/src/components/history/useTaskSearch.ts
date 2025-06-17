import { useState, useEffect } from "react"
import { HistoryItem, HistorySearchOptions, HistorySortOption } from "@roo-code/types"
import { vscode } from "@src/utils/vscode"
import { useExtensionState } from "@/context/ExtensionStateContext"

export const useTaskSearch = (options: HistorySearchOptions = {}) => {
	const { cwd } = useExtensionState()
	const [tasks, setTasks] = useState<HistoryItem[]>([])
	const [loading, setLoading] = useState(true)
	const [searchQuery, setSearchQuery] = useState(options.searchQuery || "")
	const [sortOption, setSortOption] = useState<HistorySortOption>(options.sortOption || "newest")
	const [lastNonRelevantSort, setLastNonRelevantSort] = useState<HistorySortOption | null>("newest")
	const [showAllWorkspaces, setShowAllWorkspaces] = useState(options.showAllWorkspaces || false)

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
		setLoading(true)
		const handler = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "historyItems") {
				setTasks(message.items || [])
				setLoading(false)
				window.removeEventListener("message", handler)
			}
		}

		window.addEventListener("message", handler)

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
		}
	}, [searchQuery, sortOption, showAllWorkspaces, cwd, options.limit])

	return {
		tasks,
		loading,
		searchQuery,
		setSearchQuery,
		sortOption,
		setSortOption,
		lastNonRelevantSort,
		setLastNonRelevantSort,
		showAllWorkspaces,
		setShowAllWorkspaces,
	}
}
