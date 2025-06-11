import React, { useState, useEffect, useMemo } from "react"
import { cn } from "@src/lib/utils"
import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useTooltip } from "@/hooks/useTooltip"
import type { IndexingStatus, IndexingStatusUpdateMessage } from "@roo/ExtensionMessage"

interface IndexingStatusDotProps {
	onNavigateToSettings?: () => void
	className?: string
}

export const IndexingStatusDot: React.FC<IndexingStatusDotProps> = ({ onNavigateToSettings, className }) => {
	const { t } = useAppTranslation()
	const { showTooltip, handleMouseEnter, handleMouseLeave, cleanup } = useTooltip({ delay: 300 })

	const [indexingStatus, setIndexingStatus] = useState<IndexingStatus>({
		systemStatus: "Standby",
		processedItems: 0,
		totalItems: 0,
		currentItemUnit: "items",
	})

	useEffect(() => {
		// Request initial indexing status
		vscode.postMessage({ type: "requestIndexingStatus" })

		// Set up message listener for status updates
		const handleMessage = (event: MessageEvent<IndexingStatusUpdateMessage>) => {
			if (event.data.type === "indexingStatusUpdate") {
				const status = event.data.values
				setIndexingStatus(status)
			}
		}

		window.addEventListener("message", handleMessage)

		return () => {
			window.removeEventListener("message", handleMessage)
			cleanup()
		}
	}, [cleanup])

	// Calculate progress percentage with memoization
	const progressPercentage = useMemo(
		() =>
			indexingStatus.totalItems > 0
				? Math.round((indexingStatus.processedItems / indexingStatus.totalItems) * 100)
				: 0,
		[indexingStatus.processedItems, indexingStatus.totalItems],
	)

	// Get tooltip text with internationalization
	const getTooltipText = () => {
		switch (indexingStatus.systemStatus) {
			case "Standby":
				return t("chat:indexingStatus.ready")
			case "Indexing":
				return t("chat:indexingStatus.indexing", { percentage: progressPercentage })
			case "Indexed":
				return t("chat:indexingStatus.indexed")
			case "Error":
				return t("chat:indexingStatus.error")
			default:
				return t("chat:indexingStatus.status")
		}
	}

	// Navigate to settings when clicked
	const handleClick = () => {
		if (onNavigateToSettings) {
			onNavigateToSettings()
		}
	}

	// SVG circle parameters
	const radius = 10
	const circumference = 2 * Math.PI * radius
	const strokeDashoffset = circumference - (progressPercentage / 100) * circumference

	return (
		<div className={cn("relative inline-block", className)}>
			<button
				onClick={handleClick}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
				className={cn(
					"flex items-center justify-center w-7 h-7 rounded-md",
					"bg-transparent hover:bg-vscode-list-hoverBackground",
					"cursor-pointer transition-all duration-200",
					"opacity-85 hover:opacity-100 relative",
				)}
				aria-label={getTooltipText()}>
				{/* Progress ring - only show during indexing */}
				{indexingStatus.systemStatus === "Indexing" && (
					<svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 24 24">
						{/* Background circle */}
						<circle
							cx="12"
							cy="12"
							r={radius}
							stroke="currentColor"
							strokeWidth="1.5"
							fill="none"
							className="text-vscode-descriptionForeground/20"
						/>
						{/* Progress circle */}
						<circle
							cx="12"
							cy="12"
							r={radius}
							stroke="currentColor"
							strokeWidth="1.5"
							fill="none"
							className="text-yellow-500 transition-all duration-500 ease-out"
							strokeDasharray={circumference}
							strokeDashoffset={strokeDashoffset}
							strokeLinecap="round"
						/>
					</svg>
				)}
				{/* Status dot */}
				<span
					className={cn(
						"inline-block w-2 h-2 rounded-full relative z-10",
						indexingStatus.systemStatus === "Standby" && "bg-vscode-descriptionForeground/60",
						indexingStatus.systemStatus === "Indexing" && "bg-yellow-500", // Remove animate-pulse since ring provides animation
						indexingStatus.systemStatus === "Indexed" && "bg-green-500",
						indexingStatus.systemStatus === "Error" && "bg-red-500",
					)}
				/>
			</button>
			{showTooltip && (
				<div
					className={cn(
						"absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2",
						"px-2 py-1 text-xs font-medium text-vscode-foreground",
						"bg-vscode-editor-background border border-vscode-panel-border",
						"rounded shadow-lg whitespace-nowrap z-50",
					)}
					role="tooltip">
					{getTooltipText()}
					<div
						className={cn(
							"absolute top-full left-1/2 transform -translate-x-1/2",
							"w-0 h-0 border-l-4 border-r-4 border-t-4",
							"border-l-transparent border-r-transparent border-t-vscode-panel-border",
						)}
					/>
				</div>
			)}
		</div>
	)
}
