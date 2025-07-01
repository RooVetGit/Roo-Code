import React from "react"
import { FileChangeset, FileChange } from "@roo-code/types"
import { useTranslation } from "react-i18next"

interface FilesChangedOverviewProps {
	changeset: FileChangeset
	onViewDiff: (uri: string) => void
	onAcceptFile: (uri: string) => void
	onRejectFile: (uri: string) => void
	onAcceptAll: () => void
	onRejectAll: () => void
}

/**
 * FilesChangedOverview displays a collapsible list of file changes with actions.
 * Features performance optimization with virtualization for large file sets (>50 files).
 *
 * @param changeset - The file changeset containing files and base checkpoint
 * @param onViewDiff - Callback to view diff for a specific file
 * @param onAcceptFile - Callback to accept changes for a specific file
 * @param onRejectFile - Callback to reject changes for a specific file
 * @param onAcceptAll - Callback to accept all file changes
 * @param onRejectAll - Callback to reject all file changes
 */
const FilesChangedOverview: React.FC<FilesChangedOverviewProps> = ({
	changeset,
	onViewDiff,
	onAcceptFile,
	onRejectFile,
	onAcceptAll,
	onRejectAll,
}) => {
	const { t } = useTranslation()
	const files = changeset.files
	const [isCollapsed, setIsCollapsed] = React.useState(true)

	// Performance optimization: Use virtualization for large file lists
	const VIRTUALIZATION_THRESHOLD = 50
	const ITEM_HEIGHT = 60 // Approximate height of each file item
	const MAX_VISIBLE_ITEMS = 10
	const [scrollTop, setScrollTop] = React.useState(0)

	const shouldVirtualize = files.length > VIRTUALIZATION_THRESHOLD

	// Calculate visible items for virtualization
	const visibleItems = React.useMemo(() => {
		if (!shouldVirtualize) return files

		const startIndex = Math.floor(scrollTop / ITEM_HEIGHT)
		const endIndex = Math.min(startIndex + MAX_VISIBLE_ITEMS, files.length)
		return files.slice(startIndex, endIndex).map((file, index) => ({
			...file,
			virtualIndex: startIndex + index,
		}))
	}, [files, scrollTop, shouldVirtualize])

	const totalHeight = shouldVirtualize ? files.length * ITEM_HEIGHT : "auto"
	const offsetY = shouldVirtualize ? Math.floor(scrollTop / ITEM_HEIGHT) * ITEM_HEIGHT : 0

	// Simple double-click prevention
	const [isProcessing, setIsProcessing] = React.useState(false)

	const handleWithDebounce = React.useCallback(
		async (operation: () => void) => {
			if (isProcessing) return
			setIsProcessing(true)
			try {
				operation()
			} catch (_error) {
				// Silently handle any errors to prevent crashing
				// Debug logging removed for production
			}
			// Brief delay to prevent double-clicks
			setTimeout(() => setIsProcessing(false), 300)
		},
		[isProcessing],
	)

	/**
	 * Handles scroll events for virtualization
	 * Updates scrollTop state to calculate visible items
	 */
	const handleScroll = React.useCallback(
		(e: React.UIEvent<HTMLDivElement>) => {
			if (shouldVirtualize) {
				setScrollTop(e.currentTarget.scrollTop)
			}
		},
		[shouldVirtualize],
	)

	/**
	 * Formats line change counts for display based on file type
	 * @param file - The file change to format
	 * @returns Formatted string describing the changes
	 */
	const formatLineChanges = (file: FileChange): string => {
		const added = file.linesAdded || 0
		const removed = file.linesRemoved || 0

		if (file.type === "create") {
			return t("file-changes:line_changes.added", { count: added })
		} else if (file.type === "delete") {
			return t("file-changes:line_changes.deleted")
		} else {
			if (added > 0 && removed > 0) {
				return t("file-changes:line_changes.added_removed", { added, removed })
			} else if (added > 0) {
				return t("file-changes:line_changes.added", { count: added })
			} else if (removed > 0) {
				return t("file-changes:line_changes.removed", { count: removed })
			} else {
				return t("file-changes:line_changes.modified")
			}
		}
	}

	// Memoize expensive total calculations
	const totalChanges = React.useMemo(() => {
		const totalAdded = files.reduce((sum, file) => sum + (file.linesAdded || 0), 0)
		const totalRemoved = files.reduce((sum, file) => sum + (file.linesRemoved || 0), 0)

		const parts = []
		if (totalAdded > 0) parts.push(`+${totalAdded}`)
		if (totalRemoved > 0) parts.push(`-${totalRemoved}`)
		return parts.length > 0 ? ` (${parts.join(", ")})` : ""
	}, [files])

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
				aria-label={t("file-changes:accessibility.files_list", {
					count: files.length,
					state: isCollapsed
						? t("file-changes:accessibility.collapsed")
						: t("file-changes:accessibility.expanded"),
				})}
				title={isCollapsed ? t("file-changes:header.expand") : t("file-changes:header.collapse")}>
				<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
					<span
						className={`codicon ${isCollapsed ? "codicon-chevron-right" : "codicon-chevron-down"}`}
						style={{
							fontSize: "12px",
							transition: "transform 0.2s ease",
						}}
					/>
					<h3 style={{ margin: 0, fontSize: "14px", fontWeight: "bold" }}>
						{t("file-changes:summary.count_with_changes", {
							count: files.length,
							changes: totalChanges,
						})}
					</h3>
				</div>

				{/* Action buttons always visible for quick access */}
				<div
					style={{ display: "flex", gap: "8px" }}
					onClick={(e) => e.stopPropagation()} // Prevent collapse toggle when clicking buttons
				>
					<button
						onClick={() => handleWithDebounce(onRejectAll)}
						disabled={isProcessing}
						tabIndex={0}
						style={{
							backgroundColor: "var(--vscode-button-secondaryBackground)",
							color: "var(--vscode-button-secondaryForeground)",
							border: "none",
							borderRadius: "3px",
							padding: "4px 8px",
							fontSize: "12px",
							cursor: isProcessing ? "not-allowed" : "pointer",
							opacity: isProcessing ? 0.6 : 1,
						}}
						title={t("file-changes:actions.reject_all")}>
						{t("file-changes:actions.reject_all")}
					</button>
					<button
						onClick={() => handleWithDebounce(onAcceptAll)}
						disabled={isProcessing}
						tabIndex={0}
						style={{
							backgroundColor: "var(--vscode-button-background)",
							color: "var(--vscode-button-foreground)",
							border: "none",
							borderRadius: "3px",
							padding: "4px 8px",
							fontSize: "12px",
							cursor: isProcessing ? "not-allowed" : "pointer",
							opacity: isProcessing ? 0.6 : 1,
						}}
						title={t("file-changes:actions.accept_all")}>
						{t("file-changes:actions.accept_all")}
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
						position: "relative",
					}}
					onScroll={handleScroll}>
					{shouldVirtualize && (
						<div style={{ height: totalHeight, position: "relative" }}>
							<div style={{ transform: `translateY(${offsetY}px)` }}>
								{visibleItems.map((file: any) => (
									<FileItem
										key={file.uri}
										file={file}
										formatLineChanges={formatLineChanges}
										onViewDiff={onViewDiff}
										onAcceptFile={onAcceptFile}
										onRejectFile={onRejectFile}
										handleWithDebounce={handleWithDebounce}
										isProcessing={isProcessing}
										t={t}
									/>
								))}
							</div>
						</div>
					)}
					{!shouldVirtualize &&
						files.map((file: FileChange) => (
							<FileItem
								key={file.uri}
								file={file}
								formatLineChanges={formatLineChanges}
								onViewDiff={onViewDiff}
								onAcceptFile={onAcceptFile}
								onRejectFile={onRejectFile}
								handleWithDebounce={handleWithDebounce}
								isProcessing={isProcessing}
								t={t}
							/>
						))}
				</div>
			)}
		</div>
	)
}

/**
 * Props for the FileItem component
 */
interface FileItemProps {
	/** File change data */
	file: FileChange
	/** Function to format line change counts for display */
	formatLineChanges: (file: FileChange) => string
	/** Callback to view diff for the file */
	onViewDiff: (uri: string) => void
	/** Callback to accept changes for the file */
	onAcceptFile: (uri: string) => void
	/** Callback to reject changes for the file */
	onRejectFile: (uri: string) => void
	/** Debounced handler to prevent double-clicks */
	handleWithDebounce: (operation: () => void) => void
	/** Whether operations are currently being processed */
	isProcessing: boolean
	/** Translation function */
	t: (key: string, options?: Record<string, any>) => string
}

/**
 * FileItem renders a single file change with action buttons.
 * Used for both virtualized and non-virtualized rendering.
 * Memoized for performance optimization.
 */
const FileItem: React.FC<FileItemProps> = React.memo(
	({ file, formatLineChanges, onViewDiff, onAcceptFile, onRejectFile, handleWithDebounce, isProcessing, t }) => (
		<div
			data-testid={`file-item-${file.uri}`}
			style={{
				display: "flex",
				justifyContent: "space-between",
				alignItems: "center",
				padding: "6px 8px",
				marginBottom: "4px",
				backgroundColor: "var(--vscode-list-hoverBackground)",
				borderRadius: "3px",
				fontSize: "13px",
				minHeight: "60px", // Consistent height for virtualization
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
					{t(`file-changes:file_types.${file.type}`)} • {formatLineChanges(file)}
				</div>
			</div>

			<div style={{ display: "flex", gap: "4px", marginLeft: "8px" }}>
				<button
					onClick={() => handleWithDebounce(() => onViewDiff(file.uri))}
					disabled={isProcessing}
					title={t("file-changes:actions.view_diff")}
					data-testid={`diff-${file.uri}`}
					style={{
						backgroundColor: "transparent",
						color: "var(--vscode-button-foreground)",
						border: "1px solid var(--vscode-button-border)",
						borderRadius: "3px",
						padding: "2px 6px",
						fontSize: "11px",
						cursor: isProcessing ? "not-allowed" : "pointer",
						minWidth: "50px",
						opacity: isProcessing ? 0.6 : 1,
					}}>
					{t("file-changes:actions.view_diff")}
				</button>
				<button
					onClick={() => handleWithDebounce(() => onRejectFile(file.uri))}
					disabled={isProcessing}
					title={t("file-changes:actions.reject_file")}
					data-testid={`reject-${file.uri}`}
					style={{
						backgroundColor: "var(--vscode-button-secondaryBackground)",
						color: "var(--vscode-button-secondaryForeground)",
						border: "1px solid var(--vscode-button-border)",
						borderRadius: "3px",
						padding: "2px 6px",
						fontSize: "11px",
						cursor: isProcessing ? "not-allowed" : "pointer",
						minWidth: "20px",
						opacity: isProcessing ? 0.6 : 1,
					}}>
					✗
				</button>
				<button
					onClick={() => handleWithDebounce(() => onAcceptFile(file.uri))}
					disabled={isProcessing}
					title={t("file-changes:actions.accept_file")}
					data-testid={`accept-${file.uri}`}
					style={{
						backgroundColor: "var(--vscode-button-background)",
						color: "var(--vscode-button-foreground)",
						border: "1px solid var(--vscode-button-border)",
						borderRadius: "3px",
						padding: "2px 6px",
						fontSize: "11px",
						cursor: isProcessing ? "not-allowed" : "pointer",
						minWidth: "20px",
						opacity: isProcessing ? 0.6 : 1,
					}}>
					✓
				</button>
			</div>
		</div>
	),
)

FileItem.displayName = "FileItem"

export default FilesChangedOverview
