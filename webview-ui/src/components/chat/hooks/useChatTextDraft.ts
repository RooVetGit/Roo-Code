import { useCallback, useEffect, useRef } from "react"

/**
 * Hook for chat textarea draft persistence (localStorage).
 * Handles auto-save, restore on mount, and clear on send.
 * @param draftKey localStorage key for draft persistence
 * @param inputValue current textarea value
 * @param setInputValue setter for textarea value
 * @param onSend send callback
 */
export function useChatTextDraft(
	draftKey: string,
	inputValue: string,
	setInputValue: (value: string) => void,
	onSend: () => void,
) {
	const saveDraftTimerRef = useRef<NodeJS.Timeout | null>(null)

	// Restore draft on mount
	useEffect(() => {
		try {
			const draft = localStorage.getItem(draftKey)
			if (draft && !inputValue) {
				setInputValue(draft)
			}
		} catch (_) {
			// ignore
		}
		// Only run on initial mount
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// Periodically save draft
	useEffect(() => {
		if (saveDraftTimerRef.current) {
			clearInterval(saveDraftTimerRef.current)
		}
		if (inputValue && inputValue.trim()) {
			saveDraftTimerRef.current = setInterval(() => {
				try {
					localStorage.setItem(draftKey, inputValue)
				} catch (_) {
					// ignore
				}
			}, 5000)
		} else {
			// Remove draft if no content
			try {
				localStorage.removeItem(draftKey)
			} catch (_) {
				// ignore
			}
		}
		return () => {
			if (saveDraftTimerRef.current) {
				clearInterval(saveDraftTimerRef.current)
			}
		}
	}, [inputValue, draftKey])

	// Clear draft after send
	const handleSendAndClearDraft = useCallback(() => {
		try {
			localStorage.removeItem(draftKey)
		} catch (_) {
			// ignore
		}
		onSend()
	}, [onSend, draftKey])

	return { handleSendAndClearDraft }
}
