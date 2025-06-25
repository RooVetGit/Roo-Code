import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { formatLargeNumber } from "@/utils/format"
import { calculateTokenDistribution } from "@/utils/model-utils"
import { StandardTooltip } from "@/components/ui"

interface ContextWindowProgressProps {
	contextWindow: number
	contextTokens: number
	maxTokens?: number
}

export const ContextWindowProgress = ({ contextWindow, contextTokens, maxTokens }: ContextWindowProgressProps) => {
	const { t } = useTranslation()

	// Use the shared utility function to calculate all token distribution values
	const tokenDistribution = useMemo(
		() => calculateTokenDistribution(contextWindow, contextTokens, maxTokens),
		[contextWindow, contextTokens, maxTokens],
	)

	// Destructure the values we need
	const { currentPercent, reservedPercent, availableSize, reservedForOutput, availablePercent } = tokenDistribution

	// For display purposes
	const safeContextWindow = Math.max(0, contextWindow)
	const safeContextTokens = Math.max(0, contextTokens)

	return (
		<>
			<div className="flex items-center gap-2 flex-1 whitespace-nowrap px-2">
				<div data-testid="context-tokens-count">{formatLargeNumber(safeContextTokens)}</div>
				<StandardTooltip
					content={t("chat:tokenProgress.availableSpace", { amount: formatLargeNumber(availableSize) })}
					side="top"
					sideOffset={8}>
					<div className="flex-1 relative">
						{/* Main progress bar container */}
						<div className="flex items-center h-1 rounded-[2px] overflow-hidden w-full bg-[color-mix(in_srgb,var(--vscode-foreground)_20%,transparent)]">
							{/* Current tokens container */}
							<StandardTooltip
								content={t("chat:tokenProgress.tokensUsed", {
									used: formatLargeNumber(safeContextTokens),
									total: formatLargeNumber(safeContextWindow),
								})}
								side="top"
								sideOffset={8}
								asChild={false}>
								<div className="relative h-full" style={{ width: `${currentPercent}%` }}>
									{/* Current tokens used - darkest */}
									<div className="h-full w-full bg-[var(--vscode-foreground)] transition-width duration-300 ease-out" />
								</div>
							</StandardTooltip>

							{/* Container for reserved tokens */}
							<StandardTooltip
								content={t("chat:tokenProgress.reservedForResponse", {
									amount: formatLargeNumber(reservedForOutput),
								})}
								side="top"
								sideOffset={8}
								asChild={false}>
								<div className="relative h-full" style={{ width: `${reservedPercent}%` }}>
									{/* Reserved for output section - medium gray */}
									<div className="h-full w-full bg-[color-mix(in_srgb,var(--vscode-foreground)_30%,transparent)] transition-width duration-300 ease-out" />
								</div>
							</StandardTooltip>

							{/* Empty section (if any) */}
							{availablePercent > 0 && (
								<StandardTooltip
									content={t("chat:tokenProgress.availableSpace", {
										amount: formatLargeNumber(availableSize),
									})}
									side="top"
									sideOffset={8}
									asChild={false}>
									<div className="relative h-full" style={{ width: `${availablePercent}%` }}>
										{/* Available space - transparent */}
									</div>
								</StandardTooltip>
							)}
						</div>
					</div>
				</StandardTooltip>
				<div data-testid="context-window-size">{formatLargeNumber(safeContextWindow)}</div>
			</div>
		</>
	)
}
