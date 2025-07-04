import React, { memo, useState, useMemo } from "react"
import { ChevronDown, ChevronUp, FileText } from "lucide-react"
import { StandardTooltip } from "@/components/ui"
import { getLanguageFromPath } from "@src/utils/getLanguageFromPath"
import { removeLeadingNonAlphanumeric } from "@src/utils/removeLeadingNonAlphanumeric"

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

interface SideBySideDiffViewerProps {
	files: FileDiff[]
	ts: number
}

interface DiffLine {
	type: "unchanged" | "added" | "removed" | "context"
	content: string
	lineNumber?: number
	originalLineNumber?: number
	modifiedLineNumber?: number
}

interface ParsedDiff {
	originalContent: string
	modifiedContent: string
	diffLines: DiffLine[]
}

// Parse search/replace diff format into structured diff data
const parseDiffContent = (diffContent: string): ParsedDiff => {
	const lines = diffContent.split("\n")
	let originalContent = ""
	let modifiedContent = ""
	const diffLines: DiffLine[] = []

	let currentSection: "search" | "replace" | "none" = "none"
	let searchLines: string[] = []
	let replaceLines: string[] = []
	let originalLineNum = 1
	let modifiedLineNum = 1

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]

		if (line.startsWith("<<<<<<< SEARCH")) {
			currentSection = "search"
			continue
		} else if (line === "=======") {
			currentSection = "replace"
			continue
		} else if (line.startsWith(">>>>>>> REPLACE")) {
			// Process the accumulated search/replace block
			const maxLines = Math.max(searchLines.length, replaceLines.length)

			for (let j = 0; j < maxLines; j++) {
				const searchLine = j < searchLines.length ? searchLines[j] : undefined
				const replaceLine = j < replaceLines.length ? replaceLines[j] : undefined

				if (searchLine !== undefined && replaceLine !== undefined) {
					if (searchLine === replaceLine) {
						// Unchanged line
						diffLines.push({
							type: "unchanged",
							content: searchLine,
							originalLineNumber: originalLineNum++,
							modifiedLineNumber: modifiedLineNum++,
						})
					} else {
						// Changed line - show as removed then added
						diffLines.push({
							type: "removed",
							content: searchLine,
							originalLineNumber: originalLineNum++,
							modifiedLineNumber: undefined,
						})
						diffLines.push({
							type: "added",
							content: replaceLine,
							originalLineNumber: undefined,
							modifiedLineNumber: modifiedLineNum++,
						})
					}
				} else if (searchLine !== undefined) {
					// Line only in original (removed)
					diffLines.push({
						type: "removed",
						content: searchLine,
						originalLineNumber: originalLineNum++,
						modifiedLineNumber: undefined,
					})
				} else if (replaceLine !== undefined) {
					// Line only in modified (added)
					diffLines.push({
						type: "added",
						content: replaceLine,
						originalLineNumber: undefined,
						modifiedLineNumber: modifiedLineNum++,
					})
				}
			}

			// Reset for next block
			searchLines = []
			replaceLines = []
			currentSection = "none"
			continue
		}

		if (currentSection === "search") {
			searchLines.push(line)
			originalContent += line + "\n"
		} else if (currentSection === "replace") {
			replaceLines.push(line)
			modifiedContent += line + "\n"
		}
	}

	return {
		originalContent: originalContent.trim(),
		modifiedContent: modifiedContent.trim(),
		diffLines,
	}
}

const DiffLineComponent = memo(({ line, showLineNumbers = true }: { line: DiffLine; showLineNumbers?: boolean }) => {
	const getLineStyle = () => {
		switch (line.type) {
			case "added":
				return "bg-vscode-diffEditor-insertedTextBackground text-vscode-diffEditor-insertedTextForeground"
			case "removed":
				return "bg-vscode-diffEditor-removedTextBackground text-vscode-diffEditor-removedTextForeground"
			case "unchanged":
				return "bg-vscode-editor-background text-vscode-editor-foreground"
			default:
				return "bg-vscode-editor-background text-vscode-editor-foreground"
		}
	}

	const getLinePrefix = () => {
		switch (line.type) {
			case "added":
				return "+"
			case "removed":
				return "-"
			default:
				return " "
		}
	}

	return (
		<div className={`flex font-mono text-sm leading-relaxed ${getLineStyle()}`}>
			{showLineNumbers && (
				<>
					<div className="w-12 text-right pr-2 text-vscode-editorLineNumber-foreground opacity-60 select-none">
						{line.originalLineNumber || ""}
					</div>
					<div className="w-12 text-right pr-2 text-vscode-editorLineNumber-foreground opacity-60 select-none">
						{line.modifiedLineNumber || ""}
					</div>
				</>
			)}
			<div className="w-4 text-center text-vscode-editorLineNumber-foreground opacity-60 select-none">
				{getLinePrefix()}
			</div>
			<div className="flex-1 pl-2 pr-4 whitespace-pre-wrap break-words">{line.content || " "}</div>
		</div>
	)
})

DiffLineComponent.displayName = "DiffLineComponent"

const FileDiffViewer = memo(
	({ file, isExpanded, onToggleExpand }: { file: FileDiff; isExpanded: boolean; onToggleExpand: () => void }) => {
		const [viewMode, setViewMode] = useState<"unified" | "split">("split")

		const parsedDiff = useMemo(() => {
			const combinedDiff = file.diffs?.map((diff) => diff.content).join("\n\n") || file.content
			return parseDiffContent(combinedDiff)
		}, [file])

		const language = useMemo(() => getLanguageFromPath(file.path), [file.path])

		const renderUnifiedView = () => (
			<div className="border border-vscode-panel-border rounded">
				<div className="bg-vscode-editor-background">
					{/* Header */}
					<div className="flex bg-vscode-editorGroupHeader-tabsBackground text-vscode-tab-activeForeground text-xs font-mono border-b border-vscode-panel-border">
						<div className="w-12 text-center py-1 border-r border-vscode-panel-border">Old</div>
						<div className="w-12 text-center py-1 border-r border-vscode-panel-border">New</div>
						<div className="w-4 text-center py-1 border-r border-vscode-panel-border"></div>
						<div className="flex-1 py-1 pl-2">{removeLeadingNonAlphanumeric(file.path)}</div>
					</div>

					{/* Diff content */}
					<div className="max-h-96 overflow-y-auto">
						{parsedDiff.diffLines.map((line, index) => (
							<DiffLineComponent key={index} line={line} showLineNumbers={true} />
						))}
					</div>
				</div>
			</div>
		)

		const renderSplitView = () => (
			<div className="border border-vscode-panel-border rounded">
				<div className="bg-vscode-editor-background">
					{/* Header */}
					<div className="flex bg-vscode-editorGroupHeader-tabsBackground text-vscode-tab-activeForeground text-xs font-mono border-b border-vscode-panel-border">
						<div className="flex-1 text-center py-1 border-r border-vscode-panel-border">
							Original ({removeLeadingNonAlphanumeric(file.path)})
						</div>
						<div className="flex-1 text-center py-1">
							Modified ({removeLeadingNonAlphanumeric(file.path)})
						</div>
					</div>

					{/* Split diff content */}
					<div className="flex max-h-96 overflow-hidden">
						{/* Original content */}
						<div className="flex-1 border-r border-vscode-panel-border overflow-y-auto">
							{parsedDiff.diffLines
								.filter((line) => line.type !== "added")
								.map((line, index) => (
									<div
										key={`orig-${index}`}
										className={`flex font-mono text-sm leading-relaxed ${
											line.type === "removed"
												? "bg-vscode-diffEditor-removedTextBackground text-vscode-diffEditor-removedTextForeground"
												: "bg-vscode-editor-background text-vscode-editor-foreground"
										}`}>
										<div className="w-12 text-right pr-2 text-vscode-editorLineNumber-foreground opacity-60 select-none">
											{line.originalLineNumber || ""}
										</div>
										<div className="flex-1 pl-2 pr-4 whitespace-pre-wrap break-words">
											{line.content || " "}
										</div>
									</div>
								))}
						</div>

						{/* Modified content */}
						<div className="flex-1 overflow-y-auto">
							{parsedDiff.diffLines
								.filter((line) => line.type !== "removed")
								.map((line, index) => (
									<div
										key={`mod-${index}`}
										className={`flex font-mono text-sm leading-relaxed ${
											line.type === "added"
												? "bg-vscode-diffEditor-insertedTextBackground text-vscode-diffEditor-insertedTextForeground"
												: "bg-vscode-editor-background text-vscode-editor-foreground"
										}`}>
										<div className="w-12 text-right pr-2 text-vscode-editorLineNumber-foreground opacity-60 select-none">
											{line.modifiedLineNumber || ""}
										</div>
										<div className="flex-1 pl-2 pr-4 whitespace-pre-wrap break-words">
											{line.content || " "}
										</div>
									</div>
								))}
						</div>
					</div>
				</div>
			</div>
		)

		return (
			<div className="border border-vscode-panel-border rounded-md">
				{/* File header */}
				<div
					className="flex items-center justify-between p-3 bg-vscode-editorGroupHeader-tabsBackground border-b border-vscode-panel-border cursor-pointer hover:bg-vscode-list-hoverBackground"
					onClick={onToggleExpand}>
					<div className="flex items-center gap-2">
						<FileText size={16} className="text-vscode-symbolIcon-fileForeground" />
						<span className="font-mono text-sm text-vscode-tab-activeForeground">
							{removeLeadingNonAlphanumeric(file.path)}
						</span>
						<span className="text-xs text-vscode-descriptionForeground">
							({file.changeCount} {file.changeCount === 1 ? "change" : "changes"})
						</span>
					</div>
					<div className="flex items-center gap-2">
						{isExpanded && (
							<div className="flex items-center gap-1">
								<StandardTooltip content="Toggle view mode" side="top">
									<button
										className="px-2 py-1 text-xs bg-vscode-button-background text-vscode-button-foreground rounded hover:bg-vscode-button-hoverBackground"
										onClick={(e) => {
											e.stopPropagation()
											setViewMode(viewMode === "split" ? "unified" : "split")
										}}>
										{viewMode === "split" ? "Unified" : "Split"}
									</button>
								</StandardTooltip>
							</div>
						)}
						{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
					</div>
				</div>

				{/* Diff content */}
				{isExpanded && (
					<div className="p-3">{viewMode === "split" ? renderSplitView() : renderUnifiedView()}</div>
				)}
			</div>
		)
	},
)

FileDiffViewer.displayName = "FileDiffViewer"

export const SideBySideDiffViewer = memo(({ files = [], ts }: SideBySideDiffViewerProps) => {
	const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({})
	const [allExpanded, setAllExpanded] = useState(false)

	if (!files?.length) {
		return null
	}

	const handleToggleExpand = (filePath: string) => {
		setExpandedFiles((prev) => ({
			...prev,
			[filePath]: !prev[filePath],
		}))
	}

	const handleToggleAll = () => {
		const newState = !allExpanded
		setAllExpanded(newState)
		const newExpandedFiles: Record<string, boolean> = {}
		files.forEach((file) => {
			newExpandedFiles[file.path] = newState
		})
		setExpandedFiles(newExpandedFiles)
	}

	const totalChanges = files.reduce((sum, file) => sum + file.changeCount, 0)

	return (
		<div className="pt-[5px]">
			{/* Summary header */}
			<div className="flex items-center justify-between mb-3 p-3 bg-vscode-editorWidget-background border border-vscode-panel-border rounded-md">
				<div className="flex items-center gap-2">
					<FileText size={16} className="text-vscode-symbolIcon-fileForeground" />
					<span className="text-sm font-medium text-vscode-foreground">
						{files.length} {files.length === 1 ? "file" : "files"} with {totalChanges}{" "}
						{totalChanges === 1 ? "change" : "changes"}
					</span>
				</div>
				<StandardTooltip content={allExpanded ? "Collapse all files" : "Expand all files"} side="top">
					<button
						className="px-3 py-1 text-xs bg-vscode-button-background text-vscode-button-foreground rounded hover:bg-vscode-button-hoverBackground"
						onClick={handleToggleAll}>
						{allExpanded ? "Collapse All" : "Expand All"}
					</button>
				</StandardTooltip>
			</div>

			{/* File diffs */}
			<div className="flex flex-col gap-2">
				{files.map((file) => (
					<FileDiffViewer
						key={`${file.path}-${ts}`}
						file={file}
						isExpanded={expandedFiles[file.path] || allExpanded}
						onToggleExpand={() => handleToggleExpand(file.path)}
					/>
				))}
			</div>
		</div>
	)
})

SideBySideDiffViewer.displayName = "SideBySideDiffViewer"
