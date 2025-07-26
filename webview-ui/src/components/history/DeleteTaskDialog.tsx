import { useCallback, useEffect } from "react"
import { useKeyPress } from "react-use"
import { AlertDialogProps } from "@radix-ui/react-alert-dialog"

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
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useExtensionState } from "@/context/ExtensionStateContext"

import { vscode } from "@/utils/vscode"

interface DeleteTaskDialogProps extends AlertDialogProps {
	taskId: string
}

export const DeleteTaskDialog = ({ taskId, ...props }: DeleteTaskDialogProps) => {
	const { t } = useAppTranslation()
	const [isEnterPressed] = useKeyPress("Enter")
	const { taskHistory } = useExtensionState()

	const { onOpenChange } = props

	// Check if the task is starred
	const task = taskHistory.find((item) => item.id === taskId)
	const isStarred = task?.starred || false

	const onDelete = useCallback(() => {
		if (taskId) {
			vscode.postMessage({ type: "deleteTaskWithId", text: taskId })
			onOpenChange?.(false)
		}
	}, [taskId, onOpenChange])

	useEffect(() => {
		if (taskId && isEnterPressed && !isStarred) {
			onDelete()
		}
	}, [taskId, isEnterPressed, isStarred, onDelete])

	return (
		<AlertDialog {...props}>
			<AlertDialogContent onEscapeKeyDown={() => onOpenChange?.(false)}>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{isStarred ? t("history:deleteStarredTask") : t("history:deleteTask")}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{isStarred ? t("history:deleteStarredTaskMessage") : t("history:deleteTaskMessage")}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel asChild>
						<Button variant="secondary">{t("history:cancel")}</Button>
					</AlertDialogCancel>
					{!isStarred && (
						<AlertDialogAction asChild>
							<Button variant="destructive" onClick={onDelete}>
								{t("history:delete")}
							</Button>
						</AlertDialogAction>
					)}
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
