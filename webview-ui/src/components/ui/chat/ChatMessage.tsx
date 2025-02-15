import { useMemo } from "react"
import { CopyIcon, CheckIcon } from "@radix-ui/react-icons"
import { BrainCircuit, CircleUserRound } from "lucide-react"

import { cn } from "@/lib/utils"
import { useClipboard } from "@/hooks/useClipboard"
import { Badge } from "@/components/ui"

import { BadgeData, ChatHandler, Message, MessageAnnotationType } from "./types"
import { ChatMessageProvider } from "./ChatMessageProvider"
import { useChatMessage } from "./useChatMessage"
import { Markdown } from "./markdown"

/**
 * ChatMessage
 */

interface ChatMessageProps {
	message: Message
	isLast: boolean
	isHeaderVisible: boolean
	isLoading?: boolean
	append?: ChatHandler["append"]
}

export function ChatMessage({ message, isLast, isHeaderVisible, isLoading, append }: ChatMessageProps) {
	const badges = useMemo(
		() =>
			message.annotations
				?.filter(({ type }) => type === MessageAnnotationType.BADGE)
				.map(({ data }) => data as BadgeData),
		[message.annotations],
	)

	return (
		<ChatMessageProvider value={{ message, isLast }}>
			<div
				className={cn("relative group flex flex-col", {
					"bg-vscode-input-background/50": message.role === "user",
				})}>
				{isHeaderVisible && <ChatMessageHeader badges={badges} />}
				<ChatMessageContent isHeaderVisible={isHeaderVisible} isLoading={isLoading} append={append} />
				<ChatMessageActions />
			</div>
		</ChatMessageProvider>
	)
}

/**
 * ChatMessageHeader
 */

interface ChatMessageHeaderProps {
	badges?: BadgeData[]
}

function ChatMessageHeader({ badges }: ChatMessageHeaderProps) {
	return (
		<div className="flex flex-row items-center justify-between border-t border-accent px-3 pt-3 pb-1">
			<ChatMessageAvatar />
			{badges?.map(({ label, variant = "outline" }) => (
				<Badge variant={variant} key={label}>
					{label}
				</Badge>
			))}
		</div>
	)
}

/**
 * ChatMessageAvatar
 */
const icons: Record<string, React.ReactNode> = {
	user: <CircleUserRound className="h-4 w-4" />,
	assistant: <BrainCircuit className="h-4 w-4" />,
}

function ChatMessageAvatar() {
	const {
		message: { role },
	} = useChatMessage()

	return icons[role] ? (
		<div className="flex flex-row items-center gap-1">
			<div className="opacity-25 select-none">{icons[role]}</div>
			<div className="text-muted">{role === "user" ? "You" : "Deep Research (β)"}</div>
		</div>
	) : null
}

/**
 * ChatMessageContent
 */

interface ChatMessageContentProps {
	isHeaderVisible: boolean
}

function ChatMessageContent({ isHeaderVisible }: ChatMessageContentProps) {
	const {
		message: { content },
	} = useChatMessage()

	return (
		<div className={cn("flex flex-col gap-4 flex-1 min-w-0 px-4 pb-6", { "pt-4": isHeaderVisible })}>
			<Markdown content={content} />
		</div>
	)
}

/**
 * ChatMessageActions
 */

function ChatMessageActions() {
	const { message } = useChatMessage()
	const { isCopied, copy } = useClipboard()

	return (
		<div
			className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-25 cursor-pointer"
			onClick={() => copy(message.content)}>
			{isCopied ? <CheckIcon /> : <CopyIcon />}
		</div>
	)
}
