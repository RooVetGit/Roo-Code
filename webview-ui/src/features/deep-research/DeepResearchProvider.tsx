import { createContext, useCallback, useState, ReactNode } from "react"
import { useEvent } from "react-use"

import { ExtensionMessage } from "../../../../src/shared/ExtensionMessage"

import { vscode } from "@/utils/vscode"
import { ChatHandler, MessageRole, MessageAnnotationType, Message, messageSchema } from "@/components/ui/chat"

import {
	ResearchSession,
	loadingSchema,
	ResearchStatus,
	researchStatusSchema,
	ResearchProgress,
	researchProgressSchema,
	ResearchTokenUsage,
	researchTokenUsageSchema,
} from "./types"

type DeepResearchContextType = ChatHandler & {
	status: ResearchStatus["status"] | undefined
	progress: ResearchProgress | undefined
	tokenUsage: ResearchTokenUsage | undefined
	start: (session: ResearchSession) => void
	viewReport: () => void
	createTask: () => void
}

export const DeepResearchContext = createContext<DeepResearchContextType | undefined>(undefined)

export function DeepResearchProvider({ children }: { children: ReactNode }) {
	const [isLoading, setIsLoading] = useState(false)
	const [loadingMessage, setLoadingMessage] = useState<string | undefined>(undefined)
	const [input, setInput] = useState("")
	const [messages, setMessages] = useState<Message[]>([])
	const [progress, setProgress] = useState<ResearchProgress>()
	const [status, setStatus] = useState<ResearchStatus["status"]>()
	const [tokenUsage, setTokenUsage] = useState<ResearchTokenUsage>()

	const stop = useCallback(() => {
		vscode.postMessage({ type: "research.abort" })
	}, [])

	const append = useCallback(async (message: Message, options?: { data?: any }) => {
		if (message.role === "user") {
			vscode.postMessage({ type: "research.input", payload: { message, chatRequestOptions: options } })
		}

		setMessages((prev) => [...prev, message])
		return Promise.resolve(null)
	}, [])

	const reset = useCallback(() => {
		setIsLoading(false)
		setInput("")
		setMessages([])
		vscode.postMessage({ type: "research.reset" })
	}, [])

	const start = useCallback((session: ResearchSession) => {
		vscode.postMessage({ type: "research.task", payload: { session } })
		const message: Message = { role: MessageRole.User, content: session.query }
		setMessages((prev) => [...prev, message])
	}, [])

	const viewReport = useCallback(() => {
		vscode.postMessage({ type: "research.viewReport" })
	}, [])

	const createTask = useCallback(() => {
		vscode.postMessage({ type: "research.createTask" })
	}, [])

	const onMessage = useCallback(
		({ data: { type, text } }: MessageEvent<ExtensionMessage>) => {
			console.log(`[DeepResearch#onMessage] ${type} -> ${text}`)

			switch (type) {
				case "research.loading":
					const result = loadingSchema.safeParse(JSON.parse(text ?? "{}"))

					if (result.success) {
						const { isLoading, message } = result.data
						setIsLoading(isLoading)
						setLoadingMessage(message ?? "")
					} else {
						console.warn(`[DeepResearch#onMessage] Invalid ${type}: ${text}: ${result.error}`)
					}

					break
				case "research.output": {
					const result = messageSchema.safeParse(JSON.parse(text ?? "{}"))

					if (result.success) {
						append(result.data)
					} else {
						console.warn(`[DeepResearch#onMessage] Invalid ${type}: ${text}: ${result.error}`)
					}

					break
				}
				case "research.progress": {
					const result = researchProgressSchema.safeParse(JSON.parse(text ?? "{}"))

					if (result.success) {
						setProgress(result.data)
					} else {
						console.warn(`[DeepResearch#onMessage] Invalid ${type}: ${text}: ${result.error}`)
					}

					break
				}
				case "research.status": {
					const result = researchStatusSchema.safeParse(JSON.parse(text ?? "{}"))

					if (result.success) {
						const { status } = result.data
						setStatus(status)
					} else {
						console.warn(`[DeepResearch#onMessage] Invalid ${type}: ${text}: ${result.error}`)
					}

					break
				}
				case "research.tokenUsage": {
					const result = researchTokenUsageSchema.safeParse(JSON.parse(text ?? "{}"))

					if (result.success) {
						setTokenUsage(result.data)
					} else {
						console.warn(`[DeepResearch#onMessage] Invalid ${type}: ${text}: ${result.error}`)
					}

					break
				}
				case "research.error":
					if (text) {
						append({
							role: MessageRole.Assistant,
							content: text,
							annotations: [
								{
									type: MessageAnnotationType.Badge,
									data: {
										label: "Error",
										variant: "destructive",
									},
								},
							],
						})
					}

					break
			}
		},
		[setIsLoading, setLoadingMessage, append],
	)

	useEvent("message", onMessage)

	const value = {
		isLoading,
		setIsLoading,
		loadingMessage,
		setLoadingMessage,
		input,
		setInput,
		messages,
		stop,
		append,
		reset,
		progress,
		status,
		tokenUsage,
		start,
		viewReport,
		createTask,
	}

	return <DeepResearchContext.Provider value={value}>{children}</DeepResearchContext.Provider>
}
