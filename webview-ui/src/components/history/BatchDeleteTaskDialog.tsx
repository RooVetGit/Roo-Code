import { useCallback, useMemo } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
} from "@/components/ui"
import { vscode } from "@/utils/vscode"
import { AlertDialogProps } from "@radix-ui/react-alert-dialog"
import { useExtensionState } from "@/context/ExtensionStateContext"

interface BatchDeleteTaskDialogProps extends AlertDialogProps {
	taskIds: string[]
}

export const BatchDeleteTaskDialog = ({ taskIds, ...props }: BatchDeleteTaskDialogProps) => {
	const { t } = useAppTranslation()
	const { onOpenChange } = props
	const { taskHistory } = useExtensionState()

	// Check if any of the selected tasks are starred
	const starredTaskIds = useMemo(() => {
		return taskIds.filter((id) => {
			const task = taskHistory.find((t) => t.id === id)
			return task?.isStarred || false
		})
	}, [taskIds, taskHistory])

	const hasStarredTasks = starredTaskIds.length > 0
	const unstarredTaskIds = taskIds.filter((id) => !starredTaskIds.includes(id))

	const onDelete = useCallback(() => {
		if (unstarredTaskIds.length > 0) {
			vscode.postMessage({ type: "deleteMultipleTasksWithIds", ids: unstarredTaskIds })
			onOpenChange?.(false)
		}
	}, [unstarredTaskIds, onOpenChange])

	return (
		<AlertDialog {...props}>
			<AlertDialogContent className="max-w-md">
				<AlertDialogHeader>
					<AlertDialogTitle>{t("history:deleteTasks")}</AlertDialogTitle>
					<AlertDialogDescription className="text-vscode-foreground">
						{hasStarredTasks ? (
							<>
								<div className="mb-2 text-vscode-errorForeground">
									{starredTaskIds.length === taskIds.length
										? "All selected tasks are starred. Please unstar them before deleting."
										: `${starredTaskIds.length} of ${taskIds.length} selected tasks are starred and will not be deleted.`}
								</div>
								{unstarredTaskIds.length > 0 && (
									<>
										<div className="mb-2">
											{t("history:confirmDeleteTasks", { count: unstarredTaskIds.length })}
										</div>
										<div className="text-vscode-editor-foreground bg-vscode-editor-background p-2 rounded text-sm">
											{t("history:deleteTasksWarning")}
										</div>
									</>
								)}
							</>
						) : (
							<>
								<div className="mb-2">{t("history:confirmDeleteTasks", { count: taskIds.length })}</div>
								<div className="text-vscode-editor-foreground bg-vscode-editor-background p-2 rounded text-sm">
									{t("history:deleteTasksWarning")}
								</div>
							</>
						)}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel asChild>
						<Button variant="secondary">{t("history:cancel")}</Button>
					</AlertDialogCancel>
					{unstarredTaskIds.length > 0 && (
						<AlertDialogAction asChild>
							<Button variant="destructive" onClick={onDelete}>
								<span className="codicon codicon-trash mr-1"></span>
								{t("history:deleteItems", { count: unstarredTaskIds.length })}
							</Button>
						</AlertDialogAction>
					)}
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
