import { useState, useEffect, useCallback } from "react"
import { vscode } from "../utils/vscode"
import type { ExtensionMessage } from "../../../src/shared/ExtensionMessage"

interface UseRefreshableContentResult {
	isRefreshing: boolean
	showRefreshSuccess: boolean
	refreshContent: () => void
}

export function useRefreshableContent(contentId: string): UseRefreshableContentResult {
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [showRefreshSuccess, setShowRefreshSuccess] = useState(false)

	useEffect(() => {
		const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
			const message = event.data
			if (message.type === "contentRefreshed" && message.contentId === contentId) {
				setIsRefreshing(false)
				if (message.success) {
					setShowRefreshSuccess(true)
					const timer = setTimeout(() => {
						setShowRefreshSuccess(false)
					}, 3000)
					return () => clearTimeout(timer)
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [contentId])

	const refreshContent = useCallback(() => {
		setIsRefreshing(true)
		vscode.postMessage({
			type: "refreshContent",
			contentId,
		})
	}, [contentId])

	return { isRefreshing, showRefreshSuccess, refreshContent }
}
