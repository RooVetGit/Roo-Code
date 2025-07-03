import { HistoryItem, HistorySearchResultItem, HistorySearchResults } from "@roo-code/types"
import { Fzf } from "fzf"

// Constants
const SCORE_THRESHOLD_RATIO = 0.3 // Keep results with scores at least 30% of the highest score
const MIN_RESULTS_COUNT = 5 // Always keep at least this many results when available
const MAX_SAMPLE_SCORES = 5 // Number of sample scores to log for debugging

/**
 * Performs a fuzzy search on history items using fzf
 * @param items - Array of history items to search
 * @param searchQuery - The search query string
 * @param preserveOrder - Whether to preserve the original order of items (default: true)
 * @returns HistorySearchResults containing items with match positions
 */
export function taskHistorySearch(
	items: HistoryItem[],
	searchQuery: string,
	preserveOrder: boolean = true,
): HistorySearchResults {
	console.debug(
		`[TaskSearch] Starting search with query: "${searchQuery}" on ${items.length} items, preserveOrder: ${preserveOrder}`,
	)

	if (!searchQuery.trim()) {
		// If no search query, return all items without match information
		console.debug(`[TaskSearch] Empty query, returning all ${items.length} items without filtering`)
		return {
			items: items as HistorySearchResultItem[],
		}
	}

	// Create a map of item IDs to their original indices if we need to preserve order
	const originalIndices = preserveOrder ? new Map<string, number>() : null

	if (preserveOrder) {
		items.forEach((item, index) => {
			originalIndices!.set(item.id, index)
		})
	}

	// Initialize fzf with the items
	const fzf = new Fzf(items, {
		selector: (item) => item.task || "",
	})

	// Perform the search
	const searchResults = fzf.find(searchQuery)

	// For debugging: log some sample scores to understand the range
	if (searchResults.length > 0) {
		const sampleScores = searchResults
			.slice(0, Math.min(MAX_SAMPLE_SCORES, searchResults.length))
			.map((r) => r.score)
		console.debug(`[TaskSearch] Sample scores: ${JSON.stringify(sampleScores)}`)
	}

	// Filter out results with no positions (nothing to highlight)
	let validResults = searchResults.filter((result) => {
		return result.positions && result.positions.size > 0
	})

	console.debug(`[TaskSearch] ${searchResults.length - validResults.length} results had no positions to highlight`)

	// Take a more intelligent approach to filtering:
	// 1. Always keep at least some results (if any matches exist)
	// 2. If the best match has a very low score, we can be stricter about filtering
	// 3. For higher scores, be more lenient about what we include

	let filteredResults = validResults

	if (validResults.length > 0) {
		// Important: In this fzf implementation, scores represent potential matches
		// - Higher scores (like 272) = terms that exist in many places ("immediately")
		// - Lower scores (like 16) = terms that don't exist/few matches ("immazz")
		const highestScore = Math.max(...validResults.map((r) => r.score))

		// Filter to keep only results with reasonably high scores
		// We want to keep results with scores at least 30% of the highest score
		const scoreThreshold = highestScore * SCORE_THRESHOLD_RATIO

		// Use threshold but enforce a minimum number of results
		if (validResults.length > MIN_RESULTS_COUNT) {
			filteredResults = validResults.filter((result) => {
				return result.score >= scoreThreshold
			})

			// Always keep at least MIN_RESULTS_COUNT results if we have them
			if (filteredResults.length < MIN_RESULTS_COUNT) {
				filteredResults = validResults.slice(0, MIN_RESULTS_COUNT)
			}
		}
	}

	console.debug(
		`[TaskSearch] Found ${filteredResults.length} matches out of ${items.length} items (unfiltered: ${searchResults.length}, valid: ${validResults.length})`,
	)

	// Convert fzf results to HistorySearchResultItem
	const resultItems: HistorySearchResultItem[] = filteredResults.map((result) => {
		const positions = Array.from(result.positions)

		return {
			...result.item,
			match: {
				positions,
			},
		}
	})

	// If preserveOrder is true, reconstruct the results in original order
	if (preserveOrder && originalIndices && resultItems.length > 0) {
		// Create a map of item IDs to their corresponding result items
		const resultItemsById = new Map<string, HistorySearchResultItem>()
		for (const item of resultItems) {
			resultItemsById.set(item.id, item)
		}

		// Create a new array in the original order, but only include items that are in the result set
		const orderedResults: HistorySearchResultItem[] = []

		// Loop through original items in order
		for (let i = 0; i < items.length; i++) {
			const originalItem = items[i]
			const resultItem = resultItemsById.get(originalItem.id)

			// Only include items that are in the result set
			if (resultItem) {
				orderedResults.push(resultItem)
			}
		}

		// Replace the result items with the ordered ones
		return {
			items: orderedResults,
		}
	}

	return {
		items: resultItems,
	}
}
