import { useCallback, useEffect, useRef } from "react"
import { vscode } from "@src/utils/vscode"

export const CHAT_DRAFT_SAVE_DEBOUNCE_MS = 2000

/**
 * Hook for chat textarea draft persistence (extension globalState).
 * Handles auto-save, restore on mount, and clear on send via postMessage.
 * @param inputValue current textarea value
 * @param setInputValue setter for textarea value
 * @param onSend send callback
 */
export function useChatTextDraft(inputValue: string, setInputValue: (value: string) => void, onSend: () => void) {
	// Restore draft from extension host on mount
	useEffect(() => {
		const handleDraftValue = (event: MessageEvent) => {
			const msg = event.data
			if (msg && msg.type === "chatTextDraftValue") {
				if (typeof msg.text === "string" && msg.text && !inputValue) {
					setInputValue(msg.text)
				}
			}
		}
		window.addEventListener("message", handleDraftValue)
		// Request draft from extension host
		vscode.postMessage({ type: "getChatTextDraft" })
		return () => {
			window.removeEventListener("message", handleDraftValue)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// Debounced save draft to extension host
	const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

	const hasHadUserInput = useRef(false)

	useEffect(() => {
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current)
		}
		const MAX_DRAFT_BYTES = 102400
		if (inputValue && inputValue.trim()) {
			hasHadUserInput.current = true
			debounceTimerRef.current = setTimeout(() => {
				try {
					// Fast pre-check: if character count is much greater than max bytes, skip encoding
					if (inputValue.length > MAX_DRAFT_BYTES * 2) {
						console.warn(`[useChatTextDraft] Draft is too long (chars=${inputValue.length}), not saving.`)
						return
					}
					const encoder = new TextEncoder()
					const bytes = encoder.encode(inputValue)
					if (bytes.length > MAX_DRAFT_BYTES) {
						console.warn(`[useChatTextDraft] Draft exceeds 100KB, not saving.`)
						return
					}
					vscode.postMessage({ type: "updateChatTextDraft", text: inputValue })
				} catch (err) {
					console.warn(`[useChatTextDraft] Failed to save draft:`, err)
				}
			}, CHAT_DRAFT_SAVE_DEBOUNCE_MS)
		} else {
			if (hasHadUserInput.current) {
				try {
					vscode.postMessage({ type: "clearChatTextDraft" })
				} catch (err) {
					console.warn(`[useChatTextDraft] Failed to clear draft:`, err)
				}
			}
		}
		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current)
			}
		}
	}, [inputValue])

	// Clear draft after send
	const handleSendAndClearDraft = useCallback(() => {
		try {
			vscode.postMessage({ type: "clearChatTextDraft" })
		} catch (err) {
			console.warn(`[useChatTextDraft] Failed to clear draft:`, err)
		}
		onSend()
	}, [onSend])

	return { handleSendAndClearDraft }
}
