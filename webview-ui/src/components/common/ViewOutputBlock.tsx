import { useTranslation } from "react-i18next"
import React from "react"
import { vscode } from "@src/utils/vscode"
import { CODE_BLOCK_BG_COLOR } from "./CodeBlock"
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
		<div
			style={{
				backgroundColor: CODE_BLOCK_BG_COLOR,
				overflow: "hidden",

				marginTop: 10, // Default margin, can be overridden with className or style prop if needed
			}}
			className="view-output-block border border-purple-300 text-purple-300 rounded-lg p-2" // Add a class for potential external styling
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					padding: "9px 10px",
					cursor: "pointer",
					userSelect: "none",
					WebkitUserSelect: "none",
					MozUserSelect: "none",
					msUserSelect: "none",
				}}
				onClick={handleClick}
				title={tooltip || title}>
				<span className={`codicon codicon-${iconName}`} style={{ marginRight: "10px" }}></span>
				<span
					style={{
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						marginRight: "8px",
					}}>
					{displayTitle}
				</span>
				<div style={{ flexGrow: 1 }}></div>
				<span className={`codicon codicon-link-external`} style={{ fontSize: 13.5, margin: "1px 0" }}></span>
			</div>
		</div>
	)
}

export default ViewOutputBlock
