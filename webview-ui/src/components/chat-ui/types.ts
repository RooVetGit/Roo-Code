export interface Message {
	role: "system" | "user" | "assistant" | "data"
	content: string
	annotations?: any
}

export type ChatHandler = {
	isLoading: boolean
	setIsLoading: (isLoading: boolean) => void

	input: string
	setInput: (input: string) => void

	messages: Message[]

	reload?: (options?: { data?: any }) => void
	start?: (options?: { data?: any }) => void
	stop?: () => void
	append: (message: Message, options?: { data?: any }) => Promise<string | null | undefined>
	reset?: () => void
}

export enum MessageAnnotationType {
	IMAGE = "image",
	DOCUMENT_FILE = "document_file",
	SOURCES = "sources",
	EVENTS = "events",
	SUGGESTED_QUESTIONS = "suggested_questions",
	AGENT_EVENTS = "agent",
}

export type ImageData = {
	url: string
}

export type DocumentFileType = "csv" | "pdf" | "txt" | "docx"

export const DOCUMENT_FILE_TYPES: DocumentFileType[] = ["csv", "pdf", "txt", "docx"]

export type DocumentFile = {
	id: string
	name: string // The uploaded file name in the backend
	size: number // The file size in bytes
	type: DocumentFileType
	url: string // The URL of the uploaded file in the backend
	refs?: string[] // DocumentIDs of the uploaded file in the vector index
}

export type DocumentFileData = {
	files: DocumentFile[]
}

export type SourceNode = {
	id: string
	metadata: Record<string, unknown>
	score?: number
	text: string
	url: string
}

export type SourceData = {
	nodes: SourceNode[]
}

export type EventData = {
	title: string
}

export type ProgressData = {
	id: string
	total: number
	current: number
}

export type AgentEventData = {
	agent: string
	text: string
	type: "text" | "progress"
	data?: ProgressData
}

export type SuggestedQuestionsData = string[]

export type AnnotationData =
	| ImageData
	| DocumentFileData
	| SourceData
	| EventData
	| AgentEventData
	| SuggestedQuestionsData

export type MessageAnnotation = {
	type: MessageAnnotationType
	data: AnnotationData
}
