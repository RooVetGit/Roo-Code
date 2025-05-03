import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useDebounce } from "react-use"
import { VirtuosoHandle } from "react-virtuoso"
import { Search, ChevronUp, ChevronDown } from "lucide-react"
import { VSCodeTextField, VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { useTranslation } from "react-i18next"

// Store only the index of the message containing the match
type SearchResult = number // Represents the itemIndex

interface UseChatSearchProps<T> {
	messages: T[]
	virtuosoRef: React.RefObject<VirtuosoHandle>
	// Function now receives item, index, and the full list
	getSearchableText: (item: T, index: number, list: T[]) => string
	disableAutoScrollRef: React.MutableRefObject<boolean> // Add ref from parent
}

export function useChatSearch<T>({
	messages,
	virtuosoRef,
	getSearchableText,
	// disableAutoScrollRef, // Removed unused prop
}: UseChatSearchProps<T>) {
	const { t } = useTranslation()
	const [showSearch, setShowSearch] = useState(false)
	const [searchText, setSearchText] = useState("")
	const [debouncedSearchText, setDebouncedSearchText] = useState("")
	const [searchResults, setSearchResults] = useState<SearchResult[]>([]) // Array of item indices
	const [currentMatchIndex, setCurrentMatchIndex] = useState(-1) // Index within the searchResults array
	// Use 'any' for the ref type to bypass strict VSCodeTextField type checking
	const searchInputRef = useRef<any>(null)
	const isInitialSearchScrollDone = useRef(false) // Track if initial scroll happened for the current search
	const isNavigatingRef = useRef(false) // Track if index change is from user navigation
	const logicalMatchIndexRef = useRef(-1) // Ref to track the index immediately for calculations
	const previousSearchableTextsRef = useRef<string[] | null>(null) // Ref to compare searchableTexts content
	const previousSearchTermRef = useRef<string | null>(null) // Ref to compare search term

	// Debounce search text
	useDebounce(
		() => {
			setDebouncedSearchText(searchText)
		},
		200, // Debounce time in ms
		[searchText],
	)

	// Memoize searchable text for performance
	const searchableTexts = useMemo(() => {
		// Pass item, index, and the full messages list to the getter
		return messages.map((item, index, list) => getSearchableText(item, index, list))
	}, [messages, getSearchableText])

	// Function to perform the scroll to a specific match index
	// Scrolls to the message (item) at the given index in the main messages list
	// Function to perform the scroll to a specific match index using scrollIntoView
	// No longer needs currentMatchIndex from closure
	const scrollToItemIndex = useCallback(
		(itemIndex: number, behavior: "smooth" | "auto" = "auto") => {
			if (virtuosoRef.current && itemIndex !== -1) {
				// Use rAF to ensure DOM updates potentially settle first
				requestAnimationFrame(() => {
					if (!virtuosoRef.current) {
						// Ref might become null before rAF callback
						isNavigatingRef.current = false // Reset flag if scroll can't happen
						console.log(`[Search] rAF: Ref NOT found for index ${itemIndex}. Aborting scrollIntoView.`) // Changed log message for clarity
						return
					}
					// Removed stale log: console.log(`[Search] rAF: currentMatchIndex before scrollIntoView call: ${currentMatchIndex}`);

					console.log(`[Search] rAF: Calling scrollIntoView for index ${itemIndex}, behavior: ${behavior}`)
					virtuosoRef.current.scrollIntoView({
						index: itemIndex,
						behavior: behavior, // Use 'auto' for reliability as requested
						// align: 'start', // scrollIntoView aims to make it visible, align might not be needed/supported
						done: () => {
							// KEY: Reset navigation state *after* scroll completes
							console.log(
								`[Search] scrollIntoView DONE callback for index: ${itemIndex}. Resetting isNavigatingRef.`,
							)
							isNavigatingRef.current = false
							// console.log(`Virtuoso finished scrolling to index: ${itemIndex}`); // Original log
						},
					})
				})
			} else {
				// If scroll didn't happen (no ref or invalid index), reset flag immediately
				isNavigatingRef.current = false
			}
		},
		[virtuosoRef],
	) // Dependency on the ref

	// Perform search when debounced text or searchableTexts content changes
	useEffect(() => {
		// console.log("[Search Effect] Running. Debounced text:", debouncedSearchText); // REMOVED Log

		// Check if term or texts content has actually changed
		const textsChanged = JSON.stringify(searchableTexts) !== JSON.stringify(previousSearchableTextsRef.current)
		const termChanged = debouncedSearchText !== previousSearchTermRef.current

		// Only run the search logic if the term changed OR the texts changed
		if (!termChanged && !textsChanged) {
			// console.log("[Search Effect] Skipping: Neither term nor texts changed."); // REMOVED Log
			// Don't update refs here, wait until the end
			return // Skip search logic
		}

		// Store stringified texts once for potential use later
		const currentTextsStringified = JSON.stringify(searchableTexts)

		if (!debouncedSearchText) {
			// console.log("[Search Effect] Clearing results."); // REMOVED Log
			// Clear refs when search is cleared (setSearchResults will trigger re-render anyway)
			// previousSearchableTextsRef.current = null; // Let refs update at the end
			// previousSearchTermRef.current = null;
			setSearchResults([])
			logicalMatchIndexRef.current = -1 // Reset logical index
			isInitialSearchScrollDone.current = false // Reset scroll flag when search clears
			return
		}
		const matchingItemIndices: SearchResult[] = [] // Store unique item indices
		const searchTerm = debouncedSearchText.toLowerCase()

		searchableTexts.forEach((text, itemIndex) => {
			// DEBUG: Log the text being searched and the search term
			// console.log(`[Search Debug] Item ${itemIndex}: Searching for "${searchTerm}" in: "${text.substring(0, 100)}..."`);
			if (text.toLowerCase().includes(searchTerm)) {
				// DEBUG: Log when a match is found
				// console.log(`[Search Debug] Item ${itemIndex}: Match FOUND!`);
				matchingItemIndices.push(itemIndex) // Add index if message contains term
			}
		})

		const previousResultsLength = searchResults.length
		setSearchResults(matchingItemIndices)

		// Determine the new index and handle scrolling
		const newMatchIndex = matchingItemIndices.length > 0 ? 0 : -1
		// console.log(`[Search Effect] Found ${matchingItemIndices.length} results. Setting logical index to ${newMatchIndex}.`); // REMOVED Log
		setCurrentMatchIndex(newMatchIndex)
		logicalMatchIndexRef.current = newMatchIndex // Update logical index immediately

		// If results just appeared (went from 0 to >0), scroll to the first one automatically
		if (newMatchIndex === 0 && previousResultsLength === 0) {
			// Use timeout to allow state/render updates before scrolling
			setTimeout(() => {
				const firstItemIndex = matchingItemIndices[0]
				if (firstItemIndex !== undefined) {
					scrollToItemIndex(firstItemIndex, "auto")
					isInitialSearchScrollDone.current = true // Mark initial scroll as done for this search term
				}
			}, 50)
		} else if (newMatchIndex === -1) {
			isInitialSearchScrollDone.current = false // Reset if no results
		}
		// console.log("[Search Effect] Finished."); // REMOVED Log
		// Update refs AFTER processing is complete
		previousSearchableTextsRef.current = JSON.parse(currentTextsStringified)
		previousSearchTermRef.current = debouncedSearchText
	}, [debouncedSearchText, searchableTexts, scrollToItemIndex, searchResults.length])

	// Focus input when search bar shows
	useEffect(() => {
		if (showSearch) {
			// Timeout needed to allow the element to render
			setTimeout(() => searchInputRef.current?.focus(), 50)
		}
	}, [showSearch])

	const goNext = useCallback(() => {
		if (isNavigatingRef.current) {
			console.log("[Search] Navigation blocked: Already navigating.")
			return
		}
		if (searchResults.length === 0) return

		console.log("[Search] goNext: Starting navigation.")
		isNavigatingRef.current = true // Set flag immediately

		// Calculate new index based on the logical ref
		const currentLogicalIndex = logicalMatchIndexRef.current
		const newIndex = currentLogicalIndex === -1 ? 0 : (currentLogicalIndex + 1) % searchResults.length
		console.log(`[Search] goNext: Calculated new index ${newIndex} (based on logical index ${currentLogicalIndex})`)
		logicalMatchIndexRef.current = newIndex // Update logical index immediately

		// Get the corresponding item index from searchResults
		const itemIndexToScroll = searchResults[newIndex]

		if (itemIndexToScroll !== undefined) {
			console.log(`[Search] goNext: Calling scrollToItemIndex for item index ${itemIndexToScroll}`)
			// Call scroll directly, pass the correct item index
			scrollToItemIndex(itemIndexToScroll, "auto") // Explicitly pass behavior
			// Update state *after* initiating scroll
			console.log(`[Search] goNext: Setting currentMatchIndex to: ${newIndex}`)
			setCurrentMatchIndex(newIndex)
		} else {
			console.error(`[Search] goNext: Could not find item index for search result index ${newIndex}`)
			isNavigatingRef.current = false // Reset flag if scroll can't happen
		}
	}, [searchResults, scrollToItemIndex])

	const goPrev = useCallback(() => {
		if (isNavigatingRef.current) {
			console.log("[Search] Navigation blocked: Already navigating.")
			return
		}
		if (searchResults.length === 0) return

		console.log("[Search] goPrev: Starting navigation.")
		isNavigatingRef.current = true // Set flag immediately

		// Calculate new index based on the logical ref
		const currentLogicalIndex = logicalMatchIndexRef.current
		const newIndex = currentLogicalIndex <= 0 ? searchResults.length - 1 : currentLogicalIndex - 1
		console.log(`[Search] goPrev: Calculated new index ${newIndex} (based on logical index ${currentLogicalIndex})`)
		logicalMatchIndexRef.current = newIndex // Update logical index immediately

		// Get the corresponding item index from searchResults
		const itemIndexToScroll = searchResults[newIndex]

		if (itemIndexToScroll !== undefined) {
			console.log(`[Search] goPrev: Calling scrollToItemIndex for item index ${itemIndexToScroll}`)
			// Call scroll directly, pass the correct item index
			scrollToItemIndex(itemIndexToScroll, "auto") // Explicitly pass behavior
			// Update state *after* initiating scroll
			console.log(`[Search] goPrev: Setting currentMatchIndex to: ${newIndex}`)
			setCurrentMatchIndex(newIndex)
		} else {
			console.error(`[Search] goPrev: Could not find item index for search result index ${newIndex}`)
			isNavigatingRef.current = false // Reset flag if scroll can't happen
		}
	}, [searchResults, scrollToItemIndex])

	// Ensure the useEffect that previously handled scrolling is removed

	// Highlight function, now accepts itemIndex to identify the active match
	const highlightText = useCallback(
		(text: string, searchTerm: string, itemIndex: number): React.ReactNode => {
			// Get the item index of the currently selected search result
			const activeItemIndex = searchResults[currentMatchIndex]
			const isActiveItem = itemIndex === activeItemIndex

			if (!searchTerm || !text) {
				return text
			}
			const lowerText = text.toLowerCase()
			const lowerSearchTerm = searchTerm.toLowerCase()
			const parts: React.ReactNode[] = []
			let lastIndex = 0
			let index = lowerText.indexOf(lowerSearchTerm, lastIndex)

			while (index !== -1) {
				// Push the text before the match
				if (index > lastIndex) {
					parts.push(text.substring(lastIndex, index))
				}
				// Push the highlighted match
				const matchedPart = text.substring(index, index + searchTerm.length)
				// Apply default highlight and add outline classes if this is the currently active item
				let highlightClasses = "bg-yellow-300" // Default highlight style
				if (isActiveItem) {
					highlightClasses += " outline outline-1 outline-white" // Add outline for active item
				}
				parts.push(
					<mark key={index} className={highlightClasses}>
						{matchedPart}
					</mark>,
				)

				lastIndex = index + searchTerm.length
				index = lowerText.indexOf(lowerSearchTerm, lastIndex)
			}

			// Push the remaining text after the last match
			if (lastIndex < text.length) {
				parts.push(text.substring(lastIndex))
			}

			return parts
		},
		[currentMatchIndex, searchResults], // Dependencies updated
	)

	const renderSearchBar = useCallback(() => {
		if (!showSearch) {
			return null
		}

		const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Enter") {
				if (e.shiftKey) {
					goPrev()
				} else {
					goNext()
				}
				e.preventDefault()
			} else if (e.key === "Escape") {
				setShowSearch(false)
				e.preventDefault()
			}
		}

		return (
			<div className="sticky top-0 z-10 flex items-center p-1 bg-[var(--vscode-sideBar-background)] border-b border-[var(--vscode-editorGroup-border)]">
				<VSCodeTextField
					ref={searchInputRef}
					placeholder={'Search e.g. "Checkpoint"'}
					value={searchText}
					onInput={(e: any) => setSearchText(e.target.value)}
					onKeyDown={handleKeyDown}
					className="flex-grow mr-1"
					style={{ borderRadius: "3px 0 0 3px" }} // Style adjustments might be needed
				>
					{/* Wrap icon in a span with the slot attribute */}
					<span slot="start" className="flex items-center">
						<Search size={16} className="ml-1 opacity-70" />
					</span>
				</VSCodeTextField>
				<span className="text-xs text-[var(--vscode-descriptionForeground)] px-2 whitespace-nowrap">
					{searchResults.length > 0
						? `${currentMatchIndex + 1} / ${searchResults.length}`
						: debouncedSearchText
							? t("chat:search.noResults")
							: ""}
				</span>
				<VSCodeButton
					appearance="icon"
					onClick={goPrev}
					disabled={searchResults.length === 0}
					title={t("chat:search.previous")}
					aria-label={t("chat:search.previous")}>
					<ChevronUp size={16} />
				</VSCodeButton>
				<VSCodeButton
					appearance="icon"
					onClick={goNext}
					disabled={searchResults.length === 0}
					title={t("chat:search.next")}
					aria-label={t("chat:search.next")}>
					<ChevronDown size={16} />
				</VSCodeButton>
				{/* X Button Removed */}
			</div>
		)
	}, [showSearch, searchText, searchResults, currentMatchIndex, debouncedSearchText, goNext, goPrev, t])

	// Function to handle closing the search and resetting state
	const closeSearch = useCallback(() => {
		// console.log("[Search] closeSearch called. Clearing search, hiding bar, scrolling bottom.");
		setSearchText("") // Clear the search input
		setShowSearch(false) // Hide the search bar
		// disableAutoScrollRef.current = false; // REMOVED: Let ChatView handle re-enabling on manual scroll to bottom
		// Auto-scroll removed
	}, [setShowSearch])

	return {
		showSearch,
		setShowSearch, // Keep this for toggling *on*
		closeSearch, // Expose the new close function
		searchText, // Raw search text
		debouncedSearchText, // Debounced text for triggering search/highlighting
		searchResults,
		currentMatchIndex,
		matchesCount: searchResults.length,
		highlightText,
		renderSearchBar,
		goNext,
		goPrev,
		isNavigatingRef, // Expose the ref
	}
}
