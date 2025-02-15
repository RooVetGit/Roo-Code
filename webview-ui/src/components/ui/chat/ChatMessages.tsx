import { useEffect, useRef } from "react"
import { StopIcon, ReloadIcon } from "@radix-ui/react-icons"
import debounce from "debounce"

import { Button } from "@/components/ui"

import { useChatUI } from "./useChatUI"
import { useChatMessages } from "./useChatMessages"
import { ChatMessage } from "./ChatMessage"

/**
 * ChatMessages
 */

export function ChatMessages() {
	const { messages, isLoading, append } = useChatUI()
	const { lastMessage, messageCount } = useChatMessages()

	const scrollableChatContainerRef = useRef<HTMLDivElement>(null)

	const scrollToBottom = useRef(
		debounce(() => {
			if (scrollableChatContainerRef.current) {
				requestAnimationFrame(() => {
					scrollableChatContainerRef.current?.scrollTo({
						top: scrollableChatContainerRef.current.scrollHeight,
						behavior: "smooth",
					})
				})
			}
		}, 100),
	).current

	useEffect(() => {
		scrollToBottom()
	}, [messageCount, lastMessage, scrollToBottom])

	return (
		<div className="flex flex-col flex-1 min-h-0 overflow-auto relative" ref={scrollableChatContainerRef}>
			{messages.map((message, index) => (
				<ChatMessage
					key={index}
					message={message}
					isHeaderVisible={
						!!message.annotations?.length || index === 0 || messages[index - 1].role !== message.role
					}
					isLast={index === messageCount - 1}
					isLoading={isLoading}
					append={append}
				/>
			))}
		</div>
	)
}

/**
 * ChatActions
 */

export function ChatActions() {
	const { reload, stop, requestData } = useChatUI()
	const { showReload, showStop } = useChatMessages()

	return (
		<div className="flex flex-row justify-center pt-2 border-t border-vscode-editor-background">
			{showStop && (
				<Button variant="ghost" size="sm" onClick={stop}>
					<StopIcon className="text-destructive" />
				</Button>
			)}
			{showReload && (
				<Button variant="ghost" size="sm" onClick={() => reload?.({ data: requestData })}>
					<ReloadIcon />
				</Button>
			)}
		</div>
	)
}
