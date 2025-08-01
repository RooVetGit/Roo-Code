import React from "react"
import { FileChangeset, FileChange } from "@roo-code/types"
import { useTranslation } from "react-i18next"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { vscode } from "@/utils/vscode"
import { useDebounce } from "@/hooks/useDebounce"
import styles from "./FilesChangedOverview.module.css"

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface FilesChangedOverviewProps {}

/**
 * FilesChangedOverview is a self-managing component that listens for checkpoint events
 * and displays file changes. It manages its own state and communicates with the backend
 * through VS Code message passing.
 */
const FilesChangedOverview: React.FC<FilesChangedOverviewProps> = () => {
	const { t } = useTranslation()
	const { filesChangedEnabled } = useExtensionState()

	// Self-managed state
	const [changeset, setChangeset] = React.useState<FileChangeset | null>(null)
	const [isInitialized, setIsInitialized] = React.useState(false)

	const files = React.useMemo(() => changeset?.files || [], [changeset?.files])
	const [isCollapsed, setIsCollapsed] = React.useState(true)

	// Performance optimization: Use virtualization for large file lists
	const VIRTUALIZATION_THRESHOLD = 50
	const ITEM_HEIGHT = 32 // Approximate height of each file item
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

	// Debounced operations to prevent double-clicks
	const { isProcessing, handleWithDebounce } = useDebounce(300)

	// FCO initialization logic
	const checkInit = React.useCallback(() => {
		if (!isInitialized) {
			setIsInitialized(true)
		}
	}, [isInitialized])

	// Update changeset - backend handles filtering, no local filtering needed
	const updateChangeset = React.useCallback((newChangeset: FileChangeset) => {
		setChangeset(newChangeset)
	}, [])

	// Handle checkpoint creation
	const handleCheckpointCreated = React.useCallback(() => {
		if (!isInitialized) {
			checkInit()
		}
		// Note: Backend automatically sends file changes during checkpoint creation
		// No need to request them here - just wait for the filesChanged message
	}, [isInitialized, checkInit])

	// Handle checkpoint restoration with the 4 examples logic
	const handleCheckpointRestored = React.useCallback(() => {
		// Request file changes after checkpoint restore
		// Backend should calculate changes from initial baseline to restored checkpoint
		vscode.postMessage({ type: "filesChangedRequest" })
	}, [])

	// Action handlers
	const handleViewDiff = React.useCallback((uri: string) => {
		vscode.postMessage({ type: "viewDiff", uri })
	}, [])

	const handleAcceptFile = React.useCallback((uri: string) => {
		vscode.postMessage({ type: "acceptFileChange", uri })
		// Backend will send updated filesChanged message with filtered results
	}, [])

	const handleRejectFile = React.useCallback((uri: string) => {
		vscode.postMessage({ type: "rejectFileChange", uri })
		// Backend will send updated filesChanged message with filtered results
	}, [])

	const handleAcceptAll = React.useCallback(() => {
		vscode.postMessage({ type: "acceptAllFileChanges" })
		// Backend will send updated filesChanged message with filtered results
	}, [])

	const handleRejectAll = React.useCallback(() => {
		const visibleUris = files.map((file) => file.uri)
		vscode.postMessage({ type: "rejectAllFileChanges", uris: visibleUris })
		// Backend will send updated filesChanged message with filtered results
	}, [files])

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

	// Listen for filesChanged messages from the backend
	React.useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data

			// Guard against null/undefined/malformed messages
			if (!message || typeof message !== "object" || !message.type) {
				return
			}

			switch (message.type) {
				case "filesChanged":
					if (message.filesChanged) {
						checkInit()
						updateChangeset(message.filesChanged)
					} else {
						// Clear the changeset
						setChangeset(null)
					}
					break
				case "checkpointCreated":
					handleCheckpointCreated()
					break
				case "checkpointRestored":
					handleCheckpointRestored()
					break
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [checkInit, updateChangeset, handleCheckpointCreated, handleCheckpointRestored])

	// Track previous filesChangedEnabled state to detect enable events
	const prevFilesChangedEnabledRef = React.useRef<boolean>(filesChangedEnabled)

	// Detect when FCO is enabled mid-task and request fresh file changes
	React.useEffect(() => {
		const prevEnabled = prevFilesChangedEnabledRef.current
		const currentEnabled = filesChangedEnabled

		// Update ref for next comparison
		prevFilesChangedEnabledRef.current = currentEnabled

		// Detect enable event (transition from false to true)
		if (!prevEnabled && currentEnabled) {
			// FCO was just enabled - request fresh file changes from backend
			// Backend will handle baseline reset and send appropriate files
			vscode.postMessage({ type: "filesChangedRequest" })
		}
	}, [filesChangedEnabled])

	/**
	 * Formats line change counts for display - shows only plus/minus numbers
	 * @param file - The file change to format
	 * @returns Formatted string with just the line change counts
	 */
	const formatLineChanges = (file: FileChange): string => {
		const added = file.linesAdded || 0
		const removed = file.linesRemoved || 0

		const parts = []
		if (added > 0) parts.push(`+${added}`)
		if (removed > 0) parts.push(`-${removed}`)

		return parts.length > 0 ? parts.join(", ") : ""
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

	// Don't render if the feature is disabled or no changes to show
	if (!filesChangedEnabled || !changeset || files.length === 0) {
		return null
	}

	return (
		<div className={styles.filesChangedOverview} data-testid="files-changed-overview">
			{/* Collapsible header */}
			<div
				className={`${styles.header} ${!isCollapsed ? styles.headerExpanded : ""}`}
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
				<div className={styles.headerContent}>
					<span
						className={`codicon ${isCollapsed ? "codicon-chevron-right" : "codicon-chevron-down"} ${styles.chevronIcon}`}
					/>
					<h3 className={styles.headerTitle} data-testid="files-changed-header">
						{t("file-changes:summary.count_with_changes", {
							count: files.length,
							changes: totalChanges,
						})}
					</h3>
				</div>

				{/* Action buttons always visible for quick access */}
				<div
					className={styles.actionButtons}
					onClick={(e) => e.stopPropagation()} // Prevent collapse toggle when clicking buttons
				>
					<button
						onClick={() => handleWithDebounce(handleRejectAll)}
						disabled={isProcessing}
						tabIndex={0}
						data-testid="reject-all-button"
						className={`${styles.actionButton} ${styles.rejectAllButton}`}
						title={t("file-changes:actions.reject_all")}>
						{t("file-changes:actions.reject_all")}
					</button>
					<button
						onClick={() => handleWithDebounce(handleAcceptAll)}
						disabled={isProcessing}
						tabIndex={0}
						data-testid="accept-all-button"
						className={`${styles.actionButton} ${styles.acceptAllButton}`}
						title={t("file-changes:actions.accept_all")}>
						{t("file-changes:actions.accept_all")}
					</button>
				</div>
			</div>

			{/* Collapsible content area */}
			{!isCollapsed && (
				<div className={styles.contentArea} style={{ opacity: isCollapsed ? 0 : 1 }} onScroll={handleScroll}>
					{shouldVirtualize && (
						<div className={styles.virtualContainer} style={{ height: totalHeight }}>
							<div className={styles.virtualContent} style={{ transform: `translateY(${offsetY}px)` }}>
								{visibleItems.map((file: any) => (
									<FileItem
										key={file.uri}
										file={file}
										formatLineChanges={formatLineChanges}
										onViewDiff={handleViewDiff}
										onAcceptFile={handleAcceptFile}
										onRejectFile={handleRejectFile}
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
								onViewDiff={handleViewDiff}
								onAcceptFile={handleAcceptFile}
								onRejectFile={handleRejectFile}
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
		<div data-testid={`file-item-${file.uri}`} className={styles.fileItem}>
			<div className={styles.fileInfo}>
				<div className={styles.fileName}>{file.uri}</div>
			</div>

			<div className={styles.fileActions}>
				<div className={styles.lineChanges}>{formatLineChanges(file)}</div>
				<div className={styles.fileButtons}>
					<button
						onClick={() => handleWithDebounce(() => onViewDiff(file.uri))}
						disabled={isProcessing}
						title={t("file-changes:actions.view_diff")}
						data-testid={`diff-${file.uri}`}
						className={`${styles.fileButton} ${styles.diffButton}`}>
						{t("file-changes:actions.view_diff")}
					</button>
					<button
						onClick={() => handleWithDebounce(() => onRejectFile(file.uri))}
						disabled={isProcessing}
						title={t("file-changes:actions.reject_file")}
						data-testid={`reject-${file.uri}`}
						className={`${styles.fileButton} ${styles.rejectButton}`}>
						✗
					</button>
					<button
						onClick={() => handleWithDebounce(() => onAcceptFile(file.uri))}
						disabled={isProcessing}
						title={t("file-changes:actions.accept_file")}
						data-testid={`accept-${file.uri}`}
						className={`${styles.fileButton} ${styles.acceptButton}`}>
						✓
					</button>
				</div>
			</div>
		</div>
	),
)

FileItem.displayName = "FileItem"

export default FilesChangedOverview
