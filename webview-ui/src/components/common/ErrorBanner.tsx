import React, { useState, useCallback } from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { useCopyToClipboard } from "@src/utils/clipboard"
import CodeBlock from "./CodeBlock"

export type ErrorBannerVariant = "warning" | "error" | "info"

export interface ErrorBannerProps {
	/** The title text to display in the banner */
	title: string
	/** The variant/severity of the banner */
	variant?: ErrorBannerVariant
	/** The codicon name for the icon (e.g., "warning", "error", "info") */
	icon?: string
	/** The detailed content to show when expanded */
	details?: string
	/** Whether the banner should be expanded by default */
	defaultExpanded?: boolean
	/** Optional callback when copy button is clicked */
	onCopy?: () => void
	/** Optional additional actions to display on the right side */
	actions?: React.ReactNode
	/** The language for syntax highlighting in the details section */
	detailsLanguage?: string
}

/**
 * ErrorBanner component provides a consistent, collapsible banner for displaying
 * errors, warnings, and informational messages. It follows the same visual pattern
 * as the diff_error implementation with a subtle, less jarring appearance.
 */
export const ErrorBanner: React.FC<ErrorBannerProps> = ({
	title,
	variant = "warning",
	icon,
	details,
	defaultExpanded = false,
	onCopy,
	actions,
	detailsLanguage = "xml",
}) => {
	const [isExpanded, setIsExpanded] = useState(defaultExpanded)
	const [showCopySuccess, setShowCopySuccess] = useState(false)
	const { copyWithFeedback } = useCopyToClipboard()

	// Determine the icon to use based on variant if not explicitly provided
	const iconName = icon || (variant === "error" ? "error" : variant === "info" ? "info" : "warning")

	// Determine the color based on variant
	const iconColor =
		variant === "error"
			? "var(--vscode-errorForeground)"
			: variant === "info"
				? "var(--vscode-charts-blue)"
				: "var(--vscode-editorWarning-foreground)"

	const handleToggleExpand = useCallback(() => {
		setIsExpanded(!isExpanded)
	}, [isExpanded])

	const handleCopy = useCallback(
		async (e: React.MouseEvent) => {
			e.stopPropagation()

			if (details) {
				const success = await copyWithFeedback(details)
				if (success) {
					setShowCopySuccess(true)
					setTimeout(() => {
						setShowCopySuccess(false)
					}, 1000)
				}
			}

			onCopy?.()
		},
		[details, copyWithFeedback, onCopy],
	)

	return (
		<div
			style={{
				marginTop: "0px",
				overflow: "hidden",
				marginBottom: "8px",
			}}>
			<div
				style={{
					borderBottom: isExpanded && details ? "1px solid var(--vscode-editorGroup-border)" : "none",
					fontWeight: "normal",
					fontSize: "var(--vscode-font-size)",
					color: "var(--vscode-editor-foreground)",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					cursor: details ? "pointer" : "default",
				}}
				onClick={details ? handleToggleExpand : undefined}>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "10px",
						flexGrow: 1,
					}}>
					<span
						className={`codicon codicon-${iconName}`}
						style={{
							color: iconColor,
							opacity: 0.8,
							fontSize: 16,
							marginBottom: "-1.5px",
						}}
					/>
					<span style={{ fontWeight: "bold" }}>{title}</span>
				</div>
				<div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
					{actions}
					{details && (
						<>
							<VSCodeButton
								appearance="icon"
								style={{
									padding: "3px",
									height: "24px",
									color: "var(--vscode-editor-foreground)",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									background: "transparent",
								}}
								onClick={handleCopy}
								aria-label="Copy details">
								<span className={`codicon codicon-${showCopySuccess ? "check" : "copy"}`} />
							</VSCodeButton>
							<span
								className={`codicon codicon-chevron-${isExpanded ? "up" : "down"}`}
								aria-hidden="true"
							/>
						</>
					)}
				</div>
			</div>
			{isExpanded && details && (
				<div
					style={{
						padding: "8px",
						backgroundColor: "var(--vscode-editor-background)",
						borderTop: "none",
					}}>
					<CodeBlock source={details} language={detailsLanguage} />
				</div>
			)}
		</div>
	)
}
