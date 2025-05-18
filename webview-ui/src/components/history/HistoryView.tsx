import React, { memo, useState } from "react"
import {
	X,
	Search,
	ChevronDown,
	ArrowDown,
	ArrowUp,
	LayoutDashboard,
	Hash,
	CreditCard,
	Binary,
	Folder,
	Database,
	ArrowRight,
	Trash2,
	ChevronRight,
} from "lucide-react"
import { DeleteTaskDialog } from "./DeleteTaskDialog"
import { BatchDeleteTaskDialog } from "./BatchDeleteTaskDialog"
import prettyBytes from "pretty-bytes"
import { Virtuoso } from "react-virtuoso"

import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { vscode } from "@/utils/vscode"
import { formatLargeNumber, formatDate } from "@/utils/format"
import { cn } from "@/lib/utils"
import { Button, Checkbox } from "@/components/ui"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAppTranslation } from "@/i18n/TranslationContext"

import { Tab, TabContent, TabHeader } from "../common/Tab"
import { useTaskSearch } from "./useTaskSearch"
import { ExportButton } from "./ExportButton"
import { CopyButton } from "./CopyButton"

type HistoryViewProps = {
	onDone: () => void
}

type SortOption = "newest" | "oldest" | "mostExpensive" | "mostTokens" | "mostRelevant"

const HistoryView = ({ onDone }: HistoryViewProps) => {
	const {
		tasks,
		searchQuery,
		setSearchQuery,
		sortOption,
		setSortOption,
		setLastNonRelevantSort,
		// Destructure new workspace state from hook
		availableWorkspaces,
		workspaceFilterMode,
		setWorkspaceFilterMode,
		selectedWorkspaces,
		setSelectedWorkspaces,
	} = useTaskSearch()
	const { t } = useAppTranslation()

	const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null)
	const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
	const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState<boolean>(false)

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

	const sortOptionsData: { value: SortOption; label: string; icon: React.ElementType; disabled?: boolean }[] = [
		{ value: "newest", label: t("history:newest"), icon: ArrowDown },
		{ value: "oldest", label: t("history:oldest"), icon: ArrowUp },
		{ value: "mostExpensive", label: t("history:mostExpensive"), icon: LayoutDashboard },
		{ value: "mostTokens", label: t("history:mostTokens"), icon: Hash },
		{ value: "mostRelevant", label: t("history:mostRelevant"), icon: Search, disabled: !searchQuery },
	]

	const selectedSortLabel = sortOptionsData.find((opt) => opt.value === sortOption)?.label

	return (
		<Tab>
			<TabHeader className="flex flex-col gap-4">
				<div className="flex justify-between items-center">
					<h3 className="text-vscode-foreground m-0">{t("history:history")}</h3>
					<div className="flex gap-2">
						<Button variant="outline" onClick={onDone} title={t("history:done")}>
							<X className="mr-1 h-4 w-4" />
							{t("history:done")}
						</Button>
					</div>
				</div>
				<div className="flex flex-col gap-4">
					<VSCodeTextField
						style={{ width: "100%" }}
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
						<div slot="start">
							<Search className="h-[13px] w-[13px] opacity-80 mt-[2.5px]" />
						</div>
						{searchQuery && (
							<button
								className="input-icon-button flex justify-center items-center h-full"
								aria-label="Clear search"
								onClick={() => setSearchQuery("")}
								slot="end">
								<X className="h-4 w-4" />
							</button>
						)}
					</VSCodeTextField>
					{/* Combined Row for Workspace MultiSelect and Sort Dropdown */}
					<div className="flex justify-between items-center gap-4">
						{/* Workspace MultiSelect Dropdown */}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" className="flex-shrink-0 min-w-[150px] justify-start">
									{/* Dynamic Trigger Text */}
									<span>
										{workspaceFilterMode === "current" && "Workspace: Current"}
										{workspaceFilterMode === "all" && "Workspace: All"}
										{workspaceFilterMode === "selected" &&
											(selectedWorkspaces.length === 0
												? "Workspace: Current"
												: selectedWorkspaces.length === 1
													? `Workspace: ${selectedWorkspaces[0].split(/[\\/]/).pop() || selectedWorkspaces[0]}`
													: `Workspaces: ${selectedWorkspaces.length} selected`)}
									</span>
									<ChevronDown className="ml-auto h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent className="w-56">
								<DropdownMenuLabel>Filter by Workspace</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuCheckboxItem
									checked={workspaceFilterMode === "current"}
									onCheckedChange={() => setWorkspaceFilterMode("current")}>
									Current Workspace
								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									checked={workspaceFilterMode === "all"}
									onCheckedChange={() => setWorkspaceFilterMode("all")}>
									All Workspaces
								</DropdownMenuCheckboxItem>
								{availableWorkspaces.length > 0 && <DropdownMenuSeparator />}
								{availableWorkspaces.map((ws) => (
									<DropdownMenuCheckboxItem
										key={ws}
										title={ws}
										checked={selectedWorkspaces.includes(ws)}
										onCheckedChange={(checked) => {
											setWorkspaceFilterMode("selected")
											setSelectedWorkspaces((prev) =>
												checked
													? [...prev, ws]
													: prev.filter((selectedWs) => selectedWs !== ws),
											)
										}}>
										{ws.split(/[\\/]/).pop() || ws}
									</DropdownMenuCheckboxItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>

						{/* Sort Dropdown */}
						<div className="flex-grow min-w-[180px]">
							<Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
								<SelectTrigger className="w-full" data-testid="history-sort-trigger">
									<span>Sort: {selectedSortLabel ?? t("history:sortByPlaceholder")}</span>
								</SelectTrigger>
								<SelectContent>
									{sortOptionsData.map((option) => {
										const IconComponent = option.icon
										return (
											<SelectItem
												key={option.value}
												value={option.value}
												disabled={option.disabled}
												data-testid={`history-sort-item-${option.value}`}>
												<div className="flex items-center gap-2">
													<IconComponent className="h-4 w-4" />
													<span>{option.label}</span>
												</div>
											</SelectItem>
										)
									})}
								</SelectContent>
							</Select>
						</div>
					</div>

					{tasks.length > 0 && (
						<div className="flex items-center">
							<div className="flex items-center gap-2 flex-grow">
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
							</div>
						</div>
					)}
				</div>
			</TabHeader>

			<TabContent className="p-0">
				<Virtuoso
					className="flex-grow overflow-y-scroll"
					data={tasks}
					data-testid="virtuoso-container"
					initialTopMostItemIndex={0}
					components={{
						List: React.forwardRef((props, ref) => (
							<div {...props} ref={ref} data-testid="virtuoso-item-list" />
						)),
					}}
					itemContent={(index, item) => (
						<div
							data-testid={`task-item-${item.id}`}
							key={item.id}
							className={cn("group relative cursor-pointer", {
								"border-b border-vscode-panel-border": index < tasks.length - 1,
								"bg-vscode-list-activeSelectionBackground": selectedTaskIds.includes(item.id),
							})}
							onClick={() => {
								toggleTaskSelection(item.id, !selectedTaskIds.includes(item.id))
							}}>
							<div className="flex items-stretch gap-6">
								<div className="flex-1 min-w-0 p-6 pr-0">
									<div
										className="mb-3 text-vscode-font-size text-vscode-foreground line-clamp-3 overflow-hidden whitespace-pre-wrap break-words break-anywhere"
										data-testid="task-content"
										dangerouslySetInnerHTML={{ __html: item.task }}
									/>

									<div className="flex flex-col gap-2 text-xs text-vscode-descriptionForeground">
										<div className="flex items-center flex-wrap gap-x-4 gap-y-1">
											<div className="flex items-center gap-1 flex-wrap">
												<span
													data-testid="tokens-in"
													className="flex items-center gap-1"
													title={t("history:tokensInTitle")}>
													<ArrowDown className="h-[12px] w-[12px] font-bold" />
													{formatLargeNumber(item.tokensIn || 0)}
												</span>
												<span
													data-testid="tokens-out"
													className="flex items-center gap-1"
													title={t("history:tokensOutTitle")}>
													<ArrowDown className="h-[12px] w-[12px] font-bold" />
													{formatLargeNumber(item.tokensOut || 0)}
												</span>
											</div>
											{!!item.totalCost && (
												<div
													className="flex items-center gap-1"
													data-testid="cost-container"
													title={t("history:apiCostLabel")}>
													<CreditCard className="h-4 w-4" />
													<span>${item.totalCost?.toFixed(2)}</span>
												</div>
											)}
											{!!item.size && (
												<div
													className="flex items-center gap-1"
													data-testid="size-container"
													title={t("history:fileSizeTitle")}>
													<Binary className="h-4 w-4" />
													<span>{prettyBytes(item.size)}</span>
												</div>
											)}
											{(workspaceFilterMode === "all" || workspaceFilterMode === "selected") &&
												item.workspace && (
													<div
														className="flex flex-row gap-1 items-center"
														title={item.workspace}>
														<Folder className="h-4 w-4" />
														<span>
															{item.workspace.split(/[\\/]/).pop() || item.workspace}
														</span>
													</div>
												)}
										</div>

										{!!item.cacheWrites && (
											<div
												data-testid="cache-container"
												className="flex items-center gap-1 flex-wrap">
												<span className="font-medium text-vscode-descriptionForeground">
													{t("history:cacheLabel")}
												</span>
												<span
													data-testid="cache-writes"
													className="flex items-center gap-[3px] text-vscode-descriptionForeground">
													<Database className="h-[12px] w-[12px] font-bold -mb-px" />+
													{formatLargeNumber(item.cacheWrites || 0)}
												</span>
												<span
													data-testid="cache-reads"
													className="flex items-center gap-[3px] text-vscode-descriptionForeground">
													<ArrowRight className="h-[12px] w-[12px] font-bold mb-0" />
													{formatLargeNumber(item.cacheReads || 0)}
												</span>
											</div>
										)}
									</div>
									<div className="flex justify-between items-center mt-1">
										{" "}
										<span className="text-vscode-descriptionForeground font-medium text-sm uppercase flex-shrink-0 mr-4">
											{formatDate(item.ts)}
										</span>
										<div
											className={cn(
												"flex items-center gap-0 transition-opacity duration-100 ml-auto",
												selectedTaskIds.includes(item.id)
													? "opacity-100"
													: "opacity-0 group-hover:opacity-100",
											)}>
											<Button
												variant="ghost"
												size="icon"
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
												<Trash2 className="h-4 w-4" />
											</Button>
											<div onClick={(e) => e.stopPropagation()}>
												<CopyButton itemTask={item.task} />
											</div>
											<div onClick={(e) => e.stopPropagation()}>
												<ExportButton itemId={item.id} />
											</div>
										</div>
									</div>
								</div>
								<div className="relative">
									<Button
										variant="ghost"
										className={cn(
											"h-full px-3",
											"flex items-center justify-center",
											{
												"hover:bg-vscode-list-activeSelectionForeground/10":
													selectedTaskIds.includes(item.id),
											},
											"focus-visible:ring-0 focus-visible:ring-offset-0",
										)}
										title={t("history:showTaskDetails")}
										onClick={(e) => {
											e.stopPropagation()
											vscode.postMessage({ type: "showTaskWithId", text: item.id })
										}}>
										<ChevronRight className="h-4 w-4" />
									</Button>
								</div>
							</div>
						</div>
					)}
				/>
			</TabContent>

			{selectedTaskIds.length > 0 && (
				<div className="fixed bottom-0 left-0 right-0 bg-vscode-editor-background border-t border-vscode-panel-border p-4 flex justify-between items-center">
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

			{deleteTaskId && (
				<DeleteTaskDialog taskId={deleteTaskId} onOpenChange={(open) => !open && setDeleteTaskId(null)} open />
			)}

			{showBatchDeleteDialog && (
				<BatchDeleteTaskDialog
					taskIds={selectedTaskIds}
					open={showBatchDeleteDialog}
					onOpenChange={(open) => {
						if (!open) {
							setShowBatchDeleteDialog(false)
							setSelectedTaskIds([])
						}
					}}
				/>
			)}
		</Tab>
	)
}

export default memo(HistoryView)
