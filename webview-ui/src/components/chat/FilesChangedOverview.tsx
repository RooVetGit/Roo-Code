import React from "react"
import { FileChangeset, FileChange } from "@roo-code/types"

interface FilesChangedOverviewProps {
	changeset: FileChangeset
	onViewDiff: (uri: string) => void
	onAcceptFile: (uri: string) => void
	onRejectFile: (uri: string) => void
	onAcceptAll: () => void
	onRejectAll: () => void
}

const FilesChangedOverview: React.FC<FilesChangedOverviewProps> = ({
	changeset,
	onViewDiff,
	onAcceptFile,
	onRejectFile,
	onAcceptAll,
	onRejectAll,
}) => {
	const files = changeset.files
	const [isCollapsed, setIsCollapsed] = React.useState(true)

	const formatLineChanges = (file: FileChange): string => {
		const added = file.linesAdded || 0
		const removed = file.linesRemoved || 0

		if (file.type === "create") {
			return `+${added} lines`
		} else if (file.type === "delete") {
			return `deleted`
		} else {
			const parts = []
			if (added > 0) parts.push(`+${added}`)
			if (removed > 0) parts.push(`-${removed}`)
			return parts.length > 0 ? parts.join(", ") + " lines" : "modified"
		}
	}

	const getTotalChanges = (): string => {
		const totalAdded = files.reduce((sum, file) => sum + (file.linesAdded || 0), 0)
		const totalRemoved = files.reduce((sum, file) => sum + (file.linesRemoved || 0), 0)

		const parts = []
		if (totalAdded > 0) parts.push(`+${totalAdded}`)
		if (totalRemoved > 0) parts.push(`-${totalRemoved}`)
		return parts.length > 0 ? ` (${parts.join(", ")})` : ""
	}

	return (
		<div
			className="files-changed-overview"
			style={{
				border: "1px solid var(--vscode-panel-border)",
				borderRadius: "4px",
				padding: "12px",
				margin: "8px 0",
				backgroundColor: "var(--vscode-editor-background)",
			}}>
			{/* Collapsible header */}
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: isCollapsed ? "0" : "12px",
					borderBottom: isCollapsed ? "none" : "1px solid var(--vscode-panel-border)",
					paddingBottom: "8px",
					cursor: "pointer",
					userSelect: "none",
				}}
				onClick={() => setIsCollapsed(!isCollapsed)}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault()
						setIsCollapsed(!isCollapsed)
					}
				}}
				tabIndex={0}
				role="button"
				aria-expanded={!isCollapsed}
				aria-label={`Files changed list. ${files.length} files. ${isCollapsed ? "Collapsed" : "Expanded"}`}
				title={isCollapsed ? "Expand files list" : "Collapse files list"}>
				<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
					<span
						className={`codicon ${isCollapsed ? "codicon-chevron-right" : "codicon-chevron-down"}`}
						style={{
							fontSize: "12px",
							transition: "transform 0.2s ease",
						}}
					/>
					<h3 style={{ margin: 0, fontSize: "14px", fontWeight: "bold" }}>
						({files.length}) Files Changed, {getTotalChanges()}
					</h3>
				</div>

				{/* Action buttons always visible for quick access */}
				<div
					style={{ display: "flex", gap: "8px" }}
					onClick={(e) => e.stopPropagation()} // Prevent collapse toggle when clicking buttons
				>
					<button
						onClick={onAcceptAll}
						style={{
							backgroundColor: "var(--vscode-button-background)",
							color: "var(--vscode-button-foreground)",
							border: "none",
							borderRadius: "3px",
							padding: "4px 8px",
							fontSize: "12px",
							cursor: "pointer",
						}}
						title="Accept all changes">
						Accept All
					</button>
					<button
						onClick={onRejectAll}
						style={{
							backgroundColor: "var(--vscode-button-secondaryBackground)",
							color: "var(--vscode-button-secondaryForeground)",
							border: "none",
							borderRadius: "3px",
							padding: "4px 8px",
							fontSize: "12px",
							cursor: "pointer",
						}}
						title="Reject all changes">
						Reject All
					</button>
				</div>
			</div>

			{/* Collapsible content area */}
			{!isCollapsed && (
				<div
					style={{
						maxHeight: "300px",
						overflowY: "auto",
						transition: "opacity 0.2s ease-in-out",
						opacity: isCollapsed ? 0 : 1,
					}}>
					{files.map((file: FileChange) => (
						<div
							key={file.uri}
							style={{
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								padding: "6px 8px",
								marginBottom: "4px",
								backgroundColor: "var(--vscode-list-hoverBackground)",
								borderRadius: "3px",
								fontSize: "13px",
							}}>
							<div style={{ flex: 1, minWidth: 0 }}>
								<div
									style={{
										fontFamily: "var(--vscode-editor-font-family)",
										fontSize: "12px",
										color: "var(--vscode-editor-foreground)",
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
									}}>
									{file.uri}
								</div>
								<div
									style={{
										fontSize: "11px",
										color: "var(--vscode-descriptionForeground)",
										marginTop: "2px",
									}}>
									{file.type} • {formatLineChanges(file)}
								</div>
							</div>

							<div style={{ display: "flex", gap: "4px", marginLeft: "8px" }}>
								<button
									onClick={() => onViewDiff(file.uri)}
									title="View Diff"
									style={{
										backgroundColor: "transparent",
										color: "var(--vscode-button-foreground)",
										border: "1px solid var(--vscode-button-border)",
										borderRadius: "3px",
										padding: "2px 6px",
										fontSize: "11px",
										cursor: "pointer",
										minWidth: "50px",
									}}>
									Diff
								</button>
								<button
									onClick={() => onAcceptFile(file.uri)}
									title="Accept changes for this file"
									style={{
										backgroundColor: "var(--vscode-testing-iconPassed)",
										color: "white",
										border: "none",
										borderRadius: "3px",
										padding: "2px 6px",
										fontSize: "11px",
										cursor: "pointer",
										minWidth: "20px",
									}}>
									✓
								</button>
								<button
									onClick={() => onRejectFile(file.uri)}
									title="Reject changes for this file"
									style={{
										backgroundColor: "var(--vscode-testing-iconFailed)",
										color: "white",
										border: "none",
										borderRadius: "3px",
										padding: "2px 6px",
										fontSize: "11px",
										cursor: "pointer",
										minWidth: "20px",
									}}>
									✗
								</button>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	)
}

export default FilesChangedOverview
