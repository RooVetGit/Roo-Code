import { useState } from "react"

import { vscode } from "@/utils/vscode"

import { ChatHandler, Message } from "@/components/chat-ui"
import { Session } from "./types"

export const useDeepResearch = (): ChatHandler => {
	const [isLoading, setIsLoading] = useState(false)
	const [input, setInput] = useState("")
	const [messages, setMessages] = useState<Message[]>([])

	const reload = () => {
		vscode.postMessage({ type: "research.reload" })
	}

	const start = (options?: { data?: Session }) => {
		if (options?.data) {
			const session = options.data
			vscode.postMessage({ type: "research.task", payload: { session } })
			const message: Message = { role: "user", content: session.query }
			setMessages((prev) => [...prev, message])
		}
	}

	const stop = () => {
		vscode.postMessage({ type: "research.stop" })
	}

	const append = async (message: Message, options?: { data?: any }) => {
		if (message.role === "user") {
			vscode.postMessage({ type: "research.input", payload: { message, chatRequestOptions: options } })
		}

		setMessages((prev) => [...prev, message])
		return Promise.resolve(null)
	}

	const reset = () => {
		setIsLoading(false)
		setInput("")
		setMessages([])
		vscode.postMessage({ type: "research.reset" })
	}

	return { isLoading, setIsLoading, input, setInput, messages, reload, start, stop, append, reset }
}
