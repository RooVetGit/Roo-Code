import { Loader2, PauseCircle, RefreshCw } from "lucide-react"
import { useEffect, useRef } from "react"

import { Button } from "@/components/ui"

import { useChatUI, useChatMessages } from "./hooks"
import { ChatMessage } from "./ChatMessage"

/**
 * ChatMessages
 */

export function ChatMessages() {
	const { messages, isLoading, append } = useChatUI()
	const { lastMessage, messageLength } = useChatMessages()

	const scrollableChatContainerRef = useRef<HTMLDivElement>(null)

	const scrollToBottom = () => {
		if (scrollableChatContainerRef.current) {
			scrollableChatContainerRef.current.scrollTop = scrollableChatContainerRef.current.scrollHeight
		}
	}

	useEffect(() => {
		scrollToBottom()
	}, [messageLength, lastMessage])

	return (
		<div className="flex flex-col flex-1 min-h-0 overflow-auto" ref={scrollableChatContainerRef}>
			{messages.map((message, index) => (
				<ChatMessage
					key={index}
					message={message}
					isLast={index === messageLength - 1}
					isLoading={isLoading}
					append={append}
				/>
			))}
			<ChatMessagesLoading />
		</div>
	)
}

/**
 * ChatMessagesLoading
 */

function ChatMessagesLoading() {
	const { isPending } = useChatMessages()

	return isPending ? (
		<div className="flex items-center justify-center pt-4">
			<Loader2 className="h-4 w-4 animate-spin" />
		</div>
	) : null
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
					<PauseCircle />
				</Button>
			)}
			{showReload && (
				<Button variant="ghost" size="sm" onClick={() => reload?.({ data: requestData })}>
					<RefreshCw />
				</Button>
			)}
		</div>
	)
}
