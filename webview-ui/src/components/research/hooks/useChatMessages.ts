import { useContext } from "react"

import { chatMessagesContext } from "../providers/ChatMessagesProvider"

export const useChatMessages = () => {
	const context = useContext(chatMessagesContext)

	if (!context) {
		throw new Error("useChatMessages must be used within a ChatMessagesProvider")
	}

	return context
}
