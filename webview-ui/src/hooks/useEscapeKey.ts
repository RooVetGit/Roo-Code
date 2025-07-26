import { useEffect, useCallback } from "react"

/**
 * Custom hook for handling ESC key press events
 * @param isOpen - Whether the component is currently open/visible
 * @param onEscape - Callback function to execute when ESC is pressed
 * @param options - Additional options for the hook
 */
export function useEscapeKey(
	isOpen: boolean,
	onEscape: () => void,
	options: {
		preventDefault?: boolean
		stopPropagation?: boolean
	} = {},
) {
	const { preventDefault = true, stopPropagation = true } = options

	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if (event.key === "Escape" && isOpen) {
				if (preventDefault) {
					event.preventDefault()
				}
				if (stopPropagation) {
					event.stopPropagation()
				}
				onEscape()
			}
		},
		[isOpen, onEscape, preventDefault, stopPropagation],
	)

	useEffect(() => {
		if (isOpen) {
			// Use window instead of document for consistency with existing patterns
			window.addEventListener("keydown", handleKeyDown)
			return () => {
				window.removeEventListener("keydown", handleKeyDown)
			}
		}
	}, [isOpen, handleKeyDown])
}
