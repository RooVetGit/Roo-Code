import { Bot, Check, Copy, MessageCircle, User2 } from "lucide-react"
import { Fragment, memo, useMemo } from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui"

import { ChatHandler, Message } from "./types"
import { ChatMessageProvider } from "./providers/ChatMessageProvider"
import { useChatMessage } from "./hooks/useChatMessage"
import { useCopyToClipboard } from "./hooks/useCopyToClipboard"
import { Markdown } from "./widgets/Markdown"
import { getSourceAnnotationData, MessageAnnotation } from "./annotation"
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

interface ChatMessageProps extends React.PropsWithChildren {
	message: Message
	isLast: boolean
	className?: string
	isLoading?: boolean
	append?: ChatHandler["append"]
}

function ChatMessage(props: ChatMessageProps) {
	const children = props.children ?? (
		<>
			<ChatMessageAvatar />
			<ChatMessageContent isLoading={props.isLoading} append={props.append} />
			<ChatMessageActions />
		</>
	)

	return (
		<ChatMessageProvider value={{ message: props.message, isLast: props.isLast }}>
			<div className={cn("group flex gap-4 p-3", props.className)}>{children}</div>
		</ChatMessageProvider>
	)
}

/**
 * ChatMessageAvatar
 */

interface ChatMessageAvatarProps extends React.PropsWithChildren {
	className?: string
}

function ChatMessageAvatar(props: ChatMessageAvatarProps) {
	const { message } = useChatMessage()

	const roleIconMap: Record<string, React.ReactNode> = {
		user: <User2 className="h-4 w-4" />,
		assistant: <Bot className="h-4 w-4" />,
	}

	const children = props.children ?? roleIconMap[message.role] ?? <MessageCircle className="h-4 w-4" />

	return (
		<div className="bg-background flex h-8 w-8 shrink-0 select-none items-center justify-center border">
			{children}
		</div>
	)
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

interface ChatMessageContentProps extends React.PropsWithChildren {
	className?: string
	content?: ContentDisplayConfig[]
	isLoading?: boolean
	append?: ChatHandler["append"]
	message?: Message // in case you want to customize the message
}

function ChatMessageContent(props: ChatMessageContentProps) {
	const { message: defaultMessage, isLast } = useChatMessage()
	const message = props.message ?? defaultMessage
	const annotations = message.annotations as MessageAnnotation[] | undefined

	const contents = useMemo<ContentDisplayConfig[]>(() => {
		const displayMap: {
			[key in ContentPosition]?: React.ReactNode | null
		} = {
			[ContentPosition.CHAT_EVENTS]: (
				<EventAnnotations message={message} showLoading={(isLast && props.isLoading) ?? false} />
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
				props.append && {
					// show suggested questions only on the last message
					[ContentPosition.SUGGESTED_QUESTIONS]: (
						<SuggestedQuestionsAnnotations message={message} append={props.append} />
					),
				}),
		}

		// Override the default display map with the custom content
		props.content?.forEach((content) => {
			displayMap[content.position] = content.component
		})

		return Object.entries(displayMap).map(([position, component]) => ({
			position: parseInt(position),
			component,
		}))
	}, [annotations, isLast, message, props.append, props.content, props.isLoading])

	const children = props.children ?? (
		<>
			{contents
				.sort((a, b) => a.position - b.position)
				.map((content, index) => (
					<Fragment key={index}>{content.component}</Fragment>
				))}
		</>
	)

	return <div className={cn("flex min-w-0 flex-1 flex-col gap-4", props.className)}>{children}</div>
}

/**
 * ChatMessageActions
 */

interface ChatMessageActionsProps extends React.PropsWithChildren {
	className?: string
}

function ChatMessageActions(props: ChatMessageActionsProps) {
	const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: 2000 })
	const { message } = useChatMessage()

	const children = props.children ?? (
		<Button onClick={() => copyToClipboard(message.content)} size="icon" variant="ghost" className="h-8 w-8">
			{isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
		</Button>
	)
	return (
		<div className={cn("flex shrink-0 flex-col gap-2 opacity-0 group-hover:opacity-100", props.className)}>
			{children}
		</div>
	)
}

/**
 * ComposibleChatMessage
 */

type ComposibleChatMessage = typeof ChatMessage & {
	Avatar: typeof ChatMessageAvatar
	Content: typeof ChatMessageContent
	Actions: typeof ChatMessageActions
}

const PrimiviteChatMessage = memo(ChatMessage, (prevProps, nextProps) => {
	return !nextProps.isLast && prevProps.isLast === nextProps.isLast && prevProps.message === nextProps.message
}) as unknown as ComposibleChatMessage

PrimiviteChatMessage.Avatar = ChatMessageAvatar
PrimiviteChatMessage.Content = ChatMessageContent
PrimiviteChatMessage.Actions = ChatMessageActions

export default PrimiviteChatMessage
