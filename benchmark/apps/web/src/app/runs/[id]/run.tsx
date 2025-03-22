"use client"

import { LoaderCircle } from "lucide-react"

import * as db from "@benchmark/db"

import { useRunStatus } from "./use-run-status"
import { TaskStatus } from "./task-status"
import { ConnectionStatus } from "./connection-status"

export function Run({ run }: { run: db.Run }) {
	const { tasks, status, clientId, runningTaskId } = useRunStatus(run)

	return (
		<>
			<div className="flex flex-col gap-2">
				<div className="border-b mb-2 pb-2">
					<div>Run #{run.id}</div>
					<div>{run.model}</div>
					{run.description && <div className="text-sm text-muted-foreground">{run.description}</div>}
				</div>
				{!tasks ? (
					<LoaderCircle className="size-4 animate-spin" />
				) : (
					tasks.map((task) => (
						<div key={task.id} className="flex items-center gap-2">
							<TaskStatus task={task} runningTaskId={runningTaskId} />
							<div>
								{task.language}/{task.exercise}
							</div>
						</div>
					))
				)}
			</div>
			<div className="absolute top-5 right-5">
				<ConnectionStatus status={status} clientId={clientId} pid={run.pid} />
			</div>
		</>
	)
}
