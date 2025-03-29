import { useState, useEffect, useMemo } from "react"
import { Fzf } from "fzf"

import { highlightFzfMatch } from "@/utils/highlight"
import { useExtensionState } from "@/context/ExtensionStateContext"

type SortOption = "newest" | "oldest" | "mostExpensive" | "mostTokens" | "mostRelevant"

export const useTaskSearch = () => {
	const { taskHistory, cwd } = useExtensionState()
	const [searchQuery, setSearchQuery] = useState("")
	const [sortOption, setSortOption] = useState<SortOption>("newest")
	const [showCurrentWorkspaceOnly, setShowCurrentWorkspaceOnly] = useState(false)
	const [lastNonRelevantSort, setLastNonRelevantSort] = useState<SortOption | null>("newest")

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
			selector: (item) => {
				// Search across both task content and workspace
				const workspaceDisplay = item.workspace ?? ""
				return `${item.task} ${workspaceDisplay}`
			},
		})
	}, [presentableTasks])

	const tasks = useMemo(() => {
		// First filter by workspace if selected
		let filteredTasks = presentableTasks

		if (showCurrentWorkspaceOnly) {
			filteredTasks = filteredTasks.filter((item) => item.workspace === cwd)
		}

		// Then apply search if needed
		let results = filteredTasks
		if (searchQuery) {
			const searchResults = fzf.find(searchQuery)
			// Filter search results to match workspace filter
			const filteredSearchResults = searchResults.filter((result) =>
				filteredTasks.some((task) => task.id === result.item.id),
			)
			results = filteredSearchResults.map((result) => {
				const workspaceDisplay = result.item.workspace ?? "";
				const taskLength = result.item.task.length;
				
				// Filter positions to only include those within the task's range
				const taskPositions = Array.from(result.positions).filter(pos => pos < taskLength);
				
				// Filter positions for workspace and adjust them to be relative to workspace string
				const workspacePositions = Array.from(result.positions)
					.filter(pos => pos > taskLength) // +1 for the space
					.map(pos => pos - taskLength - 1); // -1 for the space
				
				return {
					...result.item,
					workspace: workspaceDisplay ? highlightFzfMatch(workspaceDisplay, workspacePositions) : "",
					task: highlightFzfMatch(result.item.task, taskPositions),
				};
			})
		}

		// Get final results
		const searchResults = searchQuery ? results : filteredTasks

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
	}, [presentableTasks, showCurrentWorkspaceOnly, searchQuery, cwd, fzf, sortOption])

	return {
		tasks,
		searchQuery,
		setSearchQuery,
		sortOption,
		setSortOption,
		lastNonRelevantSort,
		setLastNonRelevantSort,
		showCurrentWorkspaceOnly,
		setShowCurrentWorkspaceOnly,
	}
}
