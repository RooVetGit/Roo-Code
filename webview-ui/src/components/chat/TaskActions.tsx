import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Router } from "lucide-react"

import type { HistoryItem } from "@roo-code/types"

import { vscode } from "@/utils/vscode"
import { useCopyToClipboard } from "@/utils/clipboard"
import { cn } from "@/lib/utils"
import { StandardTooltip } from "@/components/ui"

import { DeleteTaskDialog } from "../history/DeleteTaskDialog"
import { IconButton } from "./IconButton"
import { ShareButton } from "./ShareButton"

interface TaskActionsProps {
	item?: HistoryItem
	buttonsDisabled: boolean
	showCloudNotification?: boolean
}

export const TaskActions = ({ item, buttonsDisabled, showCloudNotification }: TaskActionsProps) => {
	const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null)
	const { t } = useTranslation()
	const { copyWithFeedback, showCopyFeedback } = useCopyToClipboard()

	return (
		<div className="flex flex-row items-center">
			<IconButton
				iconClass="codicon-desktop-download"
				title={t("chat:task.export")}
				onClick={() => vscode.postMessage({ type: "exportCurrentTask" })}
			/>
			{item?.task && (
				<IconButton
					iconClass={showCopyFeedback ? "codicon-check" : "codicon-copy"}
					title={t("history:copyPrompt")}
					onClick={(e) => copyWithFeedback(item.task, e)}
				/>
			)}
			{!!item?.size && item.size > 0 && (
				<>
					<div className="flex items-center">
						<IconButton
							iconClass="codicon-trash"
							title={t("chat:task.delete")}
							disabled={buttonsDisabled}
							onClick={(e) => {
								e.stopPropagation()

								if (e.shiftKey) {
									vscode.postMessage({ type: "deleteTaskWithId", text: item.id })
								} else {
									setDeleteTaskId(item.id)
								}
							}}
						/>
					</div>
					{deleteTaskId && (
						<DeleteTaskDialog
							taskId={deleteTaskId}
							onOpenChange={(open) => !open && setDeleteTaskId(null)}
							open
						/>
					)}
				</>
			)}
			<ShareButton item={item} disabled={false} showLabel={false} />

			{/* Cloud icon button */}
			<div className="flex flex-grow-1 justify-end ml-2">
				<StandardTooltip content="Continue in Cloud from anywhere">
					<button
						onClick={() => console.log("Implement me")}
						className={cn(
							"flex gap-2 p-1.5 transition-all duration-150",
							"hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)]",
							"active:bg-[rgba(255,255,255,0.1)]",
							"cursor-pointer",
							showCloudNotification
								? "text-vscode-charts-blue opacity-100"
								: "text-vscode-foreground opacity-85",
						)}
						style={{ fontSize: 16.5 }}>
						<span className="text-sm">Roomote Control</span>
						<Router size={14} />
					</button>
				</StandardTooltip>
			</div>
		</div>
	)
}
