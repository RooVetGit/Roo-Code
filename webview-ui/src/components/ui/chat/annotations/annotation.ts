import { AnnotationData, MessageAnnotation, MessageAnnotationType, SourceData, SourceNode } from "../types"

export function getAnnotationData<T extends AnnotationData>(annotations: MessageAnnotation[], type: string): T[] {
	if (!annotations?.length) {
		return []
	}

	return annotations.filter((a) => a.type.toString() === type).map((a) => a.data as T)
}

export function getSourceAnnotationData(annotations: MessageAnnotation[]): SourceData[] {
	const data = getAnnotationData<SourceData>(annotations, MessageAnnotationType.SOURCES)

	if (data.length > 0) {
		return [{ ...data[0], nodes: data[0].nodes ? preprocessSourceNodes(data[0].nodes) : [] }]
	}

	return data
}

const NODE_SCORE_THRESHOLD = 0.25

function preprocessSourceNodes(nodes: SourceNode[]): SourceNode[] {
	// Filter source nodes has lower score.
	const processedNodes = nodes
		.filter((node) => (node.score ?? 1) > NODE_SCORE_THRESHOLD)
		.filter((node) => node.url && node.url.trim() !== "")
		.sort((a, b) => (b.score ?? 1) - (a.score ?? 1))
		.map((node) => {
			// Remove trailing slash for node url if exists.
			node.url = node.url.replace(/\/$/, "")
			return node
		})

	return processedNodes
}
