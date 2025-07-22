import React from "react"

/**
 * Custom hook for debouncing operations to prevent rapid successive calls
 * @param delay - Delay in milliseconds before allowing next operation
 * @returns Object with isProcessing state and handleWithDebounce function
 */
export const useDebounce = (delay: number = 300) => {
	const [isProcessing, setIsProcessing] = React.useState(false)
	const timeoutRef = React.useRef<NodeJS.Timeout | null>(null)

	// Cleanup timeout on unmount
	React.useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}
		}
	}, [])

	const handleWithDebounce = React.useCallback(
		async (operation: () => void) => {
			if (isProcessing) return
			setIsProcessing(true)
			try {
				operation()
			} catch (_error) {
				// Silently handle any errors to prevent crashing
				// Debug logging removed for production
			}
			// Brief delay to prevent double-clicks
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}
			timeoutRef.current = setTimeout(() => setIsProcessing(false), delay)
		},
		[isProcessing, delay],
	)

	return { isProcessing, handleWithDebounce }
}
