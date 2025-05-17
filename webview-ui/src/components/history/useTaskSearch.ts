import { useState, useEffect, useMemo } from "react"
import { Fzf } from "fzf"

import { highlightFzfMatch } from "@/utils/highlight"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { HistoryItem } from "../../../../src/shared/HistoryItem"

type SortOption = "newest" | "oldest" | "mostExpensive" | "mostTokens" | "mostRelevant"

export interface HierarchicalHistoryItem extends HistoryItem {
	children?: HierarchicalHistoryItem[]
}

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
		let tasks = taskHistory.filter((item) => item.ts && item.task)
		if (!showAllWorkspaces) {
			tasks = tasks.filter((item) => item.workspace === cwd)
		}
		return tasks
	}, [taskHistory, showAllWorkspaces, cwd])

	const fzf = useMemo(() => {
		return new Fzf(presentableTasks, {
			selector: (item) => item.task,
		})
	}, [presentableTasks])

	const tasks = useMemo(() => {
		let results: HierarchicalHistoryItem[] = [...presentableTasks]

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

		// Build hierarchy
		const taskMap = new Map<string, HierarchicalHistoryItem>()
		results.forEach((task) => taskMap.set(task.id, { ...task, children: [] }))

		const rootTasks: HierarchicalHistoryItem[] = []
		results.forEach((task) => {
			if (task.parent_task_id && taskMap.has(task.parent_task_id)) {
				const parent = taskMap.get(task.parent_task_id)
				if (parent) {
					parent.children = parent.children || []
					parent.children.push(taskMap.get(task.id)!)
				}
			} else {
				rootTasks.push(taskMap.get(task.id)!)
			}
		})

		// Sort children within each parent and root tasks
		const sortTasksRecursive = (tasksToSort: HierarchicalHistoryItem[]): HierarchicalHistoryItem[] => {
			tasksToSort.sort((a, b) => {
				switch (sortOption) {
					case "oldest":
						return (a.ts || 0) - (b.ts || 0)
					case "mostExpensive":
						return (b.totalCost || 0) - (a.totalCost || 0)
					case "mostTokens":
						const aTokens =
							(a.tokensIn || 0) + (a.tokensOut || 0) + (a.cacheWrites || 0) + (a.cacheReads || 0)
						const bTokens =
							(b.tokensIn || 0) + (b.tokensOut || 0) + (b.cacheWrites || 0) + (b.cacheReads || 0)
						return bTokens - aTokens
					case "mostRelevant":
						return searchQuery ? 0 : (b.ts || 0) - (a.ts || 0) // FZF order for root, timestamp for children
					case "newest":
					default:
						return (b.ts || 0) - (a.ts || 0)
				}
			})
			tasksToSort.forEach((task) => {
				if (task.children && task.children.length > 0) {
					task.children = sortTasksRecursive(task.children)
				}
			})
			return tasksToSort
		}

		return sortTasksRecursive(rootTasks)
	}, [presentableTasks, searchQuery, fzf, sortOption])

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
