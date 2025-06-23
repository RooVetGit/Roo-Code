import React, { memo, useState, useEffect } from "react"
import { DeleteTaskDialog } from "./DeleteTaskDialog"
import { BatchDeleteTaskDialog } from "./BatchDeleteTaskDialog"
import { Virtuoso } from "react-virtuoso"

import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import {
	Button,
	Checkbox,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	StandardTooltip,
} from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"

import { Tab, TabContent, TabHeader } from "../common/Tab"
import SpinnerOverlay from "../common/SpinnerOverlay"
import { useTaskSearch } from "./useTaskSearch"
import TaskItem from "./TaskItem"

type HistoryViewProps = {
	onDone: () => void
}

type SortOption = "newest" | "oldest" | "mostExpensive" | "mostTokens" | "mostRelevant"

// Special workspace paths
const WORKSPACE_ALL = "all"
const WORKSPACE_CURRENT = "current"
const WORKSPACE_UNKNOWN = "unknown"

// Number of recent workspaces to show in the dropdown
const RECENT_WORKSPACES_COUNT = 5

const HistoryView = memo(({ onDone }: HistoryViewProps) => {
	const {
		tasks,
		loading,
		isSearching,
		searchQuery,
		setSearchQuery,
		sortOption,
		setSortOption,
		setLastNonRelevantSort,
		workspaceItems,
		workspacePath,
		setWorkspacePath,
		resultLimit,
		setResultLimit,
	} = useTaskSearch({ workspacePath: WORKSPACE_CURRENT, limit: 50 })
	const { t } = useAppTranslation()

	const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null)
	const [isSelectionMode, setIsSelectionMode] = useState(false)
	const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
	const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState<boolean>(false)
	const [isDeletingInProgress, setIsDeletingInProgress] = useState<boolean>(false)
	const [workspaceFilterText, setWorkspaceFilterText] = useState<string>("")

	// Prevent dropdown from handling keyboard events when filter is active
	const [isFilterActive, setIsFilterActive] = useState(false)

	// Listen for task deletion confirmation to hide the spinner
	useEffect(() => {
		const deletionHandler = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "taskDeletedConfirmation") {
				setIsDeletingInProgress(false)
			}
		}

		window.addEventListener("message", deletionHandler)

		return () => {
			window.removeEventListener("message", deletionHandler)
		}
	}, [])

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
						<StandardTooltip
							content={
								isSelectionMode
									? `${t("history:exitSelectionMode")}`
									: `${t("history:enterSelectionMode")}`
							}>
							<Button
								variant={isSelectionMode ? "default" : "secondary"}
								onClick={toggleSelectionMode}
								data-testid="toggle-selection-mode-button">
								<span
									className={`codicon ${isSelectionMode ? "codicon-check-all" : "codicon-checklist"} mr-1`}
								/>
								{isSelectionMode ? t("history:exitSelection") : t("history:selectionMode")}
							</Button>
						</StandardTooltip>
						<Button onClick={onDone}>{t("history:done")}</Button>
					</div>
				</div>
				<div className="flex flex-col gap-2">
					<VSCodeTextField
						className="w-full"
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
							className={`codicon ${loading ? "codicon-loading codicon-modifier-spin" : "codicon-search"} mt-0.5 opacity-80 text-sm!`}
						/>
						{searchQuery && (
							<div
								className={`input-icon-button codicon ${isSearching ? "codicon-loading codicon-modifier-spin" : "codicon-close"} flex justify-center items-center h-full`}
								aria-label={isSearching ? "Searching..." : "Clear search"}
								onClick={isSearching ? undefined : () => setSearchQuery("")}
								slot="end"
							/>
						)}
					</VSCodeTextField>
					<div className="flex gap-2">
						<WorkspaceSelector
							workspacePath={workspacePath}
							setWorkspacePath={setWorkspacePath}
							workspaceItems={workspaceItems}
							workspaceFilterText={workspaceFilterText}
							setWorkspaceFilterText={setWorkspaceFilterText}
							isFilterActive={isFilterActive}
							setIsFilterActive={setIsFilterActive}
							t={t}
						/>
						<div className="flex gap-2 flex-1">
							<SortSelector
								sortOption={sortOption}
								setSortOption={setSortOption}
								searchQuery={searchQuery}
								t={t}
							/>
							<LimitSelector resultLimit={resultLimit} setResultLimit={setResultLimit} t={t} />
						</div>
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
				{loading ? (
					<div className="flex justify-center items-center h-64">
						<div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-vscode-foreground"></div>
					</div>
				) : tasks.length === 0 ? (
					<div className="flex flex-col justify-center items-center h-64 text-vscode-descriptionForeground">
						<div className="codicon codicon-search text-4xl mb-2"></div>
						<div>{t("history:noItemsFound")}</div>
					</div>
				) : (
					<Virtuoso
						className="flex-1 overflow-y-scroll"
						data={tasks}
						data-testid="virtuoso-container"
						initialTopMostItemIndex={0}
						components={{
							List: React.forwardRef((props, ref) => (
								<div {...props} ref={ref} data-testid="virtuoso-item-list" />
							)),
						}}
						itemContent={(_index, item) => (
							<TaskItem
								key={item.id}
								item={item}
								variant="full"
								showWorkspace={workspacePath === "all"}
								isSelectionMode={isSelectionMode}
								isSelected={selectedTaskIds.includes(item.id)}
								onToggleSelection={toggleTaskSelection}
								onDelete={setDeleteTaskId}
								className="m-2 mr-0"
							/>
						)}
					/>
				)}
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
				<DeleteTaskDialog
					taskId={deleteTaskId}
					onOpenChange={(open) => !open && setDeleteTaskId(null)}
					onDeleteStart={() => setIsDeletingInProgress(true)}
					open
				/>
			)}

			{/* Batch delete dialog */}
			{showBatchDeleteDialog && (
				<BatchDeleteTaskDialog
					taskIds={selectedTaskIds}
					open={showBatchDeleteDialog}
					onDeleteStart={() => setIsDeletingInProgress(true)}
					onOpenChange={(open) => {
						if (!open) {
							setShowBatchDeleteDialog(false)
							setSelectedTaskIds([])
							setIsSelectionMode(false)
						}
					}}
				/>
			)}

			{/* Spinner overlay for deletion in progress */}
			<SpinnerOverlay isVisible={isDeletingInProgress} message="Deleting..." />
		</Tab>
	)
})

// Workspace filter input component
const WorkspaceFilterInput = memo(
	({
		workspaceFilterText,
		setWorkspaceFilterText,
		setIsFilterActive,
		t,
	}: {
		workspaceFilterText: string
		setWorkspaceFilterText: (value: string) => void
		setIsFilterActive: (value: boolean) => void
		t: any
	}) => {
		return (
			<div
				className="p-2 top-0 left-0 right-0 w-full bg-vscode-editor-background z-30 border-b border-vscode-panel-border"
				onMouseEnter={() => {
					const input = document.getElementById("workspace-filter-input")
					if (input) {
						;(input as HTMLInputElement).focus()
						setIsFilterActive(true)
					}
				}}>
				<VSCodeTextField
					className="w-full"
					placeholder={t("history:workspace.filterPlaceholder")}
					id="workspace-filter-input"
					autoFocus
					value={workspaceFilterText}
					onClick={(e) => {
						e.stopPropagation()
						setIsFilterActive(true)
					}}
					onFocus={() => setIsFilterActive(true)}
					onBlur={() => setIsFilterActive(false)}
					onKeyDown={(e) => {
						// Prevent keyboard navigation from moving focus away from input
						e.stopPropagation()
					}}
					onInput={(e) => {
						const target = e.target as HTMLInputElement
						setWorkspaceFilterText(target.value)
						setIsFilterActive(true)

						// Keep focus on the input
						setTimeout(() => {
							const input = document.getElementById("workspace-filter-input")
							if (input) {
								;(input as HTMLInputElement).focus()
							}
						}, 0)
					}}>
					<div slot="start" className="codicon codicon-filter mt-0.5 opacity-80 text-sm!" />
					{workspaceFilterText && (
						<div
							className="input-icon-button codicon codicon-close flex justify-center items-center h-full"
							aria-label="Clear filter"
							onClick={(e) => {
								setWorkspaceFilterText("")
								// Prevent the click from closing the dropdown
								e.stopPropagation()
								// Focus back on the input
								const input = e.currentTarget.parentElement?.querySelector("input")
								if (input) {
									input.focus()
								}
							}}
							slot="end"
						/>
					)}
				</VSCodeTextField>
			</div>
		)
	},
)

// Workspace select item component
const WorkspaceSelectItem = memo(
	({
		workspace,
		filterText,
	}: {
		workspace: { path: string; name: string; missing: boolean }
		filterText?: string
	}) => {
		// If filter text is provided and not empty, check if this workspace should be shown
		if (
			filterText &&
			filterText.trim() !== "" &&
			!workspace.name.toLowerCase().includes(filterText.toLowerCase())
		) {
			return null
		}

		return (
			<SelectItem key={workspace.path} value={workspace.path}>
				<div className="flex items-center gap-2 truncate">
					<span className="codicon codicon-folder" />
					{workspace.missing ? (
						<span className="truncate line-through">{workspace.name}</span>
					) : (
						<span className="truncate">{workspace.name}</span>
					)}
				</div>
			</SelectItem>
		)
	},
	(prevProps, nextProps) => {
		// Only re-render if the workspace or filter text has changed
		return prevProps.workspace.path === nextProps.workspace.path && prevProps.filterText === nextProps.filterText
	},
)

// Memoized workspace selector component
const WorkspaceSelector = memo(
	({
		workspacePath,
		setWorkspacePath,
		workspaceItems,
		workspaceFilterText,
		setWorkspaceFilterText,
		isFilterActive,
		setIsFilterActive,
		t,
	}: {
		workspacePath: string | undefined
		setWorkspacePath: (value: string) => void
		workspaceItems: Array<{ path: string; name: string; missing: boolean }>
		workspaceFilterText: string
		setWorkspaceFilterText: (value: string) => void
		isFilterActive: boolean
		setIsFilterActive: (value: boolean) => void
		t: any
	}) => {
		return (
			<Select
				value={workspacePath}
				onValueChange={(value) => {
					setWorkspacePath(value)
					setWorkspaceFilterText("")
					setIsFilterActive(false)
				}}
				onOpenChange={(open) => {
					if (!open) {
						setWorkspaceFilterText("")
						setIsFilterActive(false)
					} else {
						setTimeout(() => {
							const input = document.getElementById("workspace-filter-input")
							if (input) {
								;(input as HTMLInputElement).focus()
							}
						}, 50)
					}
				}}>
				<SelectTrigger className="flex-1" data-testid="workspace-select-trigger">
					<SelectValue>
						{t("history:workspace.prefix")}{" "}
						{workspacePath === WORKSPACE_ALL
							? t("history:workspace.all")
							: workspacePath === WORKSPACE_CURRENT
								? t("history:workspace.current")
								: workspacePath === WORKSPACE_UNKNOWN
									? t("history:workspace.unknown")
									: workspacePath?.split("/").pop() || workspacePath || ""}
					</SelectValue>
				</SelectTrigger>
				<SelectContent
					className="max-h-[80vh] overflow-auto relative"
					onPointerMove={(e) => e.stopPropagation()}
					onCloseAutoFocus={(e) => {
						e.preventDefault()
					}}
					onKeyDown={(e) => {
						if (isFilterActive) {
							e.stopPropagation()
						}
					}}>
					<WorkspaceFilterInput
						workspaceFilterText={workspaceFilterText}
						setWorkspaceFilterText={setWorkspaceFilterText}
						setIsFilterActive={setIsFilterActive}
						t={t}
					/>
					<SelectItem value="current">
						<div className="flex items-center gap-2">
							<span className="codicon codicon-folder" />
							{t("history:workspace.current")}
						</div>
					</SelectItem>
					<SelectItem value="all">
						<div className="flex items-center gap-2">
							<span className="codicon codicon-folder-opened" />
							{t("history:workspace.all")}
						</div>
					</SelectItem>

					{workspaceItems && workspaceItems.length > 0 && (
						<>
							<div className="px-2 py-1.5 text-xs text-vscode-descriptionForeground">
								{t("history:workspace.recent")}
							</div>
							{workspaceItems.slice(0, RECENT_WORKSPACES_COUNT).map((workspace) => (
								<WorkspaceSelectItem
									key={workspace.path}
									workspace={workspace}
									filterText={workspaceFilterText}
								/>
							))}
						</>
					)}

					{workspaceItems && workspaceItems.length > RECENT_WORKSPACES_COUNT && (
						<>
							<div className="px-2 py-1.5 text-xs text-vscode-descriptionForeground">
								{t("history:workspace.available")}
								{(!workspaceFilterText || workspaceFilterText.trim() === "") &&
									`(${workspaceItems.length - RECENT_WORKSPACES_COUNT})`}
							</div>
							{[...workspaceItems]
								.slice(RECENT_WORKSPACES_COUNT) // Skip items already shown in "Recent"
								.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
								.map((workspace) => (
									<WorkspaceSelectItem
										key={workspace.path}
										workspace={workspace}
										filterText={workspaceFilterText}
									/>
								))}
						</>
					)}
				</SelectContent>
			</Select>
		)
	},
)

// Memoized sort selector component
const SortSelector = memo(
	({
		sortOption,
		setSortOption,
		searchQuery,
		t,
	}: {
		sortOption: SortOption
		setSortOption: (value: SortOption) => void
		searchQuery: string
		t: any
	}) => {
		return (
			<Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
				<SelectTrigger className="flex-1">
					<SelectValue>
						{t("history:sort.prefix")} {t(`history:sort.${sortOption}`)}
					</SelectValue>
				</SelectTrigger>
				<SelectContent className="max-h-[80vh] overflow-auto">
					<SelectItem value="newest" data-testid="select-newest">
						<div className="flex items-center gap-2">
							<span className="codicon codicon-arrow-down" />
							{t("history:newest")}
						</div>
					</SelectItem>
					<SelectItem value="oldest" data-testid="select-oldest">
						<div className="flex items-center gap-2">
							<span className="codicon codicon-arrow-up" />
							{t("history:oldest")}
						</div>
					</SelectItem>
					<SelectItem value="mostExpensive" data-testid="select-most-expensive">
						<div className="flex items-center gap-2">
							<span className="codicon codicon-credit-card" />
							{t("history:mostExpensive")}
						</div>
					</SelectItem>
					<SelectItem value="mostTokens" data-testid="select-most-tokens">
						<div className="flex items-center gap-2">
							<span className="codicon codicon-symbol-numeric" />
							{t("history:mostTokens")}
						</div>
					</SelectItem>
					<SelectItem value="mostRelevant" disabled={!searchQuery} data-testid="select-most-relevant">
						<div className="flex items-center gap-2">
							<span className="codicon codicon-search" />
							{t("history:mostRelevant")}
						</div>
					</SelectItem>
				</SelectContent>
			</Select>
		)
	},
)

// Memoized limit selector component
const LimitSelector = memo(
	({
		resultLimit,
		setResultLimit,
		t,
	}: {
		resultLimit: number | undefined
		setResultLimit: (value: number | undefined) => void
		t: any
	}) => {
		return (
			<Select
				value={resultLimit?.toString() || "all"}
				onValueChange={(value) => setResultLimit(value === "all" ? undefined : parseInt(value, 10))}>
				<SelectTrigger className="flex-1">
					<SelectValue>
						{t("history:limit.prefix")}{" "}
						{resultLimit ? t(`history:limit.${resultLimit}`) : t("history:limit.all")}
					</SelectValue>
				</SelectTrigger>
				<SelectContent className="max-h-[80vh] overflow-auto">
					<SelectItem value="50" data-testid="select-limit-50">
						<div className="flex items-center gap-2">
							<span className="codicon codicon-list-filter" />
							{t("history:limit.50")}
						</div>
					</SelectItem>
					<SelectItem value="100" data-testid="select-limit-100">
						<div className="flex items-center gap-2">
							<span className="codicon codicon-list-filter" />
							{t("history:limit.100")}
						</div>
					</SelectItem>
					<SelectItem value="200" data-testid="select-limit-200">
						<div className="flex items-center gap-2">
							<span className="codicon codicon-list-filter" />
							{t("history:limit.200")}
						</div>
					</SelectItem>
					<SelectItem value="500" data-testid="select-limit-500">
						<div className="flex items-center gap-2">
							<span className="codicon codicon-list-filter" />
							{t("history:limit.500")}
						</div>
					</SelectItem>
					<SelectItem value="1000" data-testid="select-limit-1000">
						<div className="flex items-center gap-2">
							<span className="codicon codicon-list-filter" />
							{t("history:limit.1000")}
						</div>
					</SelectItem>
					<SelectItem value="all" data-testid="select-limit-all">
						<div className="flex items-center gap-2">
							<span className="codicon codicon-list-unfiltered" />
							{t("history:limit.all")}
						</div>
					</SelectItem>
				</SelectContent>
			</Select>
		)
	},
)

export default HistoryView
