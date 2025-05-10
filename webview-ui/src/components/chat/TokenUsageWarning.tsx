import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "../ui/button"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { calculateTokenDistribution, getMaxTokensForModel } from "@src/utils/model-utils"
import { useSelectedModel } from "../ui/hooks/useSelectedModel"
import { useState, useEffect } from "react"

interface TokenUsageWarningProps {
	contextTokens: number
	tokensIn: number
	tokensOut: number
	totalCost: number
	onStartNewTask: () => void
	forceShow?: boolean
}

const TokenUsageWarning = ({
	contextTokens,
	tokensIn,
	tokensOut,
	totalCost,
	onStartNewTask,
	forceShow,
}: TokenUsageWarningProps) => {
	const { t } = useAppTranslation()
	const [isDismissed, setIsDismissed] = useState(false)

	useEffect(() => {
		if (forceShow) {
			setIsDismissed(false)
		}
	}, [forceShow])
	const { apiConfiguration } = useExtensionState()
	const warningThreshold = apiConfiguration?.warningThreshold
	const { info: model } = useSelectedModel(apiConfiguration)
	const contextWindow = model?.contextWindow || 1
	const maxTokens = getMaxTokensForModel(model, apiConfiguration)

	// Calculate token distribution using shared utility
	const { currentPercent } = calculateTokenDistribution(contextWindow, contextTokens || 0, maxTokens)
	const contextPercent = currentPercent / 100 // Convert percentage to decimal for threshold comparison

	// Check if any thresholds are exceeded using configured or default values
	// Skip warning if threshold is -1 (disabled)
	const showContextWarning =
		warningThreshold?.context !== -1 && contextPercent > (warningThreshold?.context ?? 75) / 100
	const showTokensWarning =
		warningThreshold?.tokens !== -1 && tokensIn + tokensOut > (warningThreshold?.tokens ?? 5_500_000)
	const showCostWarning = warningThreshold?.cost !== -1 && totalCost > (warningThreshold?.cost ?? 2)

	if ((isDismissed && !forceShow) || (!showContextWarning && !showTokensWarning && !showCostWarning)) {
		return null
	}

	const handleDismiss = () => {
		setIsDismissed(true)
	}

	return (
		<div
			className="flex flex-col w-full p-3 mb-3 bg-[color-mix(in_srgb,var(--vscode-editorWarning-background)_15%,transparent)] border-l-4 border-[var(--vscode-editorWarning-foreground)] rounded shadow-sm transition-all space-y-2"
			role="alert"
			aria-live="polite">
			{/* Warnings Section */}
			<div className="flex flex-col space-y-1.5">
				{showContextWarning && (
					<div className="flex items-center gap-2">
						<span
							className="codicon codicon-warning text-[var(--vscode-editorWarning-foreground)] opacity-90"
							aria-hidden="true"
						/>
						<span className="text-vscode-foreground text-sm font-medium">
							{t("chat:warning.contextLimit", {
								percent: Math.round(contextPercent * 100),
							})}
						</span>
					</div>
				)}
				{showTokensWarning && (
					<div className="flex items-center gap-2">
						<span
							className="codicon codicon-warning text-[var(--vscode-editorWarning-foreground)] opacity-90"
							aria-hidden="true"
						/>
						<span className="text-vscode-foreground text-sm">
							{t("chat:warning.tokenLimit", {
								tokens: tokensIn + tokensOut,
							})}
						</span>
					</div>
				)}
				{showCostWarning && (
					<div className="flex items-center gap-2">
						<span
							className="codicon codicon-warning text-[var(--vscode-editorWarning-foreground)] opacity-90"
							aria-hidden="true"
						/>
						<span className="text-vscode-foreground text-sm">
							{t("chat:warning.costLimit", {
								cost: totalCost.toFixed(2),
							})}
						</span>
					</div>
				)}
			</div>

			{/* Action Buttons */}
			<div className="flex justify-end space-x-2">
				<Button
					variant="ghost"
					size="sm"
					className="hover:bg-[var(--vscode-button-secondaryHoverBackground)] focus:ring-2 focus:ring-[var(--vscode-editorWarning-foreground)] focus:outline-none transition-colors font-medium"
					onClick={handleDismiss}
					aria-label={t("common:dismiss")}>
					{t("common:dismiss")}
				</Button>
				<Button
					variant="secondary"
					size="sm"
					className="hover:bg-[var(--vscode-button-secondaryHoverBackground)] focus:ring-2 focus:ring-[var(--vscode-editorWarning-foreground)] focus:outline-none transition-colors font-medium"
					onClick={onStartNewTask}
					aria-label={t("chat:startNewTask.title")}>
					{t("chat:startNewTask.title")}
				</Button>
			</div>
		</div>
	)
}

export default TokenUsageWarning
