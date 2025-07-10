import React, { useState, useRef, useLayoutEffect, memo } from "react"
import { useWindowSize } from "react-use"
import { cn } from "@/lib/utils"
import type { FileAttachment as FileAttachmentType } from "../../../../src/shared/FileTypes"

interface FileAttachmentProps {
	files: FileAttachmentType[]
	setFiles?: (files: FileAttachmentType[]) => void
	style?: React.CSSProperties
	className?: string
	onHeightChange?: (height: number) => void
}

const FileAttachment: React.FC<FileAttachmentProps> = ({ files, setFiles, style, className, onHeightChange }) => {
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
	const containerRef = useRef<HTMLDivElement>(null)
	const { width } = useWindowSize()

	useLayoutEffect(() => {
		if (containerRef.current) {
			let height = containerRef.current.clientHeight
			// some browsers return 0 for clientHeight
			if (!height) {
				height = containerRef.current.getBoundingClientRect().height
			}
			onHeightChange?.(height)
		}
		setHoveredIndex(null)
	}, [files, width, onHeightChange])

	const handleDelete = (index: number) => {
		setFiles?.(files.filter((_, i) => i !== index))
	}

	const isDeletable = setFiles !== undefined

	if (files.length === 0) return null

	return (
		<div ref={containerRef} className={cn("file-attachments flex flex-wrap gap-2 p-2", className)} style={style}>
			{files.map((file, index) => (
				<div
					key={index}
					className="file-attachment-item relative flex items-center gap-2 px-3 py-1 bg-vscode-editor-background border border-vscode-panel-border rounded hover:bg-vscode-list-hoverBackground transition-colors"
					onMouseEnter={() => setHoveredIndex(index)}
					onMouseLeave={() => setHoveredIndex(null)}>
					<i className={cn("codicon", `codicon-file-${getFileIcon(file.type)}`)} />
					<span className="text-sm" title={file.path}>
						{file.path.length > 30 ? `${file.path.substring(0, 27)}...` : file.path}
					</span>
					{isDeletable && hoveredIndex === index && (
						<div
							onClick={() => handleDelete(index)}
							className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-vscode-badge-background flex justify-center items-center cursor-pointer">
							<span
								className="codicon codicon-close"
								style={{
									color: "var(--vscode-foreground)",
									fontSize: 10,
									fontWeight: "bold",
								}}></span>
						</div>
					)}
				</div>
			))}
		</div>
	)
}

function getFileIcon(type: string): string {
	const iconMap: Record<string, string> = {
		// Code files
		json: "code",
		xml: "code",
		yaml: "code",
		yml: "code",
		js: "code",
		ts: "code",
		jsx: "code",
		tsx: "code",
		py: "code",
		java: "code",
		c: "code",
		cpp: "code",
		cs: "code",
		go: "code",
		rs: "code",
		php: "code",
		rb: "code",
		swift: "code",
		kt: "code",
		scala: "code",
		r: "code",
		sh: "code",
		ps1: "code",
		bat: "code",
		cmd: "code",
		// Text files
		txt: "text",
		md: "markdown",
		log: "text",
		ini: "code",
		cfg: "code",
		conf: "code",
		// Data files
		csv: "table",
		tsv: "table",
		// Documents
		pdf: "pdf",
		doc: "file-text",
		docx: "file-text",
		xls: "table",
		xlsx: "table",
		ppt: "file-media",
		pptx: "file-media",
		// Web files
		html: "code",
		htm: "code",
		css: "code",
		scss: "code",
		sass: "code",
		less: "code",
	}
	return iconMap[type] || "text"
}

export default memo(FileAttachment)
