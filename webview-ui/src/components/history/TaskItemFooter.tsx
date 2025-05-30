import React from "react"
import type { HistoryItem } from "@roo-code/types"
import { Coins } from "lucide-react"
import { formatLargeNumber } from "@/utils/format"
import { cn } from "@/lib/utils"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { CopyButton } from "./CopyButton"
import { ExportButton } from "./ExportButton"

export interface TaskItemFooterProps {
	item: HistoryItem
	variant: "compact" | "full"
	isSelectionMode?: boolean
}

const TaskItemFooter: React.FC<TaskItemFooterProps> = ({ item, variant, isSelectionMode = false }) => {
	const { t } = useAppTranslation()
	const isCompact = variant === "compact"

	const metadataIconWithTextAdjustStyle: React.CSSProperties = {
		fontSize: "12px",
		color: "var(--vscode-descriptionForeground)",
		verticalAlign: "middle",
		marginBottom: "-2px",
		fontWeight: "bold",
	}

	return (
		<div
			className={cn("text-xs text-vscode-descriptionForeground", {
				"mt-2 flex items-center flex-wrap gap-x-2": isCompact,
				"mt-1 flex justify-between items-end": !isCompact,
			})}>
			{isCompact ? (
				<>
					{/* Compact Tokens */}
					{(item.tokensIn || item.tokensOut) && (
						<>
							<span data-testid="tokens-in-footer-compact">
								↑ {formatLargeNumber(item.tokensIn || 0)}
							</span>
							<span data-testid="tokens-out-footer-compact">
								↓ {formatLargeNumber(item.tokensOut || 0)}
							</span>
						</>
					)}
					{/* Compact Cost */}
					{!!item.totalCost && (
						<span className="flex items-center">
							<Coins className="inline-block size-[1em] mr-1" />
							<span data-testid="cost-footer-compact">{"$" + item.totalCost.toFixed(2)}</span>
						</span>
					)}
				</>
			) : (
				<>
					<div className="flex flex-col gap-1">
						{/* Full Tokens */}
						{(item.tokensIn || item.tokensOut) && (
							<div className="flex items-center flex-wrap gap-x-1">
								<span className="font-medium">{t("history:tokensLabel")}</span>
								<span className="flex items-center gap-px" data-testid="tokens-in-footer-full">
									<i className="codicon codicon-arrow-up" style={metadataIconWithTextAdjustStyle} />
									<span className="font-medium">{formatLargeNumber(item.tokensIn || 0)}</span>
								</span>
								<span className="flex items-center gap-px" data-testid="tokens-out-footer-full">
									<i className="codicon codicon-arrow-down" style={metadataIconWithTextAdjustStyle} />
									<span className="font-medium">{formatLargeNumber(item.tokensOut || 0)}</span>
								</span>
							</div>
						)}
						{/* Full Cost */}
						{!!item.totalCost && (
							<div className="flex items-center flex-wrap gap-x-1">
								<span className="font-medium">{t("history:apiCostLabel")}</span>
								<span data-testid="cost-footer-full">{"$" + item.totalCost.toFixed(4)}</span>
							</div>
						)}
					</div>
					{/* Action Buttons for non-compact view */}
					{!isSelectionMode && (
						<div className="flex flex-row gap-0 items-center opacity-50 hover:opacity-100">
							<CopyButton itemTask={item.task} />
							<ExportButton itemId={item.id} />
						</div>
					)}
				</>
			)}
		</div>
	)
}

export default TaskItemFooter
