import { createContext } from "react"

import { type ChatHandler } from "../types"

export type ChatContext = ChatHandler & {
	requestData: any
	setRequestData: (data: any) => void
}

export const chatContext = createContext<ChatContext | null>(null)

export const ChatProvider = chatContext.Provider
