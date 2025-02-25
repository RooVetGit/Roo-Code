import { createContext, useCallback, useState, ReactNode } from "react"
import { useEvent, useMount } from "react-use"
import { z } from "zod"

import { ExtensionMessage } from "../../../../src/shared/ExtensionMessage"

import { vscode } from "@/utils/vscode"

import { ResearchHistoryTask, researchHistoryTaskSchema, researchTaskSchema } from "./types"
import { useResearchSession } from "./useResearchSession"

type HistoryContextType = {
	tasks: ResearchHistoryTask[]
	selectTask: (taskId: string) => void
	deleteTask: (taskId: string) => void
}

export const HistoryContext = createContext<HistoryContextType | undefined>(undefined)

export function HistoryProvider({ children }: { children: ReactNode }) {
	const [tasks, setTasks] = useState<ResearchHistoryTask[]>([])
	const { setTask } = useResearchSession()

	const selectTask = useCallback(
		(taskId: string) => vscode.postMessage({ type: "research.getTask", text: taskId }),
		[],
	)

	const deleteTask = useCallback(
		(taskId: string) => vscode.postMessage({ type: "research.deleteTask", text: taskId }),
		[],
	)

	const onMessage = useCallback(
		({ data: { type, text } }: MessageEvent<ExtensionMessage>) => {
			switch (type) {
				case "research.history": {
					try {
						const result = z.array(researchHistoryTaskSchema).safeParse(JSON.parse(text ?? "{}"))

						if (result.success) {
							setTasks(result.data)
						} else {
							console.warn(`[HistoryProvider#onMessage] invalid ${type}: ${text}: ${result.error}`)
						}
					} catch (e) {
						console.error(`[HistoryProvider#onMessage] unexpected error`, e)
					}

					break
				}
				case "research.task": {
					try {
						const result = researchTaskSchema.safeParse(JSON.parse(text ?? "{}"))

						if (result.success) {
							setTask(result.data)
						} else {
							console.warn(`[HistoryProvider#onMessage] invalid ${type}: ${text}: ${result.error}`)
						}
					} catch (e) {
						console.error(`[HistoryProvider#onMessage] unexpected error`, e)
					}

					break
				}
			}
		},
		[setTask],
	)

	useEvent("message", onMessage)

	useMount(() => vscode.postMessage({ type: "research.getTasks" }))

	const value = { tasks, selectTask, deleteTask }

	return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>
}
