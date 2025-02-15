import {
	ChatHandler,
	Message,
	AgentEventData,
	DocumentFileData,
	EventData,
	ImageData,
	MessageAnnotationType,
	SuggestedQuestionsData,
} from "./types"

import { ChatAgentEvents, ChatEvents, ChatFiles, ChatImage, ChatSources, SuggestedQuestions } from "./annotations"
import { getAnnotationData, getSourceAnnotationData } from "./annotations/annotation"
import { Markdown } from "./widgets/Markdown"

export function EventAnnotations({
	message: { annotations = [] },
	showLoading,
}: {
	message: Message
	showLoading: boolean
}) {
	const data = annotations.length > 0 ? getAnnotationData<EventData>(annotations, MessageAnnotationType.EVENTS) : null
	return data?.length ? <ChatEvents data={data} showLoading={showLoading} /> : null
}

export function AgentEventAnnotations({ message: { annotations = [], content } }: { message: Message }) {
	const data =
		annotations.length > 0
			? getAnnotationData<AgentEventData>(annotations, MessageAnnotationType.AGENT_EVENTS)
			: null

	return data?.length ? <ChatAgentEvents data={data} isFinished={Boolean(content)} /> : null
}

export function ImageAnnotations({ message: { annotations = [] } }: { message: Message }) {
	const imageData = annotations.length > 0 ? getAnnotationData<ImageData>(annotations, "image") : null
	return imageData?.[0] ? <ChatImage data={imageData[0]} /> : null
}

export function MarkdownAnnotations({ message: { annotations = [], content } }: { message: Message }) {
	const sourceData = annotations.length > 0 ? getSourceAnnotationData(annotations) : null
	return <Markdown content={content} sources={sourceData?.[0]} />
}

export function DocumentFileAnnotations({ message: { annotations = [] } }: { message: Message }) {
	const documentFileData =
		annotations.length > 0
			? getAnnotationData<DocumentFileData>(annotations, MessageAnnotationType.DOCUMENT_FILE)
			: null

	return documentFileData?.[0] ? <ChatFiles data={documentFileData[0]} /> : null
}

export function SourceAnnotations({ message: { annotations = [] } }: { message: Message }) {
	const sourceData = annotations.length > 0 ? getSourceAnnotationData(annotations) : null
	return sourceData?.[0] ? <ChatSources data={sourceData[0]} /> : null
}

export function SuggestedQuestionsAnnotations({
	message: { annotations = [] },
	append,
}: {
	message: Message
	append: ChatHandler["append"]
}) {
	const suggestedQuestionsData =
		annotations.length > 0
			? getAnnotationData<SuggestedQuestionsData>(annotations, MessageAnnotationType.SUGGESTED_QUESTIONS)
			: null

	return suggestedQuestionsData?.[0] ? (
		<SuggestedQuestions questions={suggestedQuestionsData[0]} append={append} />
	) : null
}
