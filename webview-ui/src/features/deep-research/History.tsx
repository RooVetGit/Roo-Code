import { useState, useMemo } from "react"
import { ChevronsUpDown, ChevronsDownUp } from "lucide-react"
import { TrashIcon } from "@radix-ui/react-icons"

import { cn } from "@/lib/utils"
import {
	Button,
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui"

import { ResearchHistoryTask } from "./types"
import { useHistory } from "./useHistory"

export const History = () => {
	const [isOpen, setIsOpen] = useState(false)
	const { tasks } = useHistory()
	const [visibleTasks, hiddenTasks] = useMemo(() => [tasks.slice(0, 5), tasks.slice(5)], [tasks])

	if (tasks.length === 0) {
		return null
	}

	return (
		<div className="flex flex-col border border-accent rounded-xs">
			<div className="font-bold text-lg bg-vscode-editor-background p-4 flex flex-row items-center gap-2">
				Research History
			</div>
			<Collapsible open={isOpen} onOpenChange={setIsOpen}>
				{visibleTasks.map((task) => (
					<Task key={task.taskId} task={task} className="border-b border-accent last-of-type:border-0" />
				))}
				{hiddenTasks.length > 0 && (
					<>
						<CollapsibleContent>
							{hiddenTasks.map((task) => (
								<Task
									key={task.taskId}
									task={task}
									className="border-b border-accent last-of-type:border-0"
								/>
							))}
						</CollapsibleContent>
						<CollapsibleTrigger asChild>
							<Button variant="ghost" size="icon" className="w-full rounded-t-none">
								{isOpen ? <ChevronsDownUp /> : <ChevronsUpDown />}
							</Button>
						</CollapsibleTrigger>
					</>
				)}
			</Collapsible>
		</div>
	)
}

type TaskProps = Omit<React.HTMLAttributes<HTMLDivElement>, "onClick" | "children"> & {
	task: ResearchHistoryTask
}

const Task = ({ task, className, ...props }: TaskProps) => {
	const { selectTask, deleteTask } = useHistory()

	return (
		<div className={cn("relative group", className)} {...props}>
			<div
				className="flex flex-col text-secondary-foreground hover:bg-accent hover:text-accent-foreground active:opacity-90 cursor-pointer p-4"
				onClick={() => selectTask(task.taskId)}>
				<div className="text-muted-foreground text-sm">
					{task.createdAt.toLocaleString("en-US", {
						month: "long",
						day: "numeric",
						hour: "numeric",
						minute: "numeric",
					})}
				</div>
				<div className="whitespace-nowrap text-ellipsis overflow-hidden">{task.query}</div>
			</div>
			<AlertDialog>
				<AlertDialogTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
						<TrashIcon />
					</Button>
				</AlertDialogTrigger>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you sure?</AlertDialogTitle>
						<AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={() => deleteTask(task.taskId)}>Continue</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}
