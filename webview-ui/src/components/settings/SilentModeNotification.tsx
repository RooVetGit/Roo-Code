import React, { useState, useEffect } from "react"
import { VSCodeButton, VSCodeBadge } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "../../i18n/TranslationContext"
import { vscode } from "../../utils/vscode"

interface SilentModeNotificationProps {
	isVisible: boolean
	summary?: {
		filesChanged: number
		linesAdded: number
		linesRemoved: number
		changes: any[]
	}
	onReview: () => void
	onApplyAll: () => void
	onDismiss: () => void
}

export const SilentModeNotification: React.FC<SilentModeNotificationProps> = ({
	isVisible,
	summary,
	onReview,
	onApplyAll,
	onDismiss,
}) => {
	const { t } = useAppTranslation()
	const [isAnimating, setIsAnimating] = useState(false)

	useEffect(() => {
		if (isVisible) {
			setIsAnimating(true)
			// Play completion sound
			vscode.postMessage({ type: "playSilentModeCompletionSound" })
		}
	}, [isVisible])

	if (!isVisible || !summary) {
		return null
	}

	const filesText = summary.filesChanged === 1 ? "file" : "files"
	const totalChanges = summary.linesAdded + summary.linesRemoved

	return (
		<div
			className={`
				fixed top-4 right-4 z-50 
				bg-vscode-notifications-background 
				border border-vscode-notifications-border 
				rounded-lg shadow-lg p-4 min-w-80 max-w-96
				transform transition-all duration-300 ease-in-out
				${isAnimating ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}
			`}
			style={{
				backgroundColor: "var(--vscode-notifications-background)",
				borderColor: "var(--vscode-notifications-border)",
				color: "var(--vscode-notifications-foreground)",
			}}>
			{/* Header */}
			<div className="flex items-center justify-between mb-3">
				<div className="flex items-center gap-2">
					<span className="text-xl">🎉</span>
					<h3 className="font-semibold text-sm">{t("silentMode.notification.title")}</h3>
				</div>
				<button
					onClick={onDismiss}
					className="text-vscode-notifications-foreground hover:bg-vscode-button-hoverBackground rounded px-1"
					style={{ fontSize: "16px", lineHeight: "1" }}>
					×
				</button>
			</div>

			{/* Summary */}
			<div className="mb-4">
				<p className="text-sm mb-2">
					Modified <VSCodeBadge>{summary.filesChanged}</VSCodeBadge> {filesText} with{" "}
					<VSCodeBadge>{totalChanges}</VSCodeBadge> changes
				</p>

				{summary.linesAdded > 0 && (
					<div className="text-xs text-green-400 mb-1">+{summary.linesAdded} lines added</div>
				)}

				{summary.linesRemoved > 0 && (
					<div className="text-xs text-red-400 mb-1">-{summary.linesRemoved} lines removed</div>
				)}
			</div>

			{/* Action Buttons */}
			<div className="flex gap-2">
				<VSCodeButton onClick={onReview} className="flex-1" appearance="primary">
					Review Changes
				</VSCodeButton>

				<VSCodeButton onClick={onApplyAll} className="flex-1" appearance="secondary">
					Apply All
				</VSCodeButton>
			</div>

			{/* Progress indicator */}
			<div className="mt-3 text-xs text-vscode-descriptionForeground">Silent Mode completed successfully</div>
		</div>
	)
}
