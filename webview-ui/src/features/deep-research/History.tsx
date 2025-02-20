import { useState, useMemo } from "react"
import { ChevronsUpDown, ChevronsDownUp } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button, Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui"

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
					<Task key={task.taskId} task={task} className="border-b border-accent p-4 last-of-type:border-0" />
				))}
				{hiddenTasks.length > 0 && (
					<>
						<CollapsibleContent>
							{hiddenTasks.map((task) => (
								<Task
									key={task.taskId}
									task={task}
									className="border-b border-accent p-4 last-of-type:border-0"
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
	const { selectTask } = useHistory()

	return (
		<div
			className={cn(
				"flex flex-col cursor-pointer text-secondary-foreground hover:bg-accent hover:text-accent-foreground active:opacity-90",
				className,
			)}
			onClick={() => selectTask(task.taskId)}
			{...props}>
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
	)
}
