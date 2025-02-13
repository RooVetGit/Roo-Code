import { Fragment, useMemo } from "react"
import { CopyIcon, CheckIcon } from "@radix-ui/react-icons"
import { BrainCircuit, CircleUserRound } from "lucide-react"

import { cn } from "@/lib/utils"
import { useClipboard } from "@/hooks/useClipboard"

import { ChatHandler, Message, MessageAnnotation } from "./types"
import { ChatMessageProvider } from "./ChatMessageProvider"
import { useChatMessage } from "./useChatMessage"
import { Markdown } from "./widgets/Markdown"
import { getSourceAnnotationData } from "./annotations/annotation"
import {
	AgentEventAnnotations,
	DocumentFileAnnotations,
	EventAnnotations,
	ImageAnnotations,
	SourceAnnotations,
	SuggestedQuestionsAnnotations,
} from "./ChatAnnotations"

/**
 * ChatMessage
 */

interface ChatMessageProps {
	isLoading?: boolean
	isLast: boolean
	message: Message
	append?: ChatHandler["append"]
}

export function ChatMessage({ isLoading, isLast, message, append }: ChatMessageProps) {
	return (
		<ChatMessageProvider value={{ message, isLast }}>
			<div
				className={cn("relative group flex", {
					"flex-row-reverse": message.role === "user",
					"bg-vscode-input-background/50": message.role === "user",
				})}>
				<ChatMessageAvatar />
				<ChatMessageContent isLoading={isLoading} append={append} />
				<ChatMessageActions />
			</div>
		</ChatMessageProvider>
	)
}

/**
 * ChatMessageAvatar
 */

function ChatMessageAvatar() {
	const { message } = useChatMessage()

	const roleIconMap: Record<string, React.ReactNode> = {
		user: <CircleUserRound className="h-4 w-4" />,
		assistant: <BrainCircuit className="h-4 w-4" />,
	}

	return roleIconMap[message.role] ? (
		<div className="shrink-0 opacity-25 select-none p-2">{roleIconMap[message.role]}</div>
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
	isLoading?: boolean
	content?: ContentDisplayConfig[]
	append?: ChatHandler["append"]
}

function ChatMessageContent({ isLoading, content, append }: ChatMessageContentProps) {
	const { message, isLast } = useChatMessage()
	const annotations = message.annotations as MessageAnnotation[] | undefined

	const contents = useMemo<ContentDisplayConfig[]>(() => {
		const displayMap: {
			[key in ContentPosition]?: React.ReactNode | null
		} = {
			[ContentPosition.CHAT_EVENTS]: (
				<EventAnnotations message={message} showLoading={(isLast && isLoading) ?? false} />
			),
			[ContentPosition.CHAT_AGENT_EVENTS]: <AgentEventAnnotations message={message} />,
			[ContentPosition.CHAT_IMAGE]: <ImageAnnotations message={message} />,
			[ContentPosition.MARKDOWN]: (
				<Markdown
					content={message.content}
					sources={annotations ? getSourceAnnotationData(annotations)[0] : undefined}
				/>
			),
			[ContentPosition.CHAT_DOCUMENT_FILES]: <DocumentFileAnnotations message={message} />,
			[ContentPosition.CHAT_SOURCES]: <SourceAnnotations message={message} />,
			...(isLast &&
				append && {
					// Show suggested questions only on the last message.
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
	}, [annotations, isLast, isLoading, content, append, message])

	return (
		<div
			className={cn("flex flex-col gap-4 flex-1 min-w-0 px-2 pt-4 pb-6", {
				"text-right": message.role === "user",
			})}>
			{contents
				.sort((a, b) => a.position - b.position)
				.map((content, index) => (
					<Fragment key={index}>{content.component}</Fragment>
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
