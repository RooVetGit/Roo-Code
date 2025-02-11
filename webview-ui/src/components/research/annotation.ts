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

const NODE_SCORE_THRESHOLD = 0.25

export function getAnnotationData<T extends AnnotationData>(annotations: MessageAnnotation[], type: string): T[] {
	if (!annotations?.length) return []
	return annotations.filter((a) => a.type.toString() === type).map((a) => a.data as T)
}

export function getSourceAnnotationData(annotations: MessageAnnotation[]): SourceData[] {
	const data = getAnnotationData<SourceData>(annotations, MessageAnnotationType.SOURCES)
	if (data.length > 0) {
		return [
			{
				...data[0],
				nodes: data[0].nodes ? preprocessSourceNodes(data[0].nodes) : [],
			},
		]
	}
	return data
}

function preprocessSourceNodes(nodes: SourceNode[]): SourceNode[] {
	// Filter source nodes has lower score
	const processedNodes = nodes
		.filter((node) => (node.score ?? 1) > NODE_SCORE_THRESHOLD)
		.filter((node) => node.url && node.url.trim() !== "")
		.sort((a, b) => (b.score ?? 1) - (a.score ?? 1))
		.map((node) => {
			// remove trailing slash for node url if exists
			node.url = node.url.replace(/\/$/, "")
			return node
		})
	return processedNodes
}
