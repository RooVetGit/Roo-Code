import { useState, useCallback } from "react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"

import { useEventSource } from "@/hooks/use-event-source"

import { Run } from "@benchmark/db"

import { getTasks } from "./actions"
import { ipcServerMessageSchema } from "./schemas"

export const useRunStatus = (run: Run) => {
	const [clientId, setClientId] = useState<string>()
	const [runningTaskId, setRunningTaskId] = useState<number>()

	const { data: tasks } = useQuery({
		queryKey: ["run", run.id, runningTaskId],
		queryFn: async () => getTasks(run.id),
		placeholderData: keepPreviousData,
	})

	const url = `/api/runs/${run.id}/stream`

	const onMessage = useCallback((messageEvent: MessageEvent) => {
		let data

		try {
			data = JSON.parse(messageEvent.data)
		} catch (_) {
			console.log(`invalid JSON: ${messageEvent.data}`)
			return
		}

		const result = ipcServerMessageSchema.safeParse(data)

		if (!result.success) {
			console.log(`unrecognized messageEvent.data: ${messageEvent.data}`)
			return
		}

		const payload = result.data

		if (payload.type === "Ack") {
			setClientId(payload.data.clientId as string)
		} else if (payload.type === "TaskEvent") {
			const {
				eventName,
				data: { task },
			} = payload.data

			if (eventName === "connect" || eventName === "taskStarted") {
				setRunningTaskId(task.id)
			} else if (eventName === "taskFinished") {
				setRunningTaskId(undefined)
			}
		}
	}, [])

	const status = useEventSource({ url, onMessage })

	return { tasks, status, clientId, runningTaskId }
}
