import { useCallback, useRef } from "react"
import { useEvent, useMount } from "react-use"
import { Cross2Icon } from "@radix-ui/react-icons"

import { ExtensionMessage } from "../../../../src/shared/ExtensionMessage"

import { Button } from "@/components/ui"
import { Chat } from "@/components/chat-ui"

import { useDeepResearch } from "./useDeepResearch"
import { useSession } from "./useSession"

export const Session = () => {
	const { session, setSession } = useSession()
	const handler = useDeepResearch()
	const { setIsLoading, start, append, reset } = handler
	const initialized = useRef(false)

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

	useMount(() => {
		if (session && !initialized.current) {
			start?.({ data: session })
			initialized.current = true
		}
	})

	if (!session) {
		return null
	}

	return (
		<>
			<Chat handler={handler} className="pt-10 pr-[1px]" />
			<div className="absolute top-0 left-0 h-10 flex flex-row items-center justify-between gap-2 w-full pl-3 pr-1">
				<div className="flex-1 truncate text-sm text-muted-foreground">{session.query}</div>
				<Button
					variant="ghost"
					size="icon"
					onClick={() => {
						setSession(undefined)
						reset?.()
					}}>
					<Cross2Icon />
				</Button>
			</div>
		</>
	)
}
