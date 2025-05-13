import React from "react"
import { vscode } from "@src/utils/vscode"
interface ViewOutputBlockProps {
	iconName: string
	title: string
	content: string
	language?: string
	tooltip?: string
	filePath?: string // Optional file path to display
}

export const ViewOutputBlock: React.FC<ViewOutputBlockProps> = ({
	iconName,
	title,
	content,
	language,
	tooltip,
	filePath,
}) => {
	const handleClick = () => {
		vscode.postMessage({
			type: "showToolOutput",
			content: content || "",
			language: language || "plaintext",
		})
	}

	const displayTitle = filePath ? `${title} (${filePath})` : title

	return (
		<div className="min-h-7 rounded py-2 px-3 items-center cursor-pointer select-none border bg-vscode-editor-background border-purple-300/40">
			{/* Rely on select-none for user selection */}
			<div
				className="flex items-center cursor-pointer select-none gap-4"
				onClick={handleClick}
				title={tooltip || title}>
				<span className={`codicon codicon-${iconName}  text-purple-300/70`}></span>
				<span className="whitespace-nowrap overflow-hidden truncate text-ellipsis">{displayTitle}</span>
				<div className="flex-grow"></div>
				<span className={`codicon codicon-link-external text-[13.5px] `}></span>
			</div>
		</div>
	)
}

export default ViewOutputBlock
