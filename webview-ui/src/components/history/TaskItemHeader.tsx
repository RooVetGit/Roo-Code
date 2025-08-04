import React from "react"
import type { HistoryItem } from "@roo-code/types"
import { DeleteButton } from "./DeleteButton"

export interface TaskItemHeaderProps {
	item: HistoryItem
	isSelectionMode: boolean
	onDelete?: (taskId: string) => void
}

const TaskItemHeader: React.FC<TaskItemHeaderProps> = ({ item, isSelectionMode, onDelete }) => {
	// Only show delete button if needed
	if (!isSelectionMode && onDelete) {
		return (
			<div className="flex justify-end">
				<div className="flex flex-row gap-0 items-center opacity-20 group-hover:opacity-50 hover:opacity-100">
					<DeleteButton itemId={item.id} onDelete={onDelete} />
				</div>
			</div>
		)
	}

	// Return null if no header content is needed
	return null
}

export default TaskItemHeader
