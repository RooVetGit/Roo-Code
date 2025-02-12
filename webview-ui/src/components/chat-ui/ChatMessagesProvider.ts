import { createContext } from "react"

import type { Message } from "./types"

interface ChatMessagesContext {
	isPending: boolean
	showReload?: boolean
	showStop?: boolean
	messageLength: number
	lastMessage: Message
}

export const chatMessagesContext = createContext<ChatMessagesContext | null>(null)

export const ChatMessagesProvider = chatMessagesContext.Provider
