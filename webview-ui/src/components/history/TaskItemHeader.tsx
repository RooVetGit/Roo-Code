import React from "react"
import type { HistoryItem } from "@roo-code/types"
import prettyBytes from "pretty-bytes"
import { Coins } from "lucide-react"
import { vscode } from "@/utils/vscode"
import { formatLargeNumber, formatDate } from "@/utils/format"
import { Button } from "@/components/ui"
import { CopyButton } from "./CopyButton"
import { ExportButton } from "./ExportButton"

export interface TaskItemHeaderProps {
	item: HistoryItem
	variant: "compact" | "full"
	isSelectionMode: boolean
	t: (key: string, options?: any) => string
	onDelete?: (taskId: string) => void
}

export const TaskItemHeader: React.FC<TaskItemHeaderProps> = ({ item, variant, isSelectionMode, t, onDelete }) => {
	const isCompact = variant === "compact"

	// Standardized icon styles
	const metadataIconStyle: React.CSSProperties = {
		fontSize: "12px",
		color: "var(--vscode-descriptionForeground)",
		verticalAlign: "middle",
	}

	const metadataIconWithTextAdjustStyle: React.CSSProperties = {
		...metadataIconStyle,
		marginBottom: "-2px",
	}

	const actionIconStyle: React.CSSProperties = {
		fontSize: "16px",
		color: "var(--vscode-descriptionForeground)",
		verticalAlign: "middle",
	}

	const handleDeleteClick = (e: React.MouseEvent) => {
		e.stopPropagation()
		if (e.shiftKey) {
			vscode.postMessage({ type: "deleteTaskWithId", text: item.id })
		} else if (onDelete) {
			onDelete(item.id)
		}
	}

	return (
		<div className="flex justify-between items-center pb-0">
			<div className="flex items-center flex-wrap gap-x-2 text-xs">
				<span className="text-vscode-descriptionForeground font-medium text-sm uppercase">
					{formatDate(item.ts)}
				</span>

				{/* Tokens Info */}
				{(item.tokensIn || item.tokensOut) && (
					<span className="text-vscode-descriptionForeground flex items-center gap-px">
						<i className="codicon codicon-arrow-up" style={metadataIconWithTextAdjustStyle} />
						{formatLargeNumber(item.tokensIn || 0)}
						<i className="codicon codicon-arrow-down" style={metadataIconWithTextAdjustStyle} />
						{formatLargeNumber(item.tokensOut || 0)}
					</span>
				)}

				{/* Cost Info */}
				{!!item.totalCost && (
					<span className="text-vscode-descriptionForeground flex items-center gap-px">
						<Coins className="inline-block size-[1em]" />$
						{isCompact ? item.totalCost.toFixed(2) : item.totalCost.toFixed(4)}
					</span>
				)}

				{/* Cache Info */}
				{!!item.cacheWrites && (
					<span className="text-vscode-descriptionForeground flex items-center gap-px">
						<i className="codicon codicon-database" style={metadataIconWithTextAdjustStyle} />
						{formatLargeNumber(item.cacheWrites || 0)}
						<i className="codicon codicon-arrow-right" style={metadataIconWithTextAdjustStyle} />
						{formatLargeNumber(item.cacheReads || 0)}
					</span>
				)}

				{/* Size Info - only in full variant */}
				{!isCompact && item.size && (
					<span className="text-vscode-descriptionForeground">{prettyBytes(item.size)}</span>
				)}
			</div>

			{/* Action Buttons */}
			{!isSelectionMode && (
				<div className="flex flex-row gap-0 items-center opacity-50 hover:opacity-100">
					{isCompact ? (
						<CopyButton itemTask={item.task} />
					) : (
						<>
							<CopyButton itemTask={item.task} />
							<ExportButton itemId={item.id} />
							{onDelete && (
								<Button
									variant="ghost"
									size="icon"
									title={t("history:deleteTaskTitle")}
									data-testid="delete-task-button"
									onClick={handleDeleteClick}>
									<span className="codicon codicon-trash" style={actionIconStyle} />
								</Button>
							)}
						</>
					)}
				</div>
			)}
		</div>
	)
}

export default React.memo(TaskItemHeader)
