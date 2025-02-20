import { createContext } from "react"

import type { Message } from "./types"

interface ChatMessagesContext {
	showReload?: boolean
	showStop?: boolean
	messageCount: number
	lastMessage: Message
}

export const chatMessagesContext = createContext<ChatMessagesContext | null>(null)

export const ChatMessagesProvider = chatMessagesContext.Provider
