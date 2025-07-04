import React, { memo, useState } from "react"
import { Eye, Code } from "lucide-react"
import CodeAccordian from "../common/CodeAccordian"
import { SideBySideDiffViewer } from "./SideBySideDiffViewer"
import { StandardTooltip } from "@/components/ui"

interface FileDiff {
	path: string
	changeCount: number
	key: string
	content: string
	diffs?: Array<{
		content: string
		startLine?: number
	}>
}

interface BatchDiffApprovalProps {
	files: FileDiff[]
	ts: number
}

export const BatchDiffApproval = memo(({ files = [], ts }: BatchDiffApprovalProps) => {
	const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({})
	const [viewMode, setViewMode] = useState<"traditional" | "side-by-side">("side-by-side")

	if (!files?.length) {
		return null
	}

	const handleToggleExpand = (filePath: string) => {
		setExpandedFiles((prev) => ({
			...prev,
			[filePath]: !prev[filePath],
		}))
	}

	const renderTraditionalView = () => (
		<div className="flex flex-col gap-0 border border-border rounded-md p-1">
			{files.map((file) => {
				// Combine all diffs into a single diff string for this file
				const combinedDiff = file.diffs?.map((diff) => diff.content).join("\n\n") || file.content

				return (
					<div key={`${file.path}-${ts}`}>
						<CodeAccordian
							path={file.path}
							code={combinedDiff}
							language="diff"
							isExpanded={expandedFiles[file.path] || false}
							onToggleExpand={() => handleToggleExpand(file.path)}
						/>
					</div>
				)
			})}
		</div>
	)

	return (
		<div className="pt-[5px]">
			{/* View mode toggle */}
			<div className="flex items-center justify-between mb-3 p-2 bg-vscode-editorWidget-background border border-vscode-panel-border rounded-md">
				<span className="text-sm text-vscode-foreground">Diff Preview</span>
				<div className="flex items-center gap-1">
					<StandardTooltip content="Traditional search/replace view" side="top">
						<button
							className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
								viewMode === "traditional"
									? "bg-vscode-button-background text-vscode-button-foreground"
									: "bg-transparent text-vscode-descriptionForeground hover:bg-vscode-list-hoverBackground"
							}`}
							onClick={() => setViewMode("traditional")}>
							<Code size={12} />
							Traditional
						</button>
					</StandardTooltip>
					<StandardTooltip content="Side-by-side diff view" side="top">
						<button
							className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
								viewMode === "side-by-side"
									? "bg-vscode-button-background text-vscode-button-foreground"
									: "bg-transparent text-vscode-descriptionForeground hover:bg-vscode-list-hoverBackground"
							}`}
							onClick={() => setViewMode("side-by-side")}>
							<Eye size={12} />
							Side-by-Side
						</button>
					</StandardTooltip>
				</div>
			</div>

			{/* Render based on view mode */}
			{viewMode === "side-by-side" ? <SideBySideDiffViewer files={files} ts={ts} /> : renderTraditionalView()}
		</div>
	)
})

BatchDiffApproval.displayName = "BatchDiffApproval"
