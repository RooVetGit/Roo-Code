import React, { memo, useState } from "react"
import { DeleteTaskDialog } from "./DeleteTaskDialog"
import { BatchDeleteTaskDialog } from "./BatchDeleteTaskDialog"
import prettyBytes from "pretty-bytes"
import { Virtuoso } from "react-virtuoso"
import { VSCodeTextField, VSCodeRadioGroup, VSCodeRadio } from "@vscode/webview-ui-toolkit/react"

import { vscode } from "@/utils/vscode"
import { formatLargeNumber, formatDate } from "@/utils/format"
import { cn } from "@/lib/utils"
import { Button, Checkbox } from "@/components/ui"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { ClineMessage } from "@roo/shared/ExtensionMessage" // Added for explicit type

import { Tab, TabContent, TabHeader } from "../common/Tab"
import { useTaskSearch, HierarchicalHistoryItem } from "./useTaskSearch"
import { ExportButton } from "./ExportButton"
import { CopyButton } from "./CopyButton"

type HistoryViewProps = {
	onDone: () => void
}

type SortOption = "newest" | "oldest" | "mostExpensive" | "mostTokens" | "mostRelevant"

// Props for the new TaskItemHeader component
interface TaskItemHeaderProps {
	item: HierarchicalHistoryItem
	isSelectionMode: boolean
	t: (key: string, options?: any) => string
	setDeleteTaskId: (taskId: string | null) => void
	isOpen?: boolean // For chevron icon state
	onToggleOpen?: () => void // For chevron click
	onToggleBulkExpand?: () => void // Changed from onExpandAllChildren
	isBulkExpanding?: boolean // To control the toggle button's state
}

// New TaskItemHeader component
const TaskItemHeader: React.FC<TaskItemHeaderProps> = ({
	item,
	isSelectionMode,
	t,
	setDeleteTaskId,
	isOpen,
	onToggleOpen,
	onToggleBulkExpand, // Changed
	isBulkExpanding, // Added
}) => {
	// Standardized icon style
	const metadataIconStyle: React.CSSProperties = {
		// Renamed for clarity
		fontSize: "12px", // Reverted for metadata icons
		color: "var(--vscode-descriptionForeground)",
		verticalAlign: "middle",
	}
	const metadataIconWithTextAdjustStyle: React.CSSProperties = { ...metadataIconStyle, marginBottom: "-2px" }

	const actionIconStyle: React.CSSProperties = {
		// For action buttons like trash
		fontSize: "16px", // To match Copy/Export button icon sizes
		color: "var(--vscode-descriptionForeground)",
		verticalAlign: "middle",
	}

	return (
		<div className="flex justify-between items-center pb-0">
			{" "}
			{/* Added pb-0 */}
			<div className="flex items-center flex-wrap gap-x-2 text-xs">
				{" "}
				{/* Increased gap-x-1 to gap-x-2 */} {/* Reduced gap-x-1.5 to gap-x-1 */}
				{item.children && item.children.length > 0 && (
					<>
						<span
							className={cn(
								"codicon",
								isOpen ? "codicon-chevron-down" : "codicon-chevron-right",
								"cursor-pointer",
							)}
							style={metadataIconStyle} // Use metadataIconStyle
							onClick={(e) => {
								e.stopPropagation()
								onToggleOpen?.()
							}}
						/>
						{/* Expand all children icon is moved to the right action button group */}
					</>
				)}
				<span className="text-vscode-descriptionForeground font-medium text-sm uppercase">
					{formatDate(item.ts)}
				</span>
				{/* Tokens Info */}
				{(item.tokensIn || item.tokensOut) && (
					<span className="text-vscode-descriptionForeground flex items-center gap-px">
						<i className="codicon codicon-arrow-up" style={metadataIconWithTextAdjustStyle} />
						{formatLargeNumber(item.tokensIn || 0)}
						<i className="codicon codicon-arrow-down" style={metadataIconWithTextAdjustStyle} />
						{formatLargeNumber(item.tokensOut || 0)}
					</span>
				)}
				{/* Cost Info */}
				{!!item.totalCost && (
					<span className="text-vscode-descriptionForeground">${item.totalCost.toFixed(4)}</span>
				)}
				{/* Cache Info */}
				{!!item.cacheWrites && (
					<span className="text-vscode-descriptionForeground flex items-center gap-px">
						<i className="codicon codicon-database" style={metadataIconWithTextAdjustStyle} />
						{formatLargeNumber(item.cacheWrites || 0)}
						<i className="codicon codicon-arrow-right" style={metadataIconWithTextAdjustStyle} />
						{formatLargeNumber(item.cacheReads || 0)}
					</span>
				)}
				{/* Size Info */}
				{item.size && <span className="text-vscode-descriptionForeground">{prettyBytes(item.size)}</span>}
			</div>
			{/* Action Buttons */}
			{!isSelectionMode && (
				<div className="flex flex-row gap-0 items-center">
					{" "}
					{/* Reduced gap-1 to gap-0 */}
					{item.children && item.children.length > 0 && (
						<Button
							variant="ghost"
							size="icon"
							className="opacity-50 hover:opacity-100"
							title={
								isBulkExpanding
									? t("history:collapseAllChildren", "Collapse all")
									: t("history:expandAllChildren", "Expand all")
							}
							onClick={(e) => {
								e.stopPropagation()
								onToggleBulkExpand?.()
							}}
							data-testid="toggle-bulk-expand-button">
							<span
								className="codicon codicon-list-tree" // Always use codicon-list-tree
								style={actionIconStyle}
							/>
						</Button>
					)}
					<CopyButton itemTask={item.task} className="opacity-50 hover:opacity-100" />
					<ExportButton itemId={item.id} className="opacity-50 hover:opacity-100" />
					<Button
						variant="ghost"
						size="icon" // Changed from sm to icon
						className="opacity-50 hover:opacity-100"
						title={t("history:deleteTaskTitle")}
						data-testid="delete-task-button"
						onClick={(e) => {
							e.stopPropagation()
							if (e.shiftKey) {
								vscode.postMessage({ type: "deleteTaskWithId", text: item.id })
							} else {
								setDeleteTaskId(item.id)
							}
						}}>
						<span className="codicon codicon-trash" style={actionIconStyle} /> {/* Use actionIconStyle */}
					</Button>
				</div>
			)}
		</div>
	)
}

// Define TaskDisplayItem component
interface TaskDisplayItemProps {
	item: HierarchicalHistoryItem
	level: number
	isSelectionMode: boolean
	selectedTaskIds: string[]
	toggleTaskSelection: (taskId: string, isSelected: boolean) => void
	onTaskClick: (taskId: string) => void
	setDeleteTaskId: (taskId: string | null) => void
	showAllWorkspaces: boolean
	t: (key: string, options?: any) => string
	currentTaskMessages: ClineMessage[] | undefined
	currentTaskId: string | undefined
	// Props for hoisted state
	isExpanded: boolean
	isBulkExpanded: boolean
	onToggleExpansion: (taskId: string) => void
	onToggleBulkExpansion: (taskId: string) => void
	// Pass down the maps for children to use
	expandedItems: Record<string, boolean>
	bulkExpandedRootItems: Record<string, boolean>
}

// explicit signals BULK_EXPAND_SIGNAL and BULK_COLLAPSE_SIGNAL are no longer needed here
// as the logic is handled by the hoisted state and callbacks.

const TaskDisplayItem: React.FC<TaskDisplayItemProps> = memo(
	({
		item,
		level,
		isSelectionMode,
		selectedTaskIds,
		toggleTaskSelection,
		onTaskClick,
		setDeleteTaskId,
		showAllWorkspaces,
		t,
		currentTaskMessages,
		currentTaskId,
		// Hoisted state props
		isExpanded,
		isBulkExpanded,
		onToggleExpansion,
		onToggleBulkExpansion,
		// Destructure the maps
		expandedItems,
		bulkExpandedRootItems,
	}) => {
		// Local state for isOpen, expandAllSignalForChildren, isBulkExpandingChildrenState, and useEffect are removed.
		// Expansion state is now controlled by `isExpanded` and `isBulkExpanded` props.

		// Use the completed flag directly from the item
		const isTaskMarkedCompleted = item.completed ?? false

		// taskMeta is no longer needed.

		const taskPrimaryContent = (
			<div
				className={cn("flex items-start gap-2", {
					"pt-0.5 pb-0.5 px-3": true, // Reduced top/bottom padding to 0.125rem for all levels
				})}
				style={{ marginLeft: level * 20 }} // Reverted to inline style for reliable indentation
			>
				{isSelectionMode && (
					<div
						className="task-checkbox mt-1"
						onClick={(e) => {
							e.stopPropagation()
						}}>
						<Checkbox
							checked={selectedTaskIds.includes(item.id)}
							onCheckedChange={(checked) => toggleTaskSelection(item.id, checked === true)}
							variant="description"
						/>
					</div>
				)}
				<div className="flex flex-col flex-1 gap-0">
					{" "}
					{/* Ensure no gap between header and content */}
					<TaskItemHeader
						item={item}
						isSelectionMode={isSelectionMode}
						t={t}
						setDeleteTaskId={setDeleteTaskId}
						isOpen={isExpanded} // Use hoisted state
						onToggleOpen={() => onToggleExpansion(item.id)} // Call hoisted function
						onToggleBulkExpand={() => onToggleBulkExpansion(item.id)} // Call hoisted function
						isBulkExpanding={isBulkExpanded} // Use hoisted state
					/>
					<div
						className="mt-0" // Removed margin top for separation from header
						style={{
							fontSize: "var(--vscode-font-size)",
							color: isTaskMarkedCompleted
								? "var(--vscode-testing-iconPassed)"
								: "var(--vscode-foreground)",
							display: "-webkit-box",
							WebkitLineClamp: 3,
							WebkitBoxOrient: "vertical",
							overflow: "hidden",
							whiteSpace: "pre-wrap",
							wordBreak: "break-word",
							overflowWrap: "anywhere",
						}}
						data-testid="task-content"
						dangerouslySetInnerHTML={{ __html: item.task }}
					/>
					{showAllWorkspaces && item.workspace && (
						<div className="flex flex-row gap-1 text-vscode-descriptionForeground text-xs mt-1">
							<span className="codicon codicon-folder scale-80" />
							<span>{item.workspace}</span>
						</div>
					)}
				</div>
			</div>
		)

		if (item.children && item.children.length > 0) {
			return (
				<>
					{/* Use isExpanded for open state; onOpenChange calls the hoisted toggle function */}
					<Collapsible open={isExpanded} onOpenChange={() => onToggleExpansion(item.id)}>
						<CollapsibleTrigger
							asChild
							onClick={() => {
								if (!isSelectionMode) onTaskClick(item.id)
							}}>
							<div>{taskPrimaryContent}</div>
						</CollapsibleTrigger>
						<CollapsibleContent>
							{item.children.map((child) => (
								<TaskDisplayItem
									key={child.id} // Key can remain simple if props handle re-render logic
									item={child}
									level={level + 1}
									isSelectionMode={isSelectionMode}
									selectedTaskIds={selectedTaskIds}
									toggleTaskSelection={toggleTaskSelection}
									onTaskClick={onTaskClick}
									setDeleteTaskId={setDeleteTaskId}
									showAllWorkspaces={showAllWorkspaces}
									t={t}
									currentTaskMessages={currentTaskMessages}
									currentTaskId={currentTaskId}
									// Pass down hoisted state and handlers
									isExpanded={expandedItems[child.id] ?? false} // Use the passed down map
									isBulkExpanded={bulkExpandedRootItems[child.id] ?? false} // Use the passed down map
									onToggleExpansion={onToggleExpansion}
									onToggleBulkExpansion={onToggleBulkExpansion}
									// Crucially, pass the maps themselves down for further nesting
									expandedItems={expandedItems}
									bulkExpandedRootItems={bulkExpandedRootItems}
								/>
							))}
						</CollapsibleContent>
					</Collapsible>
					{/* {taskMeta} no longer exists */}
				</>
			)
		}

		return (
			<>
				<div
					onClick={() => {
						if (isSelectionMode) {
							toggleTaskSelection(item.id, !selectedTaskIds.includes(item.id))
						} else {
							onTaskClick(item.id)
						}
					}}>
					{taskPrimaryContent}
				</div>
				{/* {!item.children?.length && taskMeta} no longer exists */}
			</>
		)
	},
)

const HistoryView = ({ onDone }: HistoryViewProps) => {
	const {
		tasks,
		searchQuery,
		setSearchQuery,
		sortOption,
		setSortOption,
		setLastNonRelevantSort,
		showAllWorkspaces,
		setShowAllWorkspaces,
		expandedItems, // Destructured from useTaskSearch
		bulkExpandedRootItems, // Destructured from useTaskSearch
		toggleItemExpansion, // Destructured from useTaskSearch
		toggleBulkItemExpansion, // Destructured from useTaskSearch
	} = useTaskSearch()
	const { t } = useAppTranslation()
	// Destructure clineMessages and currentTaskItem (which contains the active task's ID)
	const { clineMessages, currentTaskItem } = useExtensionState()

	const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null)
	const [isSelectionMode, setIsSelectionMode] = useState(false)
	const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
	const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState<boolean>(false)

	// Toggle selection mode
	const toggleSelectionMode = () => {
		setIsSelectionMode(!isSelectionMode)
		if (isSelectionMode) {
			setSelectedTaskIds([])
		}
	}

	// Toggle selection for a single task
	const toggleTaskSelection = (taskId: string, isSelected: boolean) => {
		if (isSelected) {
			setSelectedTaskIds((prev) => [...prev, taskId])
		} else {
			setSelectedTaskIds((prev) => prev.filter((id) => id !== taskId))
		}
	}

	// Toggle select all tasks
	const toggleSelectAll = (selectAll: boolean) => {
		if (selectAll) {
			setSelectedTaskIds(tasks.map((task) => task.id))
		} else {
			setSelectedTaskIds([])
		}
	}

	// Handle batch delete button click
	const handleBatchDelete = () => {
		if (selectedTaskIds.length > 0) {
			setShowBatchDeleteDialog(true)
		}
	}

	return (
		<Tab>
			<TabHeader className="flex flex-col gap-2">
				<div className="flex justify-between items-center">
					<h3 className="text-vscode-foreground m-0">{t("history:history")}</h3>
					<div className="flex gap-2">
						<Button
							variant={isSelectionMode ? "default" : "secondary"}
							onClick={toggleSelectionMode}
							data-testid="toggle-selection-mode-button"
							title={
								isSelectionMode
									? `${t("history:exitSelectionMode")}`
									: `${t("history:enterSelectionMode")}`
							}>
							<span
								className={`codicon ${isSelectionMode ? "codicon-check-all" : "codicon-checklist"} mr-1`}
							/>
							{isSelectionMode ? t("history:exitSelection") : t("history:selectionMode")}
						</Button>
						<Button onClick={onDone}>{t("history:done")}</Button>
					</div>
				</div>
				<div className="flex flex-col gap-2">
					<VSCodeTextField
						style={{ width: "100%" }} // Ensure VSCodeTextField is typed correctly
						placeholder={t("history:searchPlaceholder")}
						value={searchQuery}
						data-testid="history-search-input"
						onInput={(e) => {
							const newValue = (e.target as HTMLInputElement)?.value
							setSearchQuery(newValue)
							if (newValue && !searchQuery && sortOption !== "mostRelevant") {
								setLastNonRelevantSort(sortOption)
								setSortOption("mostRelevant")
							}
						}}>
						<div
							slot="start"
							className="codicon codicon-search"
							style={{ fontSize: 13, marginTop: 2.5, opacity: 0.8 }}
						/>
						{searchQuery && (
							<div
								className="input-icon-button codicon codicon-close"
								aria-label="Clear search"
								onClick={() => setSearchQuery("")}
								slot="end"
								style={{
									display: "flex",
									justifyContent: "center",
									alignItems: "center",
									height: "100%",
								}}
							/>
						)}
					</VSCodeTextField>
					<VSCodeRadioGroup
						style={{ display: "flex", flexWrap: "wrap" }}
						value={sortOption}
						role="radiogroup"
						onChange={(e) => setSortOption((e.target as HTMLInputElement).value as SortOption)}>
						<VSCodeRadio value="newest" data-testid="radio-newest">
							{t("history:newest")}
						</VSCodeRadio>
						<VSCodeRadio value="oldest" data-testid="radio-oldest">
							{t("history:oldest")}
						</VSCodeRadio>
						<VSCodeRadio value="mostExpensive" data-testid="radio-most-expensive">
							{t("history:mostExpensive")}
						</VSCodeRadio>
						<VSCodeRadio value="mostTokens" data-testid="radio-most-tokens">
							{t("history:mostTokens")}
						</VSCodeRadio>
						<VSCodeRadio
							value="mostRelevant"
							disabled={!searchQuery}
							data-testid="radio-most-relevant"
							style={{ opacity: searchQuery ? 1 : 0.5 }}>
							{t("history:mostRelevant")}
						</VSCodeRadio>
					</VSCodeRadioGroup>

					<div className="flex items-center gap-2">
						<Checkbox
							id="show-all-workspaces-view"
							checked={showAllWorkspaces}
							onCheckedChange={(checked) => setShowAllWorkspaces(checked === true)}
							variant="description"
						/>
						<label htmlFor="show-all-workspaces-view" className="text-vscode-foreground cursor-pointer">
							{t("history:showAllWorkspaces")}
						</label>
					</div>

					{/* Select all control in selection mode */}
					{isSelectionMode && tasks.length > 0 && (
						<div className="flex items-center py-1">
							<div className="flex items-center gap-2">
								<Checkbox
									checked={tasks.length > 0 && selectedTaskIds.length === tasks.length}
									onCheckedChange={(checked) => toggleSelectAll(checked === true)}
									variant="description"
								/>
								<span className="text-vscode-foreground">
									{selectedTaskIds.length === tasks.length
										? t("history:deselectAll")
										: t("history:selectAll")}
								</span>
								<span className="ml-auto text-vscode-descriptionForeground text-xs">
									{t("history:selectedItems", {
										selected: selectedTaskIds.length,
										total: tasks.length,
									})}
								</span>
							</div>
						</div>
					)}
				</div>
			</TabHeader>

			<TabContent className="p-0">
				<Virtuoso
					style={{
						flexGrow: 1,
						overflowY: "scroll",
					}}
					data={tasks as HierarchicalHistoryItem[]}
					data-testid="virtuoso-container"
					initialTopMostItemIndex={0}
					components={{
						List: React.forwardRef((props, ref) => (
							<div {...props} ref={ref as React.Ref<HTMLDivElement>} data-testid="virtuoso-item-list" />
						)),
					}}
					itemContent={(index, item: HierarchicalHistoryItem) => (
						<div
							className={cn({
								// Removed data-testid and key from here as TaskDisplayItem will handle it
								"border-b border-vscode-panel-border": index < tasks.length - 1,
								"bg-vscode-list-activeSelectionBackground":
									isSelectionMode && selectedTaskIds.includes(item.id),
							})}>
							<TaskDisplayItem
								key={item.id} // Added key here
								item={item}
								level={0}
								isSelectionMode={isSelectionMode}
								selectedTaskIds={selectedTaskIds}
								toggleTaskSelection={toggleTaskSelection}
								onTaskClick={(taskId) => vscode.postMessage({ type: "showTaskWithId", text: taskId })}
								setDeleteTaskId={setDeleteTaskId}
								showAllWorkspaces={showAllWorkspaces}
								t={t}
								currentTaskMessages={clineMessages}
								currentTaskId={currentTaskItem?.id}
								// Pass hoisted state and handlers
								isExpanded={expandedItems[item.id] ?? false}
								isBulkExpanded={bulkExpandedRootItems[item.id] ?? false}
								onToggleExpansion={toggleItemExpansion}
								onToggleBulkExpansion={toggleBulkItemExpansion}
								// Pass the maps to the top-level TaskDisplayItems
								expandedItems={expandedItems}
								bulkExpandedRootItems={bulkExpandedRootItems}
							/>
						</div>
					)}
				/>
			</TabContent>

			{/* Fixed action bar at bottom - only shown in selection mode with selected items */}
			{isSelectionMode &&
				selectedTaskIds.length > 0 &&
				!currentTaskItem && ( // Hide if preview is open
					<div className="fixed bottom-0 left-0 right-0 bg-vscode-editor-background border-t border-vscode-panel-border p-2 flex justify-between items-center">
						<div className="text-vscode-foreground">
							{t("history:selectedItems", { selected: selectedTaskIds.length, total: tasks.length })}
						</div>
						<div className="flex gap-2">
							<Button variant="secondary" onClick={() => setSelectedTaskIds([])}>
								{t("history:clearSelection")}
							</Button>
							<Button variant="default" onClick={handleBatchDelete}>
								{t("history:deleteSelected")}
							</Button>
						</div>
					</div>
				)}

			{/* Delete dialog */}
			{deleteTaskId && (
				<DeleteTaskDialog taskId={deleteTaskId} onOpenChange={(open) => !open && setDeleteTaskId(null)} open />
			)}

			{/* Batch delete dialog */}
			{showBatchDeleteDialog && (
				<BatchDeleteTaskDialog
					taskIds={selectedTaskIds}
					open={showBatchDeleteDialog}
					onOpenChange={(open) => {
						if (!open) {
							setShowBatchDeleteDialog(false)
							setSelectedTaskIds([])
							setIsSelectionMode(false)
						}
					}}
				/>
			)}
		</Tab>
	)
}

export default memo(HistoryView)
