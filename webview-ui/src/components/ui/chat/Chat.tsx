import { HTMLAttributes, useState } from "react"

import { cn } from "@/lib/utils"

import { type ChatHandler } from "./types"
import { ChatProvider } from "./ChatProvider"
import { ChatMessagesProvider } from "./ChatMessagesProvider"
import { useChatUI } from "./useChatUI"
import { ChatMessages } from "./ChatMessages"
import { ChatInput } from "./ChatInput"

type ChatProps = HTMLAttributes<HTMLDivElement> & {
	handler: ChatHandler
}

export const Chat = ({ handler, ...props }: ChatProps) => {
	const [requestData, setRequestData] = useState<any>()

	return (
		<ChatProvider value={{ ...handler, requestData, setRequestData }}>
			<ChatComponent {...props} />
		</ChatProvider>
	)
}

const ChatComponent = ({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) => {
	const { messages, reload, stop, isLoading } = useChatUI()

	const messageCount = messages.length
	const lastMessage = messages[messageCount - 1]
	const isLastMessageFromAssistant = messageCount > 0 && lastMessage?.role !== "user"
	const showReload = reload && !isLoading && isLastMessageFromAssistant
	const showStop = stop && isLoading

	return (
		<ChatMessagesProvider value={{ showReload, showStop, lastMessage, messageCount }}>
			<div className={cn("relative flex flex-col flex-1 min-h-0", className)} {...props}>
				<ChatMessages />
				{children}
				<ChatInput />
			</div>
		</ChatMessagesProvider>
	)
}
