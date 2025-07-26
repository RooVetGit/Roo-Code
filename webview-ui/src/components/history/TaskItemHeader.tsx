import React from "react"
import type { HistoryItem } from "@roo-code/types"
import { formatDate } from "@/utils/format"
import { DeleteButton } from "./DeleteButton"
import { cn } from "@/lib/utils"
import { vscode } from "@/utils/vscode"

export interface TaskItemHeaderProps {
	item: HistoryItem
	isSelectionMode: boolean
	onDelete?: (taskId: string) => void
}

const TaskItemHeader: React.FC<TaskItemHeaderProps> = ({ item, isSelectionMode, onDelete }) => {
	const handleStarClick = (e: React.MouseEvent) => {
		e.stopPropagation()
		vscode.postMessage({ type: "toggleTaskStar", text: item.id })
	}

	return (
		<div
			className={cn("flex justify-between items-center", {
				// this is to balance out the margin when we don't have a delete button
				// because the delete button sorta pushes the date up due to its size
				"mb-1": !onDelete && !item.isStarred,
			})}>
			<div className="flex items-center flex-wrap gap-x-2 text-xs">
				<span className="text-vscode-descriptionForeground font-medium text-sm uppercase">
					{formatDate(item.ts)}
				</span>
				{item.isStarred && (
					<span className="text-vscode-textPreformat-foreground" title="Starred task">
						<i className="codicon codicon-star-full" />
					</span>
				)}
			</div>

			{/* Action Buttons */}
			{!isSelectionMode && (
				<div className="flex flex-row gap-0 items-center opacity-20 group-hover:opacity-50 hover:opacity-100">
					<button
						onClick={handleStarClick}
						className="p-1 hover:bg-vscode-toolbar-hoverBackground rounded"
						title={item.isStarred ? "Unstar task" : "Star task"}>
						<i className={cn("codicon", item.isStarred ? "codicon-star-full" : "codicon-star-empty")} />
					</button>
					{onDelete && <DeleteButton itemId={item.id} onDelete={onDelete} />}
				</div>
			)}
		</div>
	)
}

export default TaskItemHeader
