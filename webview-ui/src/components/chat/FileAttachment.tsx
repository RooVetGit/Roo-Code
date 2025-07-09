import React from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { cn } from "@/lib/utils"

interface FileAttachmentProps {
	files: Array<{ path: string; content: string; type: string }>
	setFiles: (files: Array<{ path: string; content: string; type: string }>) => void
	style?: React.CSSProperties
	className?: string
}

export const FileAttachment: React.FC<FileAttachmentProps> = ({ files, setFiles, style, className }) => {
	const removeFile = (index: number) => {
		setFiles(files.filter((_, i) => i !== index))
	}

	if (files.length === 0) return null

	return (
		<div className={cn("file-attachments flex flex-wrap gap-2 p-2", className)} style={style}>
			{files.map((file, index) => (
				<div
					key={index}
					className="file-attachment-item flex items-center gap-2 px-3 py-1 bg-vscode-editor-background border border-vscode-panel-border rounded">
					<i className={cn("codicon", `codicon-file-${getFileIcon(file.type)}`)} />
					<span className="text-sm">{file.path}</span>
					<VSCodeButton appearance="icon" onClick={() => removeFile(index)} className="ml-1">
						<i className="codicon codicon-close" />
					</VSCodeButton>
				</div>
			))}
		</div>
	)
}

function getFileIcon(type: string): string {
	const iconMap: Record<string, string> = {
		json: "code",
		xml: "code",
		yaml: "code",
		yml: "code",
		txt: "text",
		md: "markdown",
		csv: "table",
		tsv: "table",
		pdf: "pdf",
		log: "text",
		ini: "code",
		cfg: "code",
		conf: "code",
	}
	return iconMap[type] || "text"
}
