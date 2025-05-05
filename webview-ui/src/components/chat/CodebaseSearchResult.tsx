import React from "react"
import { vscode } from "@src/utils/vscode"

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
	// These props are required by the interface but not used in this implementation
	snippet: _snippet,
	language: _language,
}) => {
	const handleClick = () => {
		vscode.postMessage({
			type: "openFile",
			text: "./" + filePath,
			values: {
				line: startLine,
			},
		})
	}

	return (
		<div
			onClick={handleClick}
			className="mb-1 p-2 border border-secondary rounded cursor-pointer hover:bg-secondary hover:text-white"
			title={`Score: ${score.toFixed(2)}`}>
			<div className="flex justify-between items-center">
				<span>{filePath.split("/").at(-1)}</span>
				<span>
					Lines: {startLine}-{endLine}
				</span>
			</div>
		</div>
	)
}

export default CodebaseSearchResult
