import { useLayoutEffect, useRef, useState } from "react"

interface TabItem {
	id: string
	ref: React.RefObject<HTMLElement>
}

interface UseTabOverflowOptions {
	containerWidth?: number
	moreButtonWidth?: number
	activeTabId?: string
}

interface UseTabOverflowResult {
	containerRef: React.RefObject<HTMLDivElement>
	visibleTabs: string[]
	overflowTabs: string[]
	hasOverflow: boolean
}

/**
 * A hook that manages tab overflow with a "More" dropdown
 *
 * @param tabs Array of tab items with id and ref
 * @param options Configuration options
 * @returns Object with containerRef, visibleTabs, overflowTabs, and hasOverflow
 */
export function useTabOverflow(tabs: TabItem[], options: UseTabOverflowOptions = {}): UseTabOverflowResult {
	const {
		containerWidth: fixedContainerWidth,
		moreButtonWidth = 50, // Default width for the "More" button
		activeTabId,
	} = options

	const containerRef = useRef<HTMLDivElement>(null)
	const [visibleTabs, setVisibleTabs] = useState<string[]>([])
	const [overflowTabs, setOverflowTabs] = useState<string[]>([])
	const [hasOverflow, setHasOverflow] = useState(false)

	// Use useLayoutEffect to measure and calculate before paint
	useLayoutEffect(() => {
		const calculateVisibleTabs = () => {
			const container = containerRef.current
			if (!container) return

			// Use fixed width if provided, otherwise use container's width
			const containerWidth = fixedContainerWidth || container.clientWidth

			// Get tab widths
			const tabWidths = tabs.map((tab) => {
				const element = tab.ref.current
				return element ? element.getBoundingClientRect().width : 0
			})

			// Calculate which tabs fit
			let availableWidth = containerWidth
			const visibleTabIds: string[] = []
			const overflowTabIds: string[] = []

			// First, ensure the active tab is visible if it exists
			if (activeTabId) {
				const activeTabIndex = tabs.findIndex((tab) => tab.id === activeTabId)
				if (activeTabIndex !== -1) {
					visibleTabIds.push(activeTabId)
					availableWidth -= tabWidths[activeTabIndex]
				}
			}

			// Then add other tabs until we run out of space
			tabs.forEach((tab, index) => {
				// Skip if this is the active tab (already added)
				if (tab.id === activeTabId) return

				const tabWidth = tabWidths[index]

				// Check if we need to reserve space for the "More" button
				const needMoreButton =
					index < tabs.length - 1 &&
					availableWidth - tabWidth < tabWidths.slice(index + 1).reduce((sum, w) => sum + w, 0)

				const effectiveAvailableWidth = needMoreButton ? availableWidth - moreButtonWidth : availableWidth

				if (tabWidth <= effectiveAvailableWidth) {
					visibleTabIds.push(tab.id)
					availableWidth -= tabWidth
				} else {
					overflowTabIds.push(tab.id)
				}
			})

			setVisibleTabs(visibleTabIds)
			setOverflowTabs(overflowTabIds)
			setHasOverflow(overflowTabIds.length > 0)
		}

		// Calculate on mount and when dependencies change
		calculateVisibleTabs()

		// Set up ResizeObserver to recalculate on container resize
		const resizeObserver = new ResizeObserver(() => {
			calculateVisibleTabs()
		})

		// Capture the current value of containerRef.current
		const currentContainer = containerRef.current

		if (currentContainer) {
			resizeObserver.observe(currentContainer)
		}

		// Clean up
		return () => {
			if (currentContainer) {
				resizeObserver.unobserve(currentContainer)
			}
			resizeObserver.disconnect()
		}
	}, [tabs, fixedContainerWidth, moreButtonWidth, activeTabId])

	return {
		containerRef,
		visibleTabs,
		overflowTabs,
		hasOverflow,
	}
}
