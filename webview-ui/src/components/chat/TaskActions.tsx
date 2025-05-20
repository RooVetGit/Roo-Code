import { useState } from "react"
import prettyBytes from "pretty-bytes"
import { useTranslation } from "react-i18next"

import { vscode } from "@/utils/vscode"
import { Button } from "@/components/ui"

import { HistoryItem } from "@roo/shared/HistoryItem"

import { DeleteTaskDialog } from "../history/DeleteTaskDialog"

interface TaskActionsProps {
	item?: HistoryItem
	buttonsDisabled?: boolean
	handleCondenseContext: (taskId: string) => void
}

export const TaskActions = ({ item, handleCondenseContext }: TaskActionsProps) => {
	const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null)
	const { t } = useTranslation()

	return (
		<div className="flex flex-row gap-1">
			<Button
				variant="ghost"
				size="sm"
				title={t("chat:task.export")}
				onClick={() => vscode.postMessage({ type: "exportCurrentTask" })}>
				<span className="codicon codicon-desktop-download" />
			</Button>
			{!!item?.size && item.size > 0 && (
				<>
					<Button
						variant="ghost"
						size="sm"
						title={t("chat:task.condenseContext")}
						onClick={() => handleCondenseContext(item.id)}>
						<span className="codicon codicon-file-zip" />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						title={t("chat:task.delete")}
						onClick={(e) => {
							e.stopPropagation()

							if (e.shiftKey) {
								vscode.postMessage({ type: "deleteTaskWithId", text: item.id })
							} else {
								setDeleteTaskId(item.id)
							}
						}}>
						<span className="codicon codicon-trash" />
						{prettyBytes(item.size)}
					</Button>
					{deleteTaskId && (
						<DeleteTaskDialog
							taskId={deleteTaskId}
							onOpenChange={(open) => !open && setDeleteTaskId(null)}
							open
						/>
					)}
				</>
			)}
		</div>
	)
}
