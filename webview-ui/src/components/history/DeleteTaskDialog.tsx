import { useCallback } from "react"
import { AlertDialogProps } from "@radix-ui/react-alert-dialog"

import { vscode } from "@/utils/vscode"
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

interface DeleteTaskDialogProps extends AlertDialogProps {
	taskId: string
}

export const DeleteTaskDialog = ({ taskId, ...props }: DeleteTaskDialogProps) => {
	const { onOpenChange } = props

	const onDelete = useCallback(() => {
		vscode.postMessage({ type: "deleteTaskWithId", text: taskId })
		onOpenChange?.(false)
	}, [taskId, onOpenChange])

	return (
		<AlertDialog {...props}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete Task</AlertDialogTitle>
					<AlertDialogDescription>
						Are you sure you want to delete this task? This action cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel asChild>
						<Button variant="secondary">Cancel</Button>
					</AlertDialogCancel>
					<AlertDialogAction asChild>
						<Button variant="destructive" onClick={onDelete}>
							Delete
						</Button>
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
