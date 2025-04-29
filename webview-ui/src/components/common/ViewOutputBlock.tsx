import { useTranslation } from "react-i18next"
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
	const { t } = useTranslation()
	const handleClick = () => {
		vscode.postMessage({
			type: "showToolOutput",
			content: content || "",
			language: language || "plaintext",
		})
	}

	const displayTitle = filePath ? `${title}${t("chat:filePathFormat", { filePath })}` : title

	return (
		<div className="roo-tool-use border-purple-300/30">
			{/* Rely on select-none for user selection */}
			<div
				className="flex items-center cursor-pointer select-none gap-4"
				onClick={handleClick}
				title={tooltip || title}>
				<span className={`codicon codicon-${iconName}  text-purple-300/70`}></span>
				<span className="whitespace-nowrap overflow-hidden text-ellipsis">{displayTitle}</span>
				<div className="flex-grow"></div>
				<span className={`codicon codicon-link-external text-[13.5px] `}></span>
			</div>
		</div>
	)
}

export default ViewOutputBlock
