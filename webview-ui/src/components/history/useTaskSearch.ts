import { useState, useEffect, useMemo, useCallback } from "react"
import { Fzf } from "fzf"
// Removed useEvent import

import { highlightFzfMatch } from "@/utils/highlight"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { HistoryItem, ExtensionMessage } from "@roo/shared/ExtensionMessage"
import { vscode } from "@/utils/vscode"

type SortOption = "newest" | "oldest" | "mostExpensive" | "mostTokens" | "mostRelevant"

export const useTaskSearch = () => {
	const { cwd, availableHistoryMonths } = useExtensionState()
	const [localHistoryItems, setLocalHistoryItems] = useState<HistoryItem[]>([])
	const [searchQuery, setSearchQuery] = useState("")
	const [sortOption, setSortOption] = useState<SortOption>("newest")
	const [monthsToFetch, setMonthsToFetch] = useState<Array<{ year: number; month: number }>>([])
	const [currentlyFetchingMonth, setCurrentlyFetchingMonth] = useState<{ year: number; month: number } | null>(null)
	const [isLoadingHistoryChunks, setIsLoadingHistoryChunks] = useState<boolean>(false)
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

	const handleHistoryMessage = useCallback((event: Event) => {
		const messageEvent = event as MessageEvent<ExtensionMessage>
		const message = messageEvent.data
		if (message.type === "historyByMonthResults" || message.type === "historySearchResults") {
			if (message.historyItems) {
				setLocalHistoryItems((prevItems) => {
					const newItems = message.historyItems || []
					const uniqueNewItems = newItems.filter(
						(newItem) => !prevItems.some((prevItem) => prevItem.id === newItem.id),
					)
					return [...prevItems, ...uniqueNewItems] // Items are already sorted by backend
				})
				if (message.type === "historyByMonthResults") {
					setCurrentlyFetchingMonth(null)
					console.log("[HistoryView] Received historyByMonthResults, cleared currentlyFetchingMonth.")
				}
			}
		}
	}, [])

	// Replaced useEvent with useEffect for manual event listener management
	useEffect(() => {
		window.addEventListener("message", handleHistoryMessage)
		return () => {
			window.removeEventListener("message", handleHistoryMessage)
		}
	}, [handleHistoryMessage])

	useEffect(() => {
		if (
			availableHistoryMonths &&
			availableHistoryMonths.length > 0 &&
			localHistoryItems.length === 0 &&
			!isLoadingHistoryChunks &&
			monthsToFetch.length === 0
		) {
			console.log("[HistoryView] Initializing history fetch from availableHistoryMonths:", availableHistoryMonths)
			setIsLoadingHistoryChunks(true)
			setMonthsToFetch([...availableHistoryMonths]) // Backend sends these sorted (newest first)
		}
	}, [availableHistoryMonths, localHistoryItems.length, isLoadingHistoryChunks, monthsToFetch.length])

	useEffect(() => {
		if (isLoadingHistoryChunks && monthsToFetch.length > 0 && !currentlyFetchingMonth) {
			const nextMonthToFetch = monthsToFetch[0]
			setCurrentlyFetchingMonth(nextMonthToFetch)
			setMonthsToFetch((prev) => prev.slice(1))

			console.log("[HistoryView] Fetching month:", nextMonthToFetch)
			vscode.postMessage({
				type: "getHistoryByMonth",
				payload: { year: nextMonthToFetch.year, month: nextMonthToFetch.month },
			})
		} else if (isLoadingHistoryChunks && monthsToFetch.length === 0 && !currentlyFetchingMonth) {
			console.log("[HistoryView] All available months fetched.")
			setIsLoadingHistoryChunks(false)
		}
	}, [monthsToFetch, currentlyFetchingMonth, isLoadingHistoryChunks])

	const presentableTasks = useMemo(() => {
		let tasks = localHistoryItems.filter((item) => item.ts && item.task)
		console.log(
			"[HistoryDebug] All localHistoryItems:",
			JSON.stringify(localHistoryItems.map((t) => ({ id: t.id, ws: t.workspace }))),
		)
		console.log("[HistoryDebug] Current CWD from useExtensionState:", cwd)
		if (!showAllWorkspaces) {
			tasks = tasks.filter((item) => {
				const isMatch = item.workspace === cwd
				if (localHistoryItems.length > 0 && !isMatch && item.workspace) {
					// Log only if there are items and a mismatch for a defined workspace
					console.log(
						`[HistoryDebug] Mismatch: item.workspace="${item.workspace}" (type: ${typeof item.workspace}), cwd="${cwd}" (type: ${typeof cwd}) for item ID ${item.id}`,
					)
				}
				return isMatch
			})
		}
		console.log(
			"[HistoryDebug] Filtered presentableTasks:",
			JSON.stringify(tasks.map((t) => ({ id: t.id, ws: t.workspace }))),
		)
		return tasks
	}, [localHistoryItems, showAllWorkspaces, cwd])

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
		return [...results].sort((a, b) => {
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
		showAllWorkspaces,
		setShowAllWorkspaces,
		isLoadingHistoryChunks,
	}
}
