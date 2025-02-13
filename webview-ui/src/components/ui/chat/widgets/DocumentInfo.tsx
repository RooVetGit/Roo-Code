import { HoverCard, HoverCardContent, HoverCardTrigger } from "@radix-ui/react-hover-card"
import { Check, Copy, FileIcon, XCircleIcon, CircleSlashIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { useClipboard } from "@/hooks/useClipboard"
import { Button } from "@/components/ui"

import { DocumentFileType, SourceNode } from "../types"
import { SourceNumberButton } from "./SourceNumberButton"

type DocumentInfoProps = {
	document: {
		url: string
		sources: SourceNode[]
	}
	className?: string
	onRemove?: () => void
	startIndex?: number
}

export function DocumentInfo({ document, className, onRemove, startIndex = 0 }: DocumentInfoProps) {
	const { url, sources } = document
	const urlParts = url.split("/")
	const fileName = urlParts.length > 0 ? urlParts[urlParts.length - 1] : url
	const fileExt = fileName?.split(".").pop() as DocumentFileType | undefined

	const previewFile = {
		name: fileName,
		type: fileExt as DocumentFileType,
	}

	// Open external link when click document card for other file types.
	return (
		<div onClick={() => window.open(url, "_blank")}>
			<div className={`relative ${className}`}>
				<DocumentPreviewCard className="cursor-pointer" file={previewFile} onRemove={onRemove} />
				<div className="absolute bottom-2 right-2 flex space-x-2">
					{sources.map((node: SourceNode, index: number) => (
						<div key={node.id}>
							<SourceInfo node={node} index={startIndex + index} />
						</div>
					))}
				</div>
			</div>
		</div>
	)
}

function SourceInfo({ node, index }: { node?: SourceNode; index: number }) {
	if (!node) {
		return <SourceNumberButton index={index} />
	}

	return (
		<HoverCard>
			<HoverCardTrigger
				className="cursor-default"
				onClick={(e) => {
					e.preventDefault()
					e.stopPropagation()
				}}>
				<SourceNumberButton index={index} className="hover:bg-primary hover:text-white" />
			</HoverCardTrigger>
			<HoverCardContent className="w-[400px] bg-white p-4">
				<NodeInfo nodeInfo={node} />
			</HoverCardContent>
		</HoverCard>
	)
}

function NodeInfo({ nodeInfo }: { nodeInfo: SourceNode }) {
	const { isCopied, copy } = useClipboard()

	const pageNumber =
		// XXX: page_label is used in Python, but page_number is used by Typescript
		(nodeInfo.metadata?.page_number as number) ?? (nodeInfo.metadata?.page_label as number) ?? null

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<span className="font-semibold">{pageNumber ? `On page ${pageNumber}:` : "Node content:"}</span>
				{nodeInfo.text && (
					<Button
						onClick={(e) => {
							e.stopPropagation()
							copy(nodeInfo.text)
						}}
						size="icon"
						variant="ghost"
						className="h-12 w-12 shrink-0">
						{isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
					</Button>
				)}
			</div>

			{nodeInfo.text && (
				<pre className="max-h-[200px] overflow-auto whitespace-pre-line">&ldquo;{nodeInfo.text}&rdquo;</pre>
			)}
		</div>
	)
}

// TODO: Add icons for each file type.
const FileIconMap: Record<DocumentFileType, React.ReactNode> = {
	csv: <CircleSlashIcon />,
	pdf: <CircleSlashIcon />,
	docx: <CircleSlashIcon />,
	txt: <CircleSlashIcon />,
}

function DocumentPreviewCard(props: {
	file: {
		name: string
		size?: number
		type: DocumentFileType
	}
	onRemove?: () => void
	className?: string
}) {
	const { onRemove, file, className } = props
	return (
		<div className={cn("bg-secondary relative w-60 max-w-60 rounded-lg p-2 text-sm", className)}>
			<div className="flex flex-row items-center gap-2">
				<div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md">
					{FileIconMap[file.type] ?? <FileIcon />}
				</div>
				<div className="overflow-hidden">
					<div className="truncate font-semibold">
						{file.name} {file.size ? `(${inKB(file.size)} KB)` : ""}
					</div>
					{file.type && (
						<div className="text-token-text-tertiary flex items-center gap-2 truncate">
							<span>{file.type.toUpperCase()} File</span>
						</div>
					)}
				</div>
			</div>
			{onRemove && (
				<div className={cn("absolute -right-2 -top-2 z-10 h-6 w-6 rounded-full bg-gray-500 text-white")}>
					<XCircleIcon
						className="h-6 w-6 rounded-full bg-gray-500 text-white"
						onClick={(e) => {
							e.stopPropagation()
							onRemove()
						}}
					/>
				</div>
			)}
		</div>
	)
}

function inKB(size: number) {
	return Math.round((size / 1024) * 10) / 10
}
