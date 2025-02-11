import { Loader2, PauseCircle, RefreshCw } from "lucide-react"
import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui"

import { ChatMessagesProvider } from "./providers/ChatMessagesProvider"
import { useChatUI, useChatMessages } from "./hooks"
import ChatMessage from "./ChatMessage"

/**
 * ChatMessages
 */

function ChatMessages() {
	const { messages, reload, stop, isLoading } = useChatUI()

	const messageLength = messages.length
	const lastMessage = messages[messageLength - 1]
	const isLastMessageFromAssistant = messageLength > 0 && lastMessage?.role !== "user"
	const showReload = reload && !isLoading && isLastMessageFromAssistant
	const showStop = stop && isLoading

	// The `isPending` flag indicates that stream response is not yet received
	// from the server, so we show a loading indicator to give a better UX.
	const isPending = isLoading && !isLastMessageFromAssistant

	return (
		<ChatMessagesProvider value={{ isPending, showReload, showStop, lastMessage, messageLength }}>
			<div className={cn("relative flex min-h-0 flex-1 flex-col space-y-6 p-4")}>
				<ChatMessagesList />
				<ChatActions />
			</div>
		</ChatMessagesProvider>
	)
}

/**
 * ChatMessagesList
 */

function ChatMessagesList() {
	const scrollableChatContainerRef = useRef<HTMLDivElement>(null)
	const { messages, isLoading, append } = useChatUI()
	const { lastMessage, messageLength } = useChatMessages()

	const scrollToBottom = () => {
		if (scrollableChatContainerRef.current) {
			scrollableChatContainerRef.current.scrollTop = scrollableChatContainerRef.current.scrollHeight
		}
	}

	useEffect(() => {
		scrollToBottom()
	}, [messageLength, lastMessage])

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto" ref={scrollableChatContainerRef}>
			{messages.map((message, index) => {
				return (
					<ChatMessage
						key={index}
						message={message}
						isLast={index === messageLength - 1}
						isLoading={isLoading}
						append={append}
					/>
				)
			})}
			<ChatMessagesLoading />
		</div>
	)
}

/**
 * ChatMessagesLoading
 */

function ChatMessagesLoading() {
	const { isPending } = useChatMessages()

	if (!isPending) {
		return null
	}

	return (
		<div className="flex items-center justify-center pt-4">
			<Loader2 className="h-4 w-4 animate-spin" />
		</div>
	)
}

/**
 * ChatActions
 */

function ChatActions() {
	const { reload, stop, requestData } = useChatUI()
	const { showReload, showStop } = useChatMessages()

	if (!showStop && !showReload) {
		return null
	}

	return (
		<div className="flex justify-end gap-4">
			{showStop && (
				<Button variant="outline" size="sm" onClick={stop}>
					<PauseCircle className="mr-2 h-4 w-4" />
					Stop generating
				</Button>
			)}
			{showReload && (
				<Button variant="outline" size="sm" onClick={() => reload?.({ data: requestData })}>
					<RefreshCw className="mr-2 h-4 w-4" />
					Regenerate
				</Button>
			)}
		</div>
	)
}

ChatMessages.List = ChatMessagesList
ChatMessages.Loading = ChatMessagesLoading
ChatMessages.Actions = ChatActions

export default ChatMessages
