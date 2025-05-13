import { useState, useEffect, useMemo } from "react"
import { Fzf } from "fzf"

import { highlightFzfMatch } from "@/utils/highlight"
import { useExtensionState } from "@/context/ExtensionStateContext"

type SortOption = "newest" | "oldest" | "mostExpensive" | "mostTokens" | "mostRelevant"
type WorkspaceFilterMode = "current" | "all" | "selected"

// Optional configuration for the hook
type UseTaskSearchConfig = {
	forceWorkspaceFilter?: WorkspaceFilterMode | null
}

export const useTaskSearch = (config?: UseTaskSearchConfig) => {
	const { taskHistory, cwd } = useExtensionState()
	const [searchQuery, setSearchQuery] = useState<string>("")
	const [sortOption, setSortOption] = useState<SortOption>("newest")
	const [lastNonRelevantSort, setLastNonRelevantSort] = useState<SortOption | null>("newest")
	// New state for workspace filtering
	const [workspaceFilterMode, setWorkspaceFilterMode] = useState<WorkspaceFilterMode>("current")
	const [selectedWorkspaces, setSelectedWorkspaces] = useState<string[]>([])

	useEffect(() => {
		// Reset selected workspaces if mode changes away from 'selected'
		if (workspaceFilterMode !== "selected" && selectedWorkspaces.length > 0) {
			setSelectedWorkspaces([])
		}
	}, [workspaceFilterMode, selectedWorkspaces.length])

	useEffect(() => {
		if (searchQuery && sortOption !== "mostRelevant" && !lastNonRelevantSort) {
			setLastNonRelevantSort(sortOption)
			setSortOption("mostRelevant")
		} else if (!searchQuery && sortOption === "mostRelevant" && lastNonRelevantSort) {
			setSortOption(lastNonRelevantSort)
			setLastNonRelevantSort(null)
		}
	}, [searchQuery, sortOption, lastNonRelevantSort])

	// Calculate available workspaces from history
	const availableWorkspaces = useMemo(() => {
		const workspaces = taskHistory
			.map((task) => task.workspace)
			.filter((ws): ws is string => typeof ws === "string" && ws.length > 0) // Filter out non-strings/empty
		// Use Array.from to handle potential Set iteration issues
		return Array.from(new Set(workspaces)).sort()
	}, [taskHistory])

	const presentableTasks = useMemo(() => {
		let tasks = taskHistory.filter((item) => item.ts && item.task)

		// Apply forced filter first if provided in config
		if (config?.forceWorkspaceFilter === "current") {
			tasks = tasks.filter((item) => item.workspace === cwd)
		} else if (config?.forceWorkspaceFilter === "all") {
			// No workspace filtering needed if forced to 'all'
		} else if (!config?.forceWorkspaceFilter) {
			// Apply workspace filter based on internal state if no force override
			if (workspaceFilterMode === "current") {
				tasks = tasks.filter((item) => item.workspace === cwd)
			} else if (workspaceFilterMode === "selected") {
				// Only filter if specific workspaces are selected
				if (selectedWorkspaces.length > 0) {
					tasks = tasks.filter((item) => item.workspace && selectedWorkspaces.includes(item.workspace))
				} else {
					// If mode is 'selected' but array is empty, show only current workspace tasks
					// This handles the case where the user deselects all specific workspaces
					tasks = tasks.filter((item) => item.workspace === cwd)
				}
			}
		}
		return tasks
	}, [taskHistory, workspaceFilterMode, selectedWorkspaces, cwd, config?.forceWorkspaceFilter])

	const fzf = useMemo(() => {
		return new Fzf(presentableTasks, {
			selector: (item) => item.task,
		})
	}, [presentableTasks])

	const tasks = useMemo(() => {
		let results = presentableTasks

		if (searchQuery) {
			const searchResults = fzf.find(searchQuery)
			results = searchResults.map((result) => {
				const positions = Array.from(result.positions)
				const taskEndIndex = result.item.task.length

				return {
					...result.item,
					task: highlightFzfMatch(
						result.item.task,
						positions.filter((p) => p < taskEndIndex),
					),
					workspace: result.item.workspace,
				}
			})
		}

		// Then sort the results
		// Use Array.from for sorting to avoid potential issues with direct mutation
		return Array.from(results).sort((a, b) => {
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
	}, [presentableTasks, searchQuery, fzf, sortOption])

	return {
		tasks,
		searchQuery,
		setSearchQuery,
		sortOption,
		setSortOption,
		lastNonRelevantSort,
		setLastNonRelevantSort,
		// New workspace filter state and setters
		availableWorkspaces,
		workspaceFilterMode,
		setWorkspaceFilterMode,
		selectedWorkspaces,
		setSelectedWorkspaces,
	}
}
