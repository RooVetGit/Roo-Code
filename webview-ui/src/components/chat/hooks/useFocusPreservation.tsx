import { useState, useEffect, useRef } from "react"
import { useMount } from "react-use"

export interface UseFocusPreservationProps {
	element: HTMLElement | undefined
	isHidden: Boolean
}

export function useFocusPreservation({ element, isHidden }: UseFocusPreservationProps) {
	const [isFocused, setIsFocused] = useState(false)
	const isHiddenRef = useRef(isHidden)

	useEffect(() => {
		isHiddenRef.current = isHidden
	}, [isHidden])

	useEffect(() => {
		const timer = setTimeout(() => {
			if (!isHidden && isFocused) {
				element?.focus()
			}
		}, 50)
		return () => {
			clearTimeout(timer)
		}
	}, [isHidden, element, isFocused])

	const onTextAreaFocus = (event: FocusEvent) => {
		setIsFocused(true)
	}

	const onTextAreaBlur = (event: FocusEvent) => {
		// We wil get blur events when the element is hidden
		// don't count these as an intentional loss of focus.
		if (!isHiddenRef.current) {
			setIsFocused(false)
		}
	}

	useMount(() => {
		element?.addEventListener("focus", onTextAreaFocus)
		element?.addEventListener("blur", onTextAreaBlur)
		return () => {
			element?.removeEventListener("focus", onTextAreaFocus)
			element?.removeEventListener("blur", onTextAreaBlur)
		}
	})
}
