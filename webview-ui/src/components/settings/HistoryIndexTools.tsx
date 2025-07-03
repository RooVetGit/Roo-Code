import React, { useState, useEffect, useCallback } from "react"
import { Database, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react"
import { VSCodeCheckbox, VSCodeRadio } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { vscode } from "@src/utils/vscode"
import { HistoryScanResults, HistoryRebuildOptions } from "@roo-code/types"
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogCancel,
	AlertDialogAction,
	AlertDialogHeader,
	AlertDialogFooter,
	Button,
} from "@src/components/ui"

import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import CodeBlock from "@src/components/common/CodeBlock"
import TaskItem from "@src/components/history/TaskItem"

// Helper function to convert Map or object to array for rendering
const mapToArray = (map: Map<string, any> | Record<string, any>) => {
	// Check if it's a Map instance
	if (map instanceof Map) {
		return Array.from(map.entries()).map(([id, item]) => ({ id, ...item }))
	}
	// Handle plain object
	return Object.entries(map).map(([id, item]) => ({ id, ...item }))
}

// Helper function to convert Set or array to array for rendering
const setToArray = (set: Set<string> | string[]) => {
	// Check if it's a Set instance
	if (set instanceof Set) {
		return Array.from(set).map((id) => ({ id }))
	}
	// Handle plain array
	return Array.isArray(set) ? set.map((id) => ({ id })) : []
}

export type HistoryIndexToolsProps = Record<string, never>

export const HistoryIndexTools: React.FC<HistoryIndexToolsProps> = () => {
	const { t } = useAppTranslation()

	// State for the scan results
	const [scanResults, setScanResults] = useState<HistoryScanResults | null>(null)
	const [isScanning, setIsScanning] = useState(false)
	const [isRebuilding, setIsRebuilding] = useState(false)
	const [showConfirmDialog, setShowConfirmDialog] = useState(false)
	const [logs, setLogs] = useState<string[]>([])
	const [selectedTaskForModal, setSelectedTaskForModal] = useState<any>(null)
	const [showTaskModal, setShowTaskModal] = useState(false)

	// Ref for the logs section
	const logsRef = React.useRef<HTMLDivElement>(null)

	// State for scan and rebuild options
	const [rebuildMode, setRebuildMode] = useState<"merge" | "replace">("merge")
	const [mergeFromGlobal, setMergeFromGlobal] = useState(true)
	const [mergeToGlobal, setMergeToGlobal] = useState(false)
	const [showAdvanced, setShowAdvanced] = useState(false)
	const [reconstructOrphans, setReconstructOrphans] = useState(true)
	const [scanHistoryFiles, setScanHistoryFiles] = useState(true)

	// State for task selection - initially set to orphans but will be updated based on scan results
	const [selectedTaskType, setSelectedTaskType] = useState<
		"tasksOnlyInGlobalState" | "tasksOnlyInTaskHistoryIndexes" | "orphans" | "failedReconstructions"
	>("orphans")

	// Handle scan button click
	const handleScan = async () => {
		setIsScanning(true)
		setScanResults(null)
		setLogs([])

		try {
			// Call scanTaskHistory via handler
			vscode.postMessage({
				type: "scanTaskHistory" as any,
				historyScanOptions: {
					mode: "merge",
					mergeFromGlobal: true,
					reconstructOrphans: true,
					scanHistoryFiles: true,
					logs: [],
				},
			})
		} catch (error) {
			console.error("Error scanning task history:", error)
			setIsScanning(false)
		}
	}

	// Handle task type selection
	const handleTaskTypeChange = (
		type: "tasksOnlyInGlobalState" | "tasksOnlyInTaskHistoryIndexes" | "orphans" | "failedReconstructions",
	) => {
		setSelectedTaskType(type)
	}

	// Handle task click to show details in modal
	const handleTaskClick = (task: any) => {
		setSelectedTaskForModal(task)
		setShowTaskModal(true)
	}

	// Handle rebuild button click
	const handleRebuild = () => {
		// Show confirmation dialog
		setShowConfirmDialog(true)
	}

	// Get current tasks based on selected type
	const getCurrentTasks = () => {
		if (!scanResults) return []

		if (selectedTaskType === "tasksOnlyInGlobalState") {
			return mapToArray(scanResults.tasks.tasksOnlyInGlobalState)
		} else if (selectedTaskType === "tasksOnlyInTaskHistoryIndexes") {
			return mapToArray(scanResults.tasks.tasksOnlyInTaskHistoryIndexes)
		} else if (selectedTaskType === "orphans") {
			return mapToArray(scanResults.tasks.orphans)
		} else {
			return setToArray(scanResults.tasks.failedReconstructions)
		}
	}

	// Helper functions to get counts for different task types
	const getValidTasksCount = useCallback(() => {
		if (!scanResults) return 0
		// Force display of validCount from scanResults
		return scanResults.validCount || 0
	}, [scanResults])

	const getMissingTasksCount = useCallback(() => {
		if (!scanResults) return 0

		if (scanResults.tasks.tasksOnlyInGlobalState instanceof Map) {
			return scanResults.tasks.tasksOnlyInGlobalState.size
		} else {
			return Object.keys(scanResults.tasks.tasksOnlyInGlobalState || {}).length
		}
	}, [scanResults])

	const getTaskHistoryOnlyCount = useCallback(() => {
		if (!scanResults) return 0

		if (scanResults.tasks.tasksOnlyInTaskHistoryIndexes instanceof Map) {
			return scanResults.tasks.tasksOnlyInTaskHistoryIndexes.size
		} else {
			return Object.keys(scanResults.tasks.tasksOnlyInTaskHistoryIndexes || {}).length
		}
	}, [scanResults])

	const getOrphanedTasksCount = useCallback(() => {
		if (!scanResults) return 0

		if (scanResults.tasks.orphans instanceof Map) {
			return scanResults.tasks.orphans.size
		} else {
			return Object.keys(scanResults.tasks.orphans || {}).length
		}
	}, [scanResults])

	const getFailedTasksCount = useCallback(() => {
		if (!scanResults) return 0

		if (scanResults.tasks.failedReconstructions instanceof Set) {
			return scanResults.tasks.failedReconstructions.size
		} else if (Array.isArray(scanResults.tasks.failedReconstructions)) {
			return (scanResults.tasks.failedReconstructions as string[]).length
		} else {
			return Object.keys((scanResults.tasks.failedReconstructions as Record<string, any>) || {}).length
		}
	}, [scanResults])

	// Handle confirmation dialog confirm
	const handleConfirmRebuild = async () => {
		setShowConfirmDialog(false)
		setIsRebuilding(true)
		setLogs([])

		try {
			// Request rebuild from extension with options
			const options: HistoryRebuildOptions = {
				mode: rebuildMode,
				mergeFromGlobal,
				mergeToGlobal,
				reconstructOrphans,
				scanHistoryFiles,
				logs: [],
			}

			vscode.postMessage({
				type: "rebuildHistoryIndexes" as any,
				historyScanOptions: options,
			})

			// Scroll to logs section after a delay to allow logs to start appearing
			setTimeout(() => {
				if (logsRef.current) {
					logsRef.current.scrollIntoView({ behavior: "smooth" })
				}
			}, 250)
		} catch (error) {
			console.error("Error rebuilding history indexes:", error)
			setIsRebuilding(false)
		}
	}

	// Handle message from extension
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data

			console.log("Received message:", message.type) // Debug logging

			// Handle scan task history log messages - used for both scan and rebuild operations
			if (message.type === "loggingOperation") {
				// Add log message
				setLogs((prev) => [...prev, message.log])
			}
			// Handle scan task history result
			else if (message.type === "scanTaskHistoryResult") {
				setIsScanning(false)

				// Set the scan results and update the selected task type based on counts
				if (message.results) {
					// Log the message results to debug
					console.log("scanTaskHistoryResult received:", message.results)
					setScanResults(message.results)

					// We need to use a setTimeout here because the helper functions
					// depend on scanResults being set, which happens asynchronously
					setTimeout(() => {
						// Find the task type with the highest count
						const counts = {
							tasksOnlyInGlobalState: getMissingTasksCount(),
							tasksOnlyInTaskHistoryIndexes: getTaskHistoryOnlyCount(),
							orphans: getOrphanedTasksCount(),
							failedReconstructions: getFailedTasksCount(),
						}

						// Get the task type with the highest count using reduce
						type TaskType =
							| "tasksOnlyInGlobalState"
							| "tasksOnlyInTaskHistoryIndexes"
							| "orphans"
							| "failedReconstructions"
						const entries = Object.entries(counts) as [TaskType, number][]

						const maxEntry = entries.reduce((max, current) => (current[1] > max[1] ? current : max), [
							"orphans",
							0,
						] as [TaskType, number])

						// Only update if there are items
						if (maxEntry[1] > 0) {
							setSelectedTaskType(maxEntry[0])
						}
					}, 0)
				}
			}
			// Handle rebuild result messages
			else if (message.type === "rebuildHistoryIndexesResult") {
				setIsRebuilding(false)
				// Final result
				if (message.success) {
					setLogs((prev) => [...prev, t("history:indexTools.rebuildSuccess")])
				} else {
					setLogs((prev) => [...prev, t("history:indexTools.rebuildError")])
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [t, getFailedTasksCount, getMissingTasksCount, getOrphanedTasksCount, getTaskHistoryOnlyCount])

	// Generate confirmation text based on selected options
	const getConfirmationText = () => {
		const actions = []

		if (rebuildMode === "replace") {
			actions.push(t("history:indexTools.confirmReplace"))
		} else {
			actions.push(t("history:indexTools.confirmMerge"))
		}

		if (mergeFromGlobal && getMissingTasksCount() > 0) {
			actions.push(t("history:indexTools.confirmImport", { count: getMissingTasksCount() }))
		}

		if (reconstructOrphans && getOrphanedTasksCount() > 0) {
			actions.push(t("history:indexTools.confirmReconstruct", { count: getOrphanedTasksCount() }))
		}

		if (mergeToGlobal && getTaskHistoryOnlyCount() > 0) {
			actions.push(t("history:indexTools.confirmMergeToGlobal", { count: getTaskHistoryOnlyCount() }))
		}

		return actions
	}

	return (
		<React.Fragment>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<Database className="w-4" />
					<div>{t("settings:sections.historyIndexTools")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div className="space-y-2">
					<div className="text-sm text-vscode-foreground">{t("history:indexTools.description")}</div>

					{/* Configuration options section - border only */}
					<div className="pt-2 border-t border-vscode-sideBar-background"></div>

					{/* Initial scan button */}
					{!scanResults && !isScanning && (
						<div className="flex justify-start mt-4">
							<Button onClick={handleScan} disabled={isScanning}>
								{t("history:indexTools.scanButton")}
							</Button>
						</div>
					)}

					{/* Loading indicator */}
					{isScanning && (
						<div className="flex items-center gap-2">
							<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-vscode-foreground"></div>
							<div>{t("history:indexTools.scanning")}</div>
						</div>
					)}

					{/* Scan results */}
					{scanResults && (
						<div className="space-y-4">
							<h2 className="text-base font-semibold mb-2">{t("history:indexTools.scanResults")}</h2>

							<ul className="space-y-2 text-sm list-none">
								<li className="flex items-center">
									<span className="mr-2">•</span>
									<span>{t("history:indexTools.validTasks")}:</span>
									<span className="ml-2 font-medium">{getValidTasksCount()}</span>
								</li>
								<li className="flex items-center">
									<span className="mr-2">•</span>
									<span>{t("history:indexTools.missingTasks")}:</span>
									<span className="ml-2 font-medium">{getMissingTasksCount()}</span>
								</li>
								<li className="flex items-center">
									<span className="mr-2">•</span>
									<span>{t("history:indexTools.orphanedTasks")}:</span>
									<span className="ml-2 font-medium">{getOrphanedTasksCount()}</span>
								</li>
								<li className="flex items-center">
									<span className="mr-2">•</span>
									<span>{t("history:indexTools.failedTasks")}:</span>
									<span className="ml-2 font-medium">{getFailedTasksCount()}</span>
								</li>
							</ul>

							{/* Optional actions - only visible after scan */}
							<div className="pt-2 border-t border-vscode-sideBar-background">
								<h3 className="text-sm font-semibold mb-2">
									{t("history:indexTools.optionalActions")}
								</h3>

								{/* Import legacy tasks */}
								<div>
									<VSCodeCheckbox
										id="mergeFromGlobal"
										checked={mergeFromGlobal}
										onChange={(e: any) => setMergeFromGlobal(e.target.checked)}>
										<span className="font-medium">
											{t("history:indexTools.importLegacy")} ({getMissingTasksCount()})
										</span>
									</VSCodeCheckbox>
									<div className="text-vscode-descriptionForeground text-sm mt-1 mb-2">
										{t("history:indexTools.importLegacyDesc")}
									</div>
								</div>

								{/* Resurrect orphaned tasks */}
								<div>
									<VSCodeCheckbox
										id="reconstructOrphans"
										checked={reconstructOrphans}
										onChange={(e: any) => setReconstructOrphans(e.target.checked)}>
										<span className="font-medium">
											{t("history:indexTools.reconstructOrphans")} ({getOrphanedTasksCount()})
										</span>
									</VSCodeCheckbox>
									<div className="text-vscode-descriptionForeground text-sm mt-1 mb-2">
										{t("history:indexTools.reconstructOrphansDesc")}
									</div>
								</div>

								{/* Use filesystem scan */}
								<div>
									<VSCodeCheckbox
										id="scanHistoryFiles"
										checked={scanHistoryFiles}
										onChange={(e: any) => setScanHistoryFiles(e.target.checked)}>
										<span className="font-medium">{t("history:indexTools.useFilesystemScan")}</span>
									</VSCodeCheckbox>
									<div className="text-vscode-descriptionForeground text-sm mt-1 mb-2">
										{t("history:indexTools.useFilesystemScanDesc")}
									</div>
								</div>

								{/* Advanced section with chevron */}
								<div className="mt-2 mb-2">
									<button
										className="flex items-center text-sm font-medium text-vscode-foreground hover:text-vscode-button-foreground focus:outline-none"
										onClick={() => setShowAdvanced(!showAdvanced)}>
										{showAdvanced ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
										<span className="ml-1">{t("common:advanced")}</span>
									</button>

									{showAdvanced && (
										<div className="mt-2 pl-5">
											{/* Update global state */}
											<div>
												<VSCodeCheckbox
													id="mergeToGlobal"
													checked={mergeToGlobal}
													onChange={(e: any) => setMergeToGlobal(e.target.checked)}>
													<span className="font-medium">
														{t("history:indexTools.mergeToGlobal")} (
														{getTaskHistoryOnlyCount()})
													</span>
												</VSCodeCheckbox>
												<div className="text-vscode-descriptionForeground text-sm mt-1 mb-2">
													{t("history:indexTools.mergeToGlobalDesc")}
												</div>
											</div>
										</div>
									)}
								</div>
							</div>

							{/* Rebuild options */}
							<div className="pt-2 border-t border-vscode-sideBar-background">
								{/* Mode selection */}
								<div>
									<h3 className="text-sm font-semibold mb-2">
										{t("history:indexTools.modeSelection")}
									</h3>
									<div>
										<div>
											<VSCodeRadio
												name="rebuildMode"
												checked={rebuildMode === "merge"}
												value="merge"
												id="merge-after-scan"
												onClick={() => setRebuildMode("merge")}>
												<span className="font-medium">{t("history:indexTools.mergeMode")}</span>
											</VSCodeRadio>
											<div className="text-vscode-descriptionForeground text-sm mt-1 mb-2">
												{t("history:indexTools.mergeModeDesc")}
											</div>
										</div>

										<div>
											<VSCodeRadio
												name="rebuildMode"
												checked={rebuildMode === "replace"}
												value="replace"
												id="replace-after-scan"
												onClick={() => setRebuildMode("replace")}>
												<span className="font-medium">
													{t("history:indexTools.replaceMode")}
												</span>
											</VSCodeRadio>
											<div className="text-vscode-descriptionForeground text-sm mt-1 mb-2">
												{t("history:indexTools.replaceModeDesc")}
											</div>
										</div>
									</div>
								</div>

								{/* Action buttons */}
								<div className="flex justify-start space-x-2 pt-2">
									<Button onClick={handleRebuild} disabled={isRebuilding}>
										{t("history:indexTools.rebuildButton")}
									</Button>
									<Button
										variant="secondary"
										onClick={handleScan}
										disabled={isScanning || isRebuilding}>
										{t("history:indexTools.rescanButton")}
									</Button>
								</div>
								{/* Task preview section */}
								<div className="pt-2 border-t border-vscode-sideBar-background">
									<h3 className="text-sm font-semibold mb-2">
										{t("history:indexTools.taskPreview")}
									</h3>

									{/* Task type selection */}
									<div>
										<div>
											<div>
												<VSCodeRadio
													name="taskType"
													checked={selectedTaskType === "orphans"}
													value="orphans"
													id="orphaned-tasks"
													onClick={() => handleTaskTypeChange("orphans")}>
													<span className="font-medium">
														{t("history:indexTools.orphanedTasks")} (
														{getOrphanedTasksCount()})
													</span>
												</VSCodeRadio>
											</div>

											<div>
												<VSCodeRadio
													name="taskType"
													checked={selectedTaskType === "tasksOnlyInGlobalState"}
													value="tasksOnlyInGlobalState"
													id="missing-tasks"
													onClick={() => handleTaskTypeChange("tasksOnlyInGlobalState")}>
													<span className="font-medium">
														{t("history:indexTools.missingTasks")} ({getMissingTasksCount()}
														)
													</span>
												</VSCodeRadio>
											</div>

											<div>
												<VSCodeRadio
													name="taskType"
													checked={selectedTaskType === "failedReconstructions"}
													value="failedReconstructions"
													id="failed-tasks"
													onClick={() => handleTaskTypeChange("failedReconstructions")}>
													<span className="font-medium">
														{t("history:indexTools.failedTasks")} ({getFailedTasksCount()})
													</span>
												</VSCodeRadio>
											</div>

											{mergeToGlobal && (
												<div>
													<VSCodeRadio
														name="taskType"
														checked={selectedTaskType === "tasksOnlyInTaskHistoryIndexes"}
														value="tasksOnlyInTaskHistoryIndexes"
														id="file-index-only-tasks"
														onClick={() =>
															handleTaskTypeChange("tasksOnlyInTaskHistoryIndexes")
														}>
														<span className="font-medium">
															{t("history:indexTools.fileIndexOnlyTasks")} (
															{getTaskHistoryOnlyCount()})
														</span>
													</VSCodeRadio>
												</div>
											)}
										</div>
									</div>

									{/* Task list - only show if there are tasks */}
									{getCurrentTasks().length > 0 && (
										<div>
											<h4 className="text-sm font-semibold mb-2">
												{t("history:indexTools.taskList")} ({getCurrentTasks().length})
											</h4>
											<div className="text-vscode-descriptionForeground text-sm mb-2">
												{t("history:indexTools.taskListDesc")}
											</div>

											<div className="flex-1 min-h-0 max-h-[500px] overflow-y-auto border border-vscode-sideBar-background rounded">
												<div className="divide-y divide-vscode-sideBar-background">
													{getCurrentTasks().map((task) => (
														<div
															key={task.id}
															onClick={(e) => {
																e.stopPropagation()
																e.preventDefault()
																handleTaskClick(task)
															}}
															className="cursor-pointer">
															<TaskItem
																key={task.id}
																item={task}
																variant="compact"
																className="m-0"
															/>
														</div>
													))}
												</div>
											</div>
										</div>
									)}
								</div>
							</div>
						</div>
					)}

					{/* Logs section - show during scanning, rebuilding, or when there are logs */}
					{logs.length > 0 && (
						<div className="mt-4" ref={logsRef}>
							<h3 className="text-sm font-semibold mb-2">
								{isScanning
									? t("history:indexTools.scanningLogs")
									: isRebuilding
										? t("history:indexTools.rebuildingLogs")
										: t("history:indexTools.operationLogs")}
							</h3>
							{logs.length > 0 ? (
								<div className="max-w-full overflow-x-auto">
									<CodeBlock source={logs.join("\n")} language="log" />
								</div>
							) : (
								<div className="p-4 text-center text-vscode-descriptionForeground">
									{t("history:indexTools.waitingForLogs")}
								</div>
							)}
						</div>
					)}
				</div>
			</Section>

			{/* Confirmation dialog */}
			<AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							<div className="flex items-center gap-2">
								<AlertTriangle className="w-5 h-5 text-yellow-500" />
								{t("history:indexTools.confirmTitle")}
							</div>
						</AlertDialogTitle>
						<AlertDialogDescription>
							<div className="space-y-4">
								<p>{t("history:indexTools.confirmDescription")}</p>

								<div className="space-y-2">
									<p className="font-medium">{t("history:indexTools.confirmActions")}</p>
									<ul className="list-disc pl-5 space-y-1">
										{getConfirmationText().map((text, index) => (
											<li key={index}>{text}</li>
										))}
									</ul>
								</div>

								<p className="font-medium text-yellow-500">{t("history:indexTools.confirmWarning")}</p>
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t("common:answers.cancel")}</AlertDialogCancel>
						<AlertDialogAction onClick={handleConfirmRebuild}>
							{t("history:indexTools.confirmProceed")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
			{/* Task Detail Modal */}
			<AlertDialog open={showTaskModal} onOpenChange={setShowTaskModal}>
				<AlertDialogContent className="w-[90vw] max-w-[800px] flex flex-col p-2">
					<AlertDialogHeader className="gap-0">
						<AlertDialogTitle className="text-vscode-editor-foreground antialiased mb-0 pb-0 text-base font-bold">
							{t("history:indexTools.taskDetails")}:{" "}
							{selectedTaskType === "tasksOnlyInGlobalState"
								? t("history:indexTools.missingTasks")
								: selectedTaskType === "tasksOnlyInTaskHistoryIndexes"
									? t("history:indexTools.fileIndexOnlyTasks")
									: selectedTaskType === "orphans"
										? t("history:indexTools.orphanedTasks")
										: t("history:indexTools.failedTasks")}
						</AlertDialogTitle>
						{selectedTaskForModal && (
							<div className="text-sm font-normal text-vscode-descriptionForeground mt-0 mb-0 py-0">
								<span className="font-medium">ID:</span> {selectedTaskForModal.id}
							</div>
						)}
					</AlertDialogHeader>

					{selectedTaskForModal && (
						<div className="space-y-1 mt-0">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm antialiased">
								<div className="space-y-1">
									<div className="grid grid-cols-[120px_1fr] gap-2">
										<span className="font-medium text-vscode-editor-foreground whitespace-nowrap">
											{t("history:indexTools.timestamp")}:
										</span>
										<span className="text-vscode-editor-foreground">
											{new Date(selectedTaskForModal.ts).toLocaleString()}
										</span>
									</div>
									<div className="grid grid-cols-[120px_1fr] gap-2">
										<span className="font-medium text-vscode-editor-foreground whitespace-nowrap">
											{t("history:indexTools.tokensIn")}:
										</span>
										<span className="text-vscode-editor-foreground">
											{selectedTaskForModal.tokensIn}
										</span>
									</div>
									<div className="grid grid-cols-[120px_1fr] gap-2">
										<span className="font-medium text-vscode-editor-foreground whitespace-nowrap">
											{t("history:indexTools.tokensOut")}:
										</span>
										<span className="text-vscode-editor-foreground">
											{selectedTaskForModal.tokensOut}
										</span>
									</div>
								</div>
								<div className="space-y-2">
									<div className="grid grid-cols-[120px_1fr] gap-2">
										<span className="font-medium text-vscode-editor-foreground whitespace-nowrap">
											{t("history:indexTools.totalCost")}:
										</span>
										<span className="text-vscode-editor-foreground">
											$
											{selectedTaskForModal.totalCost !== undefined
												? selectedTaskForModal.totalCost.toFixed(4)
												: "0.0000"}
										</span>
									</div>
									{selectedTaskForModal.workspace && (
										<div className="grid grid-cols-[120px_1fr] gap-2">
											<span className="font-medium text-vscode-editor-foreground whitespace-nowrap">
												{t("history:indexTools.workspace")}:
											</span>
											<span className="text-vscode-editor-foreground overflow-hidden text-ellipsis">
												{selectedTaskForModal.workspace}
											</span>
										</div>
									)}
								</div>
							</div>

							<div className="border-t border-vscode-sideBar-background pt-1">
								<h4 className="text-sm font-medium mb-1 text-vscode-editor-foreground antialiased">
									{t("history:indexTools.taskContent")}
								</h4>
								<div className="bg-vscode-editor-background p-0 rounded border border-vscode-panel-border">
									<div className="max-w-full overflow-x-auto">
										<CodeBlock
											source={selectedTaskForModal.task}
											language="markdown"
											collapsedHeight={300}
										/>
									</div>
								</div>
							</div>
						</div>
					)}

					<AlertDialogFooter>
						<AlertDialogCancel className="text-vscode-button-foreground bg-vscode-button-background hover:bg-vscode-button-hoverBackground border-vscode-button-border font-medium antialiased">
							{t("common:answers.close")}
						</AlertDialogCancel>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</React.Fragment>
	)
}
