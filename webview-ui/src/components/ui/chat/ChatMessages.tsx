import { useCallback, useEffect, useMemo, useRef } from "react"
import { Virtuoso, VirtuosoHandle } from "react-virtuoso"

import { useChatUI } from "./useChatUI"
import { ChatMessage, ChatMessageLoading } from "./ChatMessage"

export function ChatMessages() {
	const { messages, isLoading, loadingMessage } = useChatUI()
	const virtuoso = useRef<VirtuosoHandle>(null)

	const totalCount = useMemo(() => messages.length + (isLoading ? 1 : 0), [messages, isLoading])

	useEffect(() => {
		if (!virtuoso.current) {
			return
		}

		requestAnimationFrame(() =>
			virtuoso.current?.scrollToIndex({ index: totalCount - 1, align: "end", behavior: "smooth" }),
		)
	}, [totalCount])

	const itemContent = useCallback(
		(index: number) => {
			const isFirst = index === 0
			const isLast = index === totalCount - 1

			if (isLoading && isLast) {
				return <ChatMessageLoading key={index} message={loadingMessage} />
			}

			const message = messages[index]

			const isHeaderVisible =
				!!message.annotations?.length || isFirst || messages[index - 1].role !== message.role

			return <ChatMessage key={index} message={message} isHeaderVisible={isHeaderVisible} isLast={isLast} />
		},
		[messages, isLoading, loadingMessage, totalCount],
	)

	return <Virtuoso ref={virtuoso} totalCount={totalCount} itemContent={itemContent} />
}
