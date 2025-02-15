import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react"

import { Chat, ChatHandler, Message } from "@/components/ui/chat"

const meta = {
	title: "ui/Chat",
	component: Chat,
	parameters: { layout: "centered" },
	tags: ["autodocs"],
} satisfies Meta<typeof Chat>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
	name: "Chat",
	args: {
		handler: {} as ChatHandler,
	},
	render: function StorybookChat() {
		const handler = useStorybookChat()
		return <Chat handler={handler} className="border w-[460px] h-[640px]" />
	},
}

const useStorybookChat = (): ChatHandler => {
	const [isLoading, setIsLoading] = useState(false)
	const [input, setInput] = useState("")
	const [messages, setMessages] = useState<Message[]>([])

	const append = async (message: Message, options?: { data?: any }) => {
		const echo: Message = { ...message, role: "assistant", content: `Echo: ${message.content}` }
		setMessages((prev) => [...prev, message, echo])
		return Promise.resolve(null)
	}

	return { isLoading, setIsLoading, input, setInput, messages, append }
}
