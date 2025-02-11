import { useMemo } from "react"

import { SourceData, SourceNode } from "../annotation"
import { DocumentInfo } from "../widgets/DocumentInfo"

export function ChatSources({ data }: { data: SourceData }) {
	const documents: {
		url: string
		sources: SourceNode[]
	}[] = useMemo(() => {
		// Group nodes by document (a document must have a URL).
		const nodesByUrl: Record<string, SourceNode[]> = {}

		data.nodes.forEach((node) => {
			const key = node.url
			nodesByUrl[key] ??= []
			nodesByUrl[key].push(node)
		})

		// Convert to array of documents.
		return Object.entries(nodesByUrl).map(([url, sources]) => ({ url, sources }))
	}, [data.nodes])

	if (documents.length === 0) {
		return null
	}

	return (
		<div className="space-y-2 text-sm">
			<div className="text-lg font-semibold">Sources:</div>
			<div className="flex flex-wrap gap-3">
				{documents.map((document, index) => {
					const startIndex = documents.slice(0, index).reduce((acc, doc) => acc + doc.sources.length, 0)
					return <DocumentInfo key={document.url} document={document} startIndex={startIndex} />
				})}
			</div>
		</div>
	)
}
