import { useRef, useState } from "react"

import { vscode } from "@/utils/vscode"

import { ChatHandler, Message } from "@/components/chat-ui"

export const useDeepResearch = (): ChatHandler => {
	const [isLoading, setIsLoading] = useState(false)
	const [input, setInput] = useState("")
	const [messages, setMessages] = useState<Message[]>([])

	const initialized = useRef(false)
	const isInitialized = initialized.current

	const reload = () => {
		console.log("reload")
		vscode.postMessage({ type: "research.reload" })
	}

	const stop = () => {
		console.log("stop")
		vscode.postMessage({ type: "research.stop" })
	}

	const append = async (message: Message, chatRequestOptions?: { data?: any }) => {
		const payload = { message, chatRequestOptions }

		if (message.role === "user") {
			if (!initialized.current) {
				initialized.current = true
			}

			vscode.postMessage({ type: "research.input", payload })
		}

		setMessages((prev) => [...prev, message])
		return Promise.resolve(null)
	}

	return { isInitialized, isLoading, setIsLoading, input, setInput, messages, reload, stop, append }
}
