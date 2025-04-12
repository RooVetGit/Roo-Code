import { useState, useEffect, useMemo } from "react"
import { Fzf } from "fzf"

import { highlightFzfMatch } from "@/utils/highlight"
import { useExtensionState } from "@/context/ExtensionStateContext"

type SortOption = "newest" | "oldest" | "mostExpensive" | "mostTokens" | "mostRelevant"

export const useTaskSearch = () => {
	const { taskHistory, cwd } = useExtensionState()
	const [searchQuery, setSearchQuery] = useState("")
	const [sortOption, setSortOption] = useState<SortOption>("newest")
	const [lastNonRelevantSort, setLastNonRelevantSort] = useState<SortOption | null>("newest")
	const [showAllWorkspaces, setShowAllWorkspaces] = useState(false)

	useEffect(() => {
		if (searchQuery && sortOption !== "mostRelevant" && !lastNonRelevantSort) {
			setLastNonRelevantSort(sortOption)
			setSortOption("mostRelevant")
		} else if (!searchQuery && sortOption === "mostRelevant" && lastNonRelevantSort) {
			setSortOption(lastNonRelevantSort)
			setLastNonRelevantSort(null)
		}
	}, [searchQuery, sortOption, lastNonRelevantSort])

	const presentableTasks = useMemo(() => {
		return taskHistory.filter((item) => item.ts && item.task)
	}, [taskHistory])

	const fzf = useMemo(() => {
		return new Fzf(presentableTasks, {
			selector: (item) => `${item.task} ${item.workspace || ""}`,
		})
	}, [presentableTasks])

	const tasks = useMemo(() => {
		// First filter by workspace if enabled
		let results = showAllWorkspaces ? presentableTasks : presentableTasks.filter((item) => item.workspace === cwd)

		if (searchQuery) {
			const searchResults = fzf.find(searchQuery)
			results = searchResults
				.map((result) => {
					const positions = Array.from(result.positions)
					const taskEndIndex = result.item.task.length

					return {
						...result.item,
						task: highlightFzfMatch(
							result.item.task,
							positions.filter((p) => p < taskEndIndex),
						),
						workspace: result.item.workspace
							? highlightFzfMatch(
									result.item.workspace,
									positions.filter((p) => p > taskEndIndex).map((p) => p - taskEndIndex - 1),
								)
							: undefined,
					}
				})
				.filter((item) => (showAllWorkspaces ? true : item.workspace === cwd))
		}

		// First apply search if needed
		const searchResults = results

		// Then sort the results
		return [...searchResults].sort((a, b) => {
			switch (sortOption) {
				case "oldest":
					return (a.ts || 0) - (b.ts || 0)
				case "mostExpensive":
					return (b.totalCost || 0) - (a.totalCost || 0)
				case "mostTokens":
					const aTokens = (a.tokensIn || 0) + (a.tokensOut || 0) + (a.cacheWrites || 0) + (a.cacheReads || 0)
					const bTokens = (b.tokensIn || 0) + (b.tokensOut || 0) + (b.cacheWrites || 0) + (b.cacheReads || 0)
					return bTokens - aTokens
				case "mostRelevant":
					// Keep fuse order if searching, otherwise sort by newest
					return searchQuery ? 0 : (b.ts || 0) - (a.ts || 0)
				case "newest":
				default:
					return (b.ts || 0) - (a.ts || 0)
			}
		})
	}, [presentableTasks, searchQuery, fzf, sortOption, showAllWorkspaces, cwd])

	return {
		tasks,
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
