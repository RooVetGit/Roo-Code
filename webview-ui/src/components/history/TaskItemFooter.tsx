import React from "react"
import type { HistoryItem } from "@roo-code/types"
import { Coins, FileIcon } from "lucide-react"
import prettyBytes from "pretty-bytes"
import { formatLargeNumber } from "@/utils/format"
import { CopyButton } from "./CopyButton"
import { ExportButton } from "./ExportButton"
import { Button, StandardTooltip } from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"

export interface TaskItemFooterProps {
	item: HistoryItem
	variant: "compact" | "full"
	isSelectionMode?: boolean
	onResumeClick?: (e: React.MouseEvent) => void
}

const TaskItemFooter: React.FC<TaskItemFooterProps> = ({ item, variant, isSelectionMode = false, onResumeClick }) => {
	const { t } = useAppTranslation()
	return (
		<div className="text-xs text-vscode-descriptionForeground flex justify-between items-center mt-1">
			<div className="flex gap-2">
				{!!(item.cacheReads || item.cacheWrites) && (
					<span className="flex items-center" data-testid="cache-compact">
						<i className="mr-1 codicon codicon-cloud-upload text-sm! text-vscode-descriptionForeground" />
						<span className="inline-block mr-1">{formatLargeNumber(item.cacheWrites || 0)}</span>
						<i className="mr-1 codicon codicon-cloud-download text-sm! text-vscode-descriptionForeground" />
						<span>{formatLargeNumber(item.cacheReads || 0)}</span>
					</span>
				)}

				{/* Full Tokens */}
				{!!(item.tokensIn || item.tokensOut) && (
					<span className="flex items-center gap-1">
						<span data-testid="tokens-in-footer-compact">↑ {formatLargeNumber(item.tokensIn || 0)}</span>
						<span data-testid="tokens-out-footer-compact">↓ {formatLargeNumber(item.tokensOut || 0)}</span>
					</span>
				)}

				{/* Full Cost */}
				{!!item.totalCost && (
					<span className="flex items-center">
						<Coins className="inline-block size-[1em] mr-1" />
						<span data-testid="cost-footer-compact">{"$" + item.totalCost.toFixed(2)}</span>
					</span>
				)}

				{!!item.size && (
					<span className="flex items-center">
						<FileIcon className="inline-block size-[1em] mr-1" />
						<span data-testid="size-footer-compact">{prettyBytes(item.size)}</span>
					</span>
				)}
			</div>

			{/* Action Buttons for non-compact view */}
			{!isSelectionMode && (
				<div className="flex flex-row gap-0 items-center opacity-50 hover:opacity-100">
					{onResumeClick && (
						<StandardTooltip content={t("history:resumeTask")}>
							<Button
								variant="ghost"
								size="icon"
								className="group-hover:opacity-100 transition-opacity"
								onClick={onResumeClick}>
								<span className="codicon codicon-play scale-80" />
							</Button>
						</StandardTooltip>
					)}
					<CopyButton itemTask={item.task} />
					{variant === "full" && <ExportButton itemId={item.id} />}
				</div>
			)}
		</div>
	)
}

export default TaskItemFooter
