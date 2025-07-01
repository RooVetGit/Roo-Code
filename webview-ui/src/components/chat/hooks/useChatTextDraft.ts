import { useCallback, useEffect, useRef } from "react"

// Debounce delay for saving chat draft (ms)
export const CHAT_DRAFT_SAVE_DEBOUNCE_MS = 3000

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
	// Restore draft on mount
	useEffect(() => {
		try {
			const draft = localStorage.getItem(draftKey)
			if (draft && !inputValue) {
				setInputValue(draft)
			}
		} catch (err) {
			// Log localStorage getItem failure for debugging
			console.warn(`[useChatTextDraft] Failed to restore draft from localStorage for key "${draftKey}":`, err)
		}
		// Only run on initial mount
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// Debounced save draft
	const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

	useEffect(() => {
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current)
		}
		if (inputValue && inputValue.trim()) {
			debounceTimerRef.current = setTimeout(() => {
				try {
					// Limit draft size to 100KB (102400 bytes)
					const MAX_DRAFT_BYTES = 102400
					// Fast pre-check: if character count is much greater than max bytes, skip encoding
					if (inputValue.length > MAX_DRAFT_BYTES * 2) {
						// In UTF-8, Chinese chars are usually 2-3 bytes, English 1 byte
						console.warn(
							`[useChatTextDraft] Draft for key "${draftKey}" is too long (chars=${inputValue.length}), not saving to localStorage.`,
						)
					} else {
						const encoder = new TextEncoder()
						const bytes = encoder.encode(inputValue)
						if (bytes.length > MAX_DRAFT_BYTES) {
							// Do not save if draft exceeds 100KB
							console.warn(
								`[useChatTextDraft] Draft for key "${draftKey}" exceeds 100KB, not saving to localStorage.`,
							)
						} else {
							localStorage.setItem(draftKey, inputValue)
						}
					}
				} catch (err) {
					// Log localStorage setItem failure for debugging
					console.warn(`[useChatTextDraft] Failed to save draft to localStorage for key "${draftKey}":`, err)
				}
			}, CHAT_DRAFT_SAVE_DEBOUNCE_MS)
		} else {
			// Remove draft if no content
			try {
				localStorage.removeItem(draftKey)
			} catch (err) {
				// Log localStorage removeItem failure for debugging
				console.warn(`[useChatTextDraft] Failed to remove draft from localStorage for key "${draftKey}":`, err)
			}
		}
		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current)
			}
		}
	}, [inputValue, draftKey])

	// Clear draft after send
	const handleSendAndClearDraft = useCallback(() => {
		try {
			localStorage.removeItem(draftKey)
		} catch (err) {
			// Log localStorage removeItem failure for debugging
			console.warn(`[useChatTextDraft] Failed to remove draft from localStorage for key "${draftKey}":`, err)
		}
		onSend()
	}, [onSend, draftKey])

	return { handleSendAndClearDraft }
}
