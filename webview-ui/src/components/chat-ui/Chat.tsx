import { useState } from "react"

import { cn } from "@/lib/utils"

import { type ChatHandler } from "./types"
import { ChatProvider } from "./ChatProvider"
import { ChatMessagesProvider } from "./ChatMessagesProvider"
import { useChatUI } from "./useChatUI"
import { ChatMessages, ChatActions } from "./ChatMessages"
import { ChatInput } from "./ChatInput"

type ChatProps = {
	handler: ChatHandler
}

export const Chat = ({ handler }: ChatProps) => {
	const [requestData, setRequestData] = useState<any>()

	return (
		<ChatProvider value={{ ...handler, requestData, setRequestData }}>
			<ChatComponent />
		</ChatProvider>
	)
}

const ChatComponent = () => {
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
			<div className={cn("relative flex flex-col flex-1 min-h-0 pt-2 pr-[1px]")}>
				<ChatMessages />
				<ChatActions />
				<ChatInput />
			</div>
		</ChatMessagesProvider>
	)
}
