import { useCallback } from "react"
import { useEvent } from "react-use"

import { ExtensionMessage } from "../../../../src/shared/ExtensionMessage"

import { Chat } from "@/components/chat-ui"
import { useDeepResearch } from "./useDeepResearch"

export const Session = () => {
	const handler = useDeepResearch()
	const { setIsLoading, append } = handler

	const onMessage = useCallback(
		({ data: { type, text } }: MessageEvent<ExtensionMessage>) => {
			switch (type) {
				case "research.loading":
					console.log(`[DeepResearch#onMessage] type=${type}, text=${text}`)
					setIsLoading(text === "true")
					break
				case "research.question":
					console.log(`[DeepResearch#onMessage] type=${type}, text=${text}`)
					append({ role: "assistant", content: text ?? "" })
					break
				case "research.progress":
				case "research.result":
				case "research.error":
					console.log(`[DeepResearch#onMessage] type=${type}, text=${text}`)
					break
			}
		},
		[setIsLoading, append],
	)

	useEvent("message", onMessage)

	return <Chat handler={handler} />
}
