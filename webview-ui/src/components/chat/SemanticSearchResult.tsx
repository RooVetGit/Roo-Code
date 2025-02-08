import React, { useState } from "react"
import { VSCodeBadge } from "@vscode/webview-ui-toolkit/react"
import { vscode } from "../../utils/vscode"
import { WebviewMessage } from "../../../../src/shared/WebviewMessage"

interface SearchResult {
	type: "file" | "code"
	filePath: string
	startLine?: number
	endLine?: number
	name: string
}

interface SemanticSearchResultProps {
	query: string
	results: SearchResult[]
}

const SemanticSearchResult: React.FC<SemanticSearchResultProps> = ({ query, results }) => {
	const [isExpanded, setIsExpanded] = useState(false)

	const handleFileClick = (filePath: string, startLine?: number, endLine?: number) => {
		try {
			// Validate filePath
			if (!filePath) {
				console.error("No file path provided")
				return
			}

			const message: WebviewMessage = {
				type: "openFile",
				value: {
					filePath,
					startLine,
					endLine,
				},
			}

			console.log("Sending file open message:", message)
			vscode.postMessage(message)
		} catch (error) {
			console.error("Error opening file:", error)
		}
	}

	const getFileName = (filePath: string) => {
		const lastSeparator = Math.max(
			filePath.lastIndexOf("/"),
			filePath.lastIndexOf("\\")
		);
		return filePath.substring(lastSeparator + 1);
	}

	return (
		<div style={{ marginTop: "8px" }}>
			<div
				style={{
					marginBottom: "8px",
					cursor: "pointer",
					display: "flex",
					alignItems: "center",
					gap: "8px",
					width: "100%",
				}}
				onClick={() => setIsExpanded(!isExpanded)}>
				<span className={`codicon codicon-chevron-${isExpanded ? "down" : "right"}`}></span>
				<strong>Search</strong> {query}
				<VSCodeBadge style={{ marginLeft: "auto" }}>{results.length}</VSCodeBadge>
			</div>
			{isExpanded && (
				<div style={{ display: "flex", flexDirection: "column", gap: "4px", marginLeft: "24px" }}>
					{results.map((result, index) => (
						<div
							key={index}
							onClick={() => handleFileClick(result.filePath, result.startLine, result.endLine)}
							style={{
								padding: "4px 8px",
								cursor: "pointer",
								backgroundColor: "var(--vscode-list-hoverBackground)",
								borderRadius: "4px",
							}}>
							<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
								<span>{getFileName(result.filePath)}</span>
								{result.startLine && result.endLine && (
									<span style={{ color: "var(--vscode-descriptionForeground)" }}>
										Lines {result.startLine}-{result.endLine}
									</span>
								)}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	)
}

export default SemanticSearchResult
