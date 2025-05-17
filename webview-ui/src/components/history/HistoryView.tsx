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
	onExpandAllChildren?: () => void // Renamed for clarity
}

// New TaskItemHeader component
const TaskItemHeader: React.FC<TaskItemHeaderProps> = ({
	item,
	isSelectionMode,
	t,
	setDeleteTaskId,
	isOpen,
	onToggleOpen,
	onExpandAllChildren, // Renamed
}) => {
	const iconStyle: React.CSSProperties = {
		fontSize: "11px",
		fontWeight: "bold",
		color: "var(--vscode-descriptionForeground)",
	}
	const iconStyleWithMargin: React.CSSProperties = { ...iconStyle, marginBottom: "-1.5px" } // Adjusted margin for better alignment

	return (
		<div className="flex justify-between items-center">
			<div className="flex items-center flex-wrap gap-x-1.5 text-xs">
				{" "}
				{/* Reduced gap-x-2 to gap-x-1.5 */}
				{item.children && item.children.length > 0 && (
					<>
						<span
							className={cn(
								"codicon",
								isOpen ? "codicon-chevron-down" : "codicon-chevron-right",
								"cursor-pointer",
							)}
							style={iconStyle}
							onClick={(e) => {
								e.stopPropagation()
								onToggleOpen?.()
							}}
						/>
						<span
							className="codicon codicon-fold-down cursor-pointer"
							style={iconStyle}
							title={t("history:expandAllChildren")} // Updated title
							onClick={(e) => {
								e.stopPropagation()
								onExpandAllChildren?.() // Renamed
							}}
						/>
					</>
				)}
				<span className="text-vscode-descriptionForeground font-medium text-sm uppercase">
					{formatDate(item.ts)}
				</span>
				{/* Tokens Info */}
				{(item.tokensIn || item.tokensOut) && (
					<span className="text-vscode-descriptionForeground flex items-center gap-px">
						<i className="codicon codicon-arrow-up" style={iconStyleWithMargin} />
						{formatLargeNumber(item.tokensIn || 0)}
						<i className="codicon codicon-arrow-down ml-0.5" style={iconStyleWithMargin} />{" "}
						{/* Reduced ml-1 to ml-0.5 */}
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
						<i className="codicon codicon-database" style={iconStyleWithMargin} />
						{formatLargeNumber(item.cacheWrites || 0)}
						<i className="codicon codicon-arrow-right ml-0.5" style={iconStyleWithMargin} />{" "}
						{/* Reduced ml-1 to ml-0.5 */}
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
					<CopyButton itemTask={item.task} />
					<ExportButton itemId={item.id} />
					<Button
						variant="ghost"
						size="sm"
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
						<span className="codicon codicon-trash" style={iconStyle} />
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
	expandAllTrigger?: number // New prop for cascading open state (e.g., a timestamp)
}

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
		expandAllTrigger, // This is the trigger received from the parent for IT to open and propagate
	}) => {
		const [isOpen, setIsOpen] = useState(false) // Individual open state for this item
		const [expandAllSignalForChildren, setExpandAllSignalForChildren] = useState<number | undefined>()

		React.useEffect(() => {
			if (expandAllTrigger) {
				setIsOpen(true)
				// Propagate the exact same trigger to children.
				// This ensures all descendants opened by a single "expand all" click share the same signal.
				setExpandAllSignalForChildren(expandAllTrigger)
			}
		}, [expandAllTrigger]) // Only re-run if the trigger from parent changes

		// Use the completed flag directly from the item
		const isTaskMarkedCompleted = item.completed ?? false

		// taskMeta is no longer needed.

		const taskPrimaryContent = (
			<div
				className={cn("flex items-start gap-2", {
					"p-3": level === 0,
					"py-1 px-3": level > 0,
				})}
				style={{ marginLeft: level * 20 }}>
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
				<div className="flex-1">
					<TaskItemHeader
						item={item}
						isSelectionMode={isSelectionMode}
						t={t}
						setDeleteTaskId={setDeleteTaskId}
						isOpen={isOpen} // Controlled by single chevron or expandAllTrigger effect
						onToggleOpen={() => {
							setIsOpen(!isOpen)
							// If user manually closes, we might want to stop an ongoing expandAll propagation for THIS branch.
							// However, for simplicity, manual toggle only affects this item directly.
							// Future: could set expandAllSignalForChildren to undefined here if closing.
						}}
						onExpandAllChildren={() => {
							setIsOpen(true) // Open current item
							setExpandAllSignalForChildren(Date.now()) // Send new signal to children
						}}
					/>
					<div
						className="mt-1" // Add some margin top for separation from header
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
					<Collapsible open={isOpen} onOpenChange={setIsOpen}>
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
									expandAllTrigger={expandAllSignalForChildren} // Pass down the signal
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
								currentTaskMessages={clineMessages} // Pass active task's messages
								currentTaskId={currentTaskItem?.id} // Pass active task's ID from currentTaskItem
							/>
						</div>
					)}
				/>
			</TabContent>

			{/* Fixed action bar at bottom - only shown in selection mode with selected items */}
			{isSelectionMode && selectedTaskIds.length > 0 && (
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
