import { useState, useEffect } from "react"
import { Cross2Icon } from "@radix-ui/react-icons"

import { Button } from "@/components/ui"
import { Chat, ChatHandler, Message } from "@/components/ui/chat"

import { ResearchTask as Task } from "./types"
import { useResearchSession } from "./useResearchSession"

const useChatHandler = (task?: Task): ChatHandler => {
	const [input, setInput] = useState("")
	const [messages, setMessages] = useState<Message[]>([])

	useEffect(() => {
		if (task) {
			setMessages(task.output)
		}
	}, [task])

	const append = async (message: Message, options?: { data?: any }) => Promise.resolve(null)

	return { isDisabled: true, isLoading: false, input, setInput, messages, append }
}

export const ResearchTask = () => {
	const { task } = useResearchSession()
	const handler = useChatHandler(task)

	if (!task) {
		return null
	}

	return (
		<>
			<Chat assistantName="Deep Research (β)" handler={handler} className="pt-10 pr-[1px]" />
			<Header />
		</>
	)
}

function Header() {
	const { task, setTask } = useResearchSession()

	return (
		<div className="absolute top-0 left-0 h-10 flex flex-row items-center justify-between gap-2 w-full pl-3 pr-1">
			<div className="flex-1 truncate text-sm text-muted-foreground">{task?.inquiry.initialQuery}</div>
			<Button variant="ghost" size="icon" onClick={() => setTask(undefined)}>
				<Cross2Icon />
			</Button>
		</div>
	)
}
