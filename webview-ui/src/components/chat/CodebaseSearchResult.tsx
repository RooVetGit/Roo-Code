import React, { useState } from "react"
import CodeBlock from "../common/CodeBlock"

interface CodebaseSearchResultProps {
	filePath: string
	score: number
	startLine: number
	endLine: number
	snippet: string
	language: string
}

const CodebaseSearchResult: React.FC<CodebaseSearchResultProps> = ({
	filePath,
	score,
	startLine,
	endLine,
	snippet,
	language,
}) => {
	const [isCollapsed, setIsCollapsed] = useState(true)

	const toggleCollapse = () => {
		setIsCollapsed(!isCollapsed)
	}

	return (
		<div style={{ marginBottom: "1rem", padding: "0.5rem", border: "1px solid #ccc", borderRadius: "4px" }}>
			<div
				onClick={toggleCollapse}
				style={{
					fontWeight: "bold",
					marginBottom: isCollapsed ? "0" : "0.25rem",
					cursor: "pointer",
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
				}}>
				<span>{filePath}</span>
				<span>
					Lines: {startLine}-{endLine}
				</span>
			</div>
			{!isCollapsed && (
				<>
					<div style={{ margin: "0.25rem 0" }}>Score: {score.toFixed(2)}</div>
					<CodeBlock source={`\`\`\`${language}\n${snippet}\n\`\`\``} />
				</>
			)}
		</div>
	)
}

export default CodebaseSearchResult
