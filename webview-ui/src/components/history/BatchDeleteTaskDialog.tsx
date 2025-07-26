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

	// Filter out starred tasks
	const { deletableTaskIds, starredCount } = useMemo(() => {
		const deletable: string[] = []
		let starred = 0

		taskIds.forEach((id) => {
			const task = taskHistory.find((item) => item.id === id)
			if (task?.starred) {
				starred++
			} else {
				deletable.push(id)
			}
		})

		return { deletableTaskIds: deletable, starredCount: starred }
	}, [taskIds, taskHistory])

	const onDelete = useCallback(() => {
		if (deletableTaskIds.length > 0) {
			vscode.postMessage({ type: "deleteMultipleTasksWithIds", ids: deletableTaskIds })
			onOpenChange?.(false)
		}
	}, [deletableTaskIds, onOpenChange])

	return (
		<AlertDialog {...props}>
			<AlertDialogContent className="max-w-md">
				<AlertDialogHeader>
					<AlertDialogTitle>{t("history:deleteTasks")}</AlertDialogTitle>
					<AlertDialogDescription className="text-vscode-foreground">
						{starredCount > 0 ? (
							<>
								<div className="mb-2 text-vscode-notificationsWarningIcon-foreground">
									{t("history:starredTasksExcluded", { count: starredCount })}
								</div>
								{deletableTaskIds.length > 0 && (
									<div className="mb-2">
										{t("history:confirmDeleteTasks", { count: deletableTaskIds.length })}
									</div>
								)}
							</>
						) : (
							<div className="mb-2">
								{t("history:confirmDeleteTasks", { count: deletableTaskIds.length })}
							</div>
						)}
						{deletableTaskIds.length > 0 && (
							<div className="text-vscode-editor-foreground bg-vscode-editor-background p-2 rounded text-sm">
								{t("history:deleteTasksWarning")}
							</div>
						)}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel asChild>
						<Button variant="secondary">{t("history:cancel")}</Button>
					</AlertDialogCancel>
					{deletableTaskIds.length > 0 && (
						<AlertDialogAction asChild>
							<Button variant="destructive" onClick={onDelete}>
								<span className="codicon codicon-trash mr-1"></span>
								{t("history:deleteItems", { count: deletableTaskIds.length })}
							</Button>
						</AlertDialogAction>
					)}
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
