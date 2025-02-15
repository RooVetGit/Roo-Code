import { Fragment, useMemo } from "react"
import { CopyIcon, CheckIcon } from "@radix-ui/react-icons"
import { BrainCircuit, CircleUserRound } from "lucide-react"

import { cn } from "@/lib/utils"
import { useClipboard } from "@/hooks/useClipboard"
import { Badge } from "@/components/ui"

import { BadgeData, ChatHandler, Message, MessageAnnotationType } from "./types"
import { ChatMessageProvider } from "./ChatMessageProvider"
import { useChatMessage } from "./useChatMessage"
import {
	EventAnnotations,
	AgentEventAnnotations,
	ImageAnnotations,
	MarkdownAnnotations,
	DocumentFileAnnotations,
	SourceAnnotations,
	SuggestedQuestionsAnnotations,
} from "./ChatAnnotations"

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

export enum ContentPosition {
	TOP = -9999,
	CHAT_EVENTS = 0,
	AFTER_EVENTS = 1,
	CHAT_AGENT_EVENTS = 2,
	AFTER_AGENT_EVENTS = 3,
	CHAT_IMAGE = 4,
	AFTER_IMAGE = 5,
	BEFORE_MARKDOWN = 6,
	MARKDOWN = 7,
	AFTER_MARKDOWN = 8,
	CHAT_DOCUMENT_FILES = 9,
	AFTER_DOCUMENT_FILES = 10,
	CHAT_SOURCES = 11,
	AFTER_SOURCES = 12,
	SUGGESTED_QUESTIONS = 13,
	AFTER_SUGGESTED_QUESTIONS = 14,
	BOTTOM = 9999,
}

type ContentDisplayConfig = {
	position: ContentPosition
	component: React.ReactNode | null
}

interface ChatMessageContentProps {
	isHeaderVisible: boolean
	isLoading?: boolean
	content?: ContentDisplayConfig[]
	append?: ChatHandler["append"]
}

function ChatMessageContent({ isHeaderVisible, isLoading, content, append }: ChatMessageContentProps) {
	const { message, isLast } = useChatMessage()

	const contents = useMemo<ContentDisplayConfig[]>(() => {
		const displayMap: {
			[key in ContentPosition]?: React.ReactNode | null
		} = {
			[ContentPosition.CHAT_EVENTS]: (
				<EventAnnotations message={message} showLoading={(isLast && isLoading) ?? false} />
			),
			[ContentPosition.CHAT_AGENT_EVENTS]: <AgentEventAnnotations message={message} />,
			[ContentPosition.CHAT_IMAGE]: <ImageAnnotations message={message} />,
			[ContentPosition.MARKDOWN]: <MarkdownAnnotations message={message} />,
			[ContentPosition.CHAT_DOCUMENT_FILES]: <DocumentFileAnnotations message={message} />,
			[ContentPosition.CHAT_SOURCES]: <SourceAnnotations message={message} />,
			...(isLast &&
				append && {
					[ContentPosition.SUGGESTED_QUESTIONS]: (
						<SuggestedQuestionsAnnotations message={message} append={append} />
					),
				}),
		}

		// Override the default display map with the custom content.
		content?.forEach((content) => {
			displayMap[content.position] = content.component
		})

		return Object.entries(displayMap).map(([position, component]) => ({
			position: parseInt(position),
			component,
		}))
	}, [isLast, isLoading, content, append, message])

	return (
		<div
			className={cn("flex flex-col gap-4 flex-1 min-w-0 px-4 pb-6", {
				"pt-4": isHeaderVisible,
			})}>
			{contents
				.sort((a, b) => a.position - b.position)
				.map(({ component }, index) => (
					<Fragment key={index}>{component}</Fragment>
				))}
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
