import { ChatHandler, Message } from "./types"

import { ChatAgentEvents, ChatEvents, ChatFiles, ChatImage, ChatSources, SuggestedQuestions } from "./annotations"
import {
	AgentEventData,
	DocumentFileData,
	EventData,
	getAnnotationData,
	getSourceAnnotationData,
	ImageData,
	MessageAnnotation,
	MessageAnnotationType,
	SuggestedQuestionsData,
} from "./annotation"

export function EventAnnotations({ message, showLoading }: { message: Message; showLoading: boolean }) {
	const annotations = message.annotations as MessageAnnotation[] | undefined
	const eventData =
		annotations && annotations.length > 0
			? getAnnotationData<EventData>(annotations, MessageAnnotationType.EVENTS)
			: null
	if (!eventData?.length) return null
	return <ChatEvents data={eventData} showLoading={showLoading} />
}

export function AgentEventAnnotations({ message }: { message: Message }) {
	const annotations = message.annotations as MessageAnnotation[] | undefined
	const agentEventData =
		annotations && annotations.length > 0
			? getAnnotationData<AgentEventData>(annotations, MessageAnnotationType.AGENT_EVENTS)
			: null
	if (!agentEventData?.length) return null
	return <ChatAgentEvents data={agentEventData} isFinished={Boolean(message.content)} />
}

export function ImageAnnotations({ message }: { message: Message }) {
	const annotations = message.annotations as MessageAnnotation[] | undefined
	const imageData = annotations && annotations.length > 0 ? getAnnotationData<ImageData>(annotations, "image") : null
	if (!imageData) return null
	return imageData[0] ? <ChatImage data={imageData[0]} /> : null
}

export function DocumentFileAnnotations({ message }: { message: Message }) {
	const annotations = message.annotations as MessageAnnotation[] | undefined
	const contentFileData =
		annotations && annotations.length > 0
			? getAnnotationData<DocumentFileData>(annotations, MessageAnnotationType.DOCUMENT_FILE)
			: null
	if (!contentFileData) return null
	return contentFileData[0] ? <ChatFiles data={contentFileData[0]} /> : null
}

export function SourceAnnotations({ message }: { message: Message }) {
	const annotations = message.annotations as MessageAnnotation[] | undefined
	const sourceData = annotations && annotations.length > 0 ? getSourceAnnotationData(annotations) : null
	if (!sourceData) return null
	return sourceData[0] ? <ChatSources data={sourceData[0]} /> : null
}

export function SuggestedQuestionsAnnotations({
	message,
	append,
}: {
	message: Message
	append: ChatHandler["append"]
}) {
	const annotations = message.annotations as MessageAnnotation[] | undefined
	const suggestedQuestionsData =
		annotations && annotations.length > 0
			? getAnnotationData<SuggestedQuestionsData>(annotations, MessageAnnotationType.SUGGESTED_QUESTIONS)
			: null
	if (!suggestedQuestionsData?.[0]) return null
	return <SuggestedQuestions questions={suggestedQuestionsData[0]} append={append} />
}
