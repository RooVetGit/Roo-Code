import { useCallback } from "react"
import { useEvent } from "react-use"

import { cn } from "@/lib/utils"

import { ExtensionMessage } from "../../../../src/shared/ExtensionMessage"
import { useChat } from "./hooks"
import { Chat } from "./Chat"

type ResearchViewProps = {
	isHidden: boolean
	onDone: () => void
}

export const ResearchView = ({ isHidden, onDone }: ResearchViewProps) => {
	const chat = useChat()
	const { setIsLoading, append } = chat

	const onMessage = useCallback(
		({ data: { type, text } }: MessageEvent<ExtensionMessage>) => {
			console.log(`[ResearchView#onMessage] type=${type}, text=${text}`)

			switch (type) {
				case "research.loading":
					setIsLoading(text === "true")
					break
				case "research.question":
					append({ role: "assistant", content: text ?? "" })
					break
				case "research.progress":
				case "research.result":
				case "research.error":
					break
			}
		},
		[setIsLoading, append],
	)

	useEvent("message", onMessage)

	return (
		<div className={cn("fixed inset-0 flex flex-col overflow-hidden", { hidden: isHidden })}>
			<Chat handler={chat} />
		</div>
	)
}
