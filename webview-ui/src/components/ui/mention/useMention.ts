import { useState, useRef, useCallback } from "react"

import type { Mentionable } from "./types"

export function useMention(suggestions: Mentionable[]) {
	const [isOpen, setIsOpen] = useState(false)
	const isOpenRef = useRef(false)
	const [triggerPos, setTriggerPos] = useState<{ top: number; left: number } | null>(null)
	const [selectedSuggestion, setSelectedSuggestion] = useState<string | undefined>(suggestions[0]?.name || undefined)

	const openMenu = useCallback(() => {
		setIsOpen(true)
		isOpenRef.current = true
	}, [])

	const closeMenu = useCallback(() => {
		setIsOpen(false)
		isOpenRef.current = false
		setSelectedSuggestion(undefined)
	}, [])

	return {
		triggerPos,
		setTriggerPos,
		selectedSuggestion,
		setSelectedSuggestion,
		openMenu,
		closeMenu,
		isOpen,
		isOpenRef,
	}
}
