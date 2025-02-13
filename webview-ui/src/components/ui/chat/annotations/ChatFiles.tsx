import { DocumentFileData } from "../types"
import { DocumentInfo } from "../widgets/DocumentInfo"

export function ChatFiles({ data }: { data: DocumentFileData }) {
	if (!data.files.length) {
		return null
	}

	return (
		<div className="flex items-center gap-2">
			{data.files.map((file) => (
				<DocumentInfo key={file.id} document={{ url: file.url, sources: [] }} className="mb-2 mt-2" />
			))}
		</div>
	)
}
