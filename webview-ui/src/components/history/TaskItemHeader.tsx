import React from "react"
import type { HistoryItem } from "@roo-code/types"
import { formatDate } from "@/utils/format"
import { DeleteButton } from "./DeleteButton"
import { StarButton } from "./StarButton"
import { cn } from "@/lib/utils"
import { vscode } from "@/utils/vscode"

export interface TaskItemHeaderProps {
	item: HistoryItem
	isSelectionMode: boolean
	onDelete?: (taskId: string) => void
}

const TaskItemHeader: React.FC<TaskItemHeaderProps> = ({ item, isSelectionMode, onDelete }) => {
	const handleToggleStar = (itemId: string) => {
		vscode.postMessage({ type: "toggleTaskStar", text: itemId })
	}

	return (
		<div
			className={cn("flex justify-between items-center", {
				// this is to balance out the margin when we don't have a delete button
				// because the delete button sorta pushes the date up due to its size
				"mb-1": !onDelete && !item.starred,
			})}>
			<div className="flex items-center flex-wrap gap-x-2 text-xs">
				<span className="text-vscode-descriptionForeground font-medium text-sm uppercase">
					{formatDate(item.ts)}
				</span>
			</div>

			{/* Action Buttons */}
			{!isSelectionMode && (
				<div className="flex flex-row gap-0 items-center opacity-20 group-hover:opacity-50 hover:opacity-100">
					<StarButton itemId={item.id} isStarred={item.starred} onToggleStar={handleToggleStar} />
					{onDelete && <DeleteButton itemId={item.id} onDelete={onDelete} />}
				</div>
			)}
		</div>
	)
}

export default TaskItemHeader
