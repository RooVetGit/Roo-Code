import { useState, useEffect, useRef } from "react"

/**
 * Custom Hook to preserve focus on a specified HTML element.
 *
 * @param {HTMLElement | null} element - The HTML element to manage focus for.
 * @param {Boolean} isHidden - A flag indicating if the element is hidden.
 *
 * @returns {isFocused} - A flag indicating whether the element is focused
 *
 * This hook preserves the focus state of an HTML element, even though it may be
 * hidden (e.g. if the whole tab it is on is hidden).
 * When the element is hidden, it will lose focus, triggering a "blur" event.
 * However, if the "blur" event is due to the element having been hidden,
 * this hook will track the "focussed" state, and reinstate it once the element
 * is no longer hidden.
 */
export function useFocusPreservation(element: HTMLElement | null, isHidden: Boolean) {
	const [isFocused, setIsFocused] = useState(false)
	const isHiddenRef = useRef(isHidden)
	const isHiddenLastChangedRef = useRef(0)

	useEffect(() => {
		isHiddenRef.current = isHidden
		isHiddenLastChangedRef.current = Date.now()
	}, [isHidden])

	useEffect(() => {
		// unclear why timer is here, and whether it's still necessary.
		const timer = setTimeout(() => {
			if (!isHidden && isFocused) {
				element?.focus()
			}
		}, 50)
		return () => {
			clearTimeout(timer)
		}
	}, [isHidden, element, isFocused])

	useEffect(() => {
		if (!element) return

		const onTextAreaFocus = () => {
			setIsFocused(true)
		}

		const onTextAreaBlur = () => {
			// Blur event should only be interpreted as an intentional defocus
			// if they have not occured as a result of the element being hidden.
			const BLUR_DELAY = 500
			setTimeout(() => {
				if (!isHiddenRef.current && Date.now() - isHiddenLastChangedRef.current > BLUR_DELAY) {
					// We consider a blur event to be an intentional defocus
					// if BLUR_DELAY msecs after the blur, the element is still hidden
					// and the element's hidden state hasn't changed witin that time period.
					setIsFocused(false)
				}
			}, BLUR_DELAY)
		}

		element.addEventListener("focus", onTextAreaFocus)
		element.addEventListener("blur", onTextAreaBlur)

		// Initialize focus state
		if (document.activeElement === element) {
			setIsFocused(true)
		}

		return () => {
			element.removeEventListener("focus", onTextAreaFocus)
			element.removeEventListener("blur", onTextAreaBlur)
		}
	}, [element])

	return isFocused
}
