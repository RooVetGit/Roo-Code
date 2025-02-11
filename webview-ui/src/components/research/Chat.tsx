import { useState } from "react"

import { cn } from "@/lib/utils"

import { type ChatHandler } from "./types"
import { ChatProvider } from "./providers/ChatProvider"
import ChatInput from "./ChatInput"
import ChatMessages from "./ChatMessages"

type ChatProps = {
	handler: ChatHandler
}

export const Chat = ({ handler }: ChatProps) => {
	const [requestData, setRequestData] = useState<any>()

	return (
		<ChatProvider value={{ ...handler, requestData, setRequestData }}>
			<div className={cn("flex flex-col h-[100vh]")}>
				<div className="flex-1 overflow-auto">
					<ChatMessages />
				</div>
				<div className="sticky bottom-0 border-t">
					<ChatInput />
				</div>
			</div>
		</ChatProvider>
	)
}
