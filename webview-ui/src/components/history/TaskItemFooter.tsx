import React from "react"
import type { HistoryItem } from "@roo-code/types"
import { Coins, FileIcon } from "lucide-react"
import prettyBytes from "pretty-bytes"
import { formatLargeNumber } from "@/utils/format"
import { CopyButton } from "./CopyButton"
import { ExportButton } from "./ExportButton"

export interface TaskItemFooterProps {
	item: HistoryItem
	variant: "compact" | "full"
	isSelectionMode?: boolean
}

const TaskItemFooter: React.FC<TaskItemFooterProps> = ({ item, variant, isSelectionMode = false }) => {
	const metadataIconWithTextAdjustStyle: React.CSSProperties = {
		fontSize: "12px",
		color: "var(--vscode-descriptionForeground)",
		verticalAlign: "middle",
		marginBottom: "-2px",
		fontWeight: "bold",
	}

	return (
		<div className="text-xs text-vscode-descriptionForeground flex justify-between items-center mt-1">
			<div className="flex gap-2">
				{!!item.cacheWrites && (
					<span className="flex items-center gap-px" data-testid="cache-compact">
						<i className="codicon codicon-database" style={metadataIconWithTextAdjustStyle} />
						{formatLargeNumber(item.cacheWrites || 0)}
						<i className="codicon codicon-arrow-right" style={metadataIconWithTextAdjustStyle} />
						{formatLargeNumber(item.cacheReads || 0)}
					</span>
				)}

				{/* Full Tokens */}
				{(item.tokensIn || item.tokensOut) && (
					<>
						<span data-testid="tokens-in-footer-compact">↑ {formatLargeNumber(item.tokensIn || 0)}</span>
						<span data-testid="tokens-out-footer-compact">↓ {formatLargeNumber(item.tokensOut || 0)}</span>
					</>
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
					<CopyButton itemTask={item.task} />
					{variant === "full" && <ExportButton itemId={item.id} />}
				</div>
			)}
		</div>
	)
}

export default TaskItemFooter
