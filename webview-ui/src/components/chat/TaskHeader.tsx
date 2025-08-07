import { memo, useRef, useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { FoldVertical, ChevronUp, ChevronDown, Router } from "lucide-react"
import prettyBytes from "pretty-bytes"

import type { ClineMessage } from "@roo-code/types"

import { getModelMaxOutputTokens } from "@roo/api"

import { formatLargeNumber } from "@src/utils/format"
import { cn } from "@src/lib/utils"
import { StandardTooltip } from "@src/components/ui"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useSelectedModel } from "@/components/ui/hooks/useSelectedModel"
import { vscode } from "@src/utils/vscode"

import Thumbnails from "../common/Thumbnails"

import { TaskActions } from "./TaskActions"
import { ContextWindowProgress } from "./ContextWindowProgress"
import { Mention } from "./Mention"
import { TodoListDisplay } from "./TodoListDisplay"
import { CloudNotificationBanner } from "./CloudNotificationBanner"

export interface TaskHeaderProps {
	task: ClineMessage
	tokensIn: number
	tokensOut: number
	cacheWrites?: number
	cacheReads?: number
	totalCost: number
	contextTokens: number
	buttonsDisabled: boolean
	handleCondenseContext: (taskId: string) => void
	todos?: any[]
}

const TaskHeader = ({
	task,
	tokensIn,
	tokensOut,
	cacheWrites,
	cacheReads,
	totalCost,
	contextTokens,
	buttonsDisabled,
	handleCondenseContext,
	todos,
}: TaskHeaderProps) => {
	const { t } = useTranslation()
	const { apiConfiguration, currentTaskItem, dismissedCloudNotifications, addDismissedCloudNotification } =
		useExtensionState()
	const { id: modelId, info: model } = useSelectedModel(apiConfiguration)
	const [isTaskExpanded, setIsTaskExpanded] = useState(false)
	const [showCloudNotification, setShowCloudNotification] = useState(false)

	const textContainerRef = useRef<HTMLDivElement>(null)
	const textRef = useRef<HTMLDivElement>(null)
	const contextWindow = model?.contextWindow || 1

	// Task duration tracking
	useEffect(() => {
		const taskId = currentTaskItem?.id
		if (!taskId) return

		const interval = setInterval(() => {
			const duration = Date.now() - task.ts
			const threshold = 2 * 60 * 1000 // 2 minutes

			// Show notification if task has been running for more than 2 minutes
			// and hasn't been dismissed for this task

			const shouldShow = duration > threshold && !dismissedCloudNotifications.has(taskId) && buttonsDisabled
			setShowCloudNotification(shouldShow)
		}, 1000)

		return () => clearInterval(interval)
	}, [task.ts, currentTaskItem?.id, dismissedCloudNotifications, buttonsDisabled])

	const handleDismissCloudNotification = () => {
		if (currentTaskItem?.id) {
			addDismissedCloudNotification(currentTaskItem.id)
		}
		setShowCloudNotification(false)
	}

	const condenseButton = (
		<StandardTooltip content={t("chat:task.condenseContext")}>
			<button
				disabled={buttonsDisabled}
				onClick={() => currentTaskItem && handleCondenseContext(currentTaskItem.id)}
				className="shrink-0 min-h-[20px] min-w-[20px] p-[2px] cursor-pointer disabled:cursor-not-allowed opacity-85 hover:opacity-100 bg-transparent border-none rounded-md">
				<FoldVertical size={16} />
			</button>
		</StandardTooltip>
	)

	const hasTodos = todos && Array.isArray(todos) && todos.length > 0

	return (
		<div className="pt-2 pb-0 px-3">
			<div
				className={cn(
					"px-2.5 pt-2.5 pb-2 flex flex-col gap-1.5 relative z-1 cursor-pointer",
					"bg-vscode-input-background hover:bg-vscode-input-background/90",
					"text-vscode-foreground/80 hover:text-vscode-foreground",
					hasTodos ? "rounded-t-xs border-b-0" : "rounded-xs",
				)}
				onClick={(e) => {
					// Don't expand if clicking on buttons or interactive elements
					if (
						e.target instanceof Element &&
						(e.target.closest("button") ||
							e.target.closest('[role="button"]') ||
							e.target.closest(".share-button") ||
							e.target.closest("[data-radix-popper-content-wrapper]") ||
							e.target.closest("img") ||
							e.target.tagName === "IMG")
					) {
						return
					}

					// Don't expand/collapse if user is selecting text
					const selection = window.getSelection()
					if (selection && selection.toString().length > 0) {
						return
					}

					setIsTaskExpanded(!isTaskExpanded)
				}}>
				<div className="flex justify-between items-center gap-0">
					<div className="flex items-center select-none grow min-w-0">
						<div className="whitespace-nowrap overflow-hidden text-ellipsis grow min-w-0">
							{isTaskExpanded && <span className="font-bold">{t("chat:task.title")}</span>}
							{!isTaskExpanded && (
								<div>
									<span className="font-bold mr-1">{t("chat:task.title")}</span>
									<Mention text={task.text} />
								</div>
							)}
						</div>
						<div className="flex items-center shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
							<StandardTooltip content={isTaskExpanded ? t("chat:task.collapse") : t("chat:task.expand")}>
								<button
									onClick={() => setIsTaskExpanded(!isTaskExpanded)}
									className="shrink-0 min-h-[20px] min-w-[20px] p-[2px] cursor-pointer opacity-85 hover:opacity-100 bg-transparent border-none rounded-md">
									{isTaskExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
								</button>
							</StandardTooltip>
						</div>
					</div>
				</div>
				{!isTaskExpanded && contextWindow > 0 && (
					<div className="flex items-center gap-2 text-sm" onClick={(e) => e.stopPropagation()}>
						<StandardTooltip
							content={
								<div className="space-y-1">
									<div>
										{t("chat:tokenProgress.tokensUsed", {
											used: formatLargeNumber(contextTokens || 0),
											total: formatLargeNumber(contextWindow),
										})}
									</div>
									{(() => {
										const maxTokens = model
											? getModelMaxOutputTokens({ modelId, model, settings: apiConfiguration })
											: 0
										const reservedForOutput = maxTokens || 0
										const availableSpace = contextWindow - (contextTokens || 0) - reservedForOutput

										return (
											<>
												{reservedForOutput > 0 && (
													<div>
														{t("chat:tokenProgress.reservedForResponse", {
															amount: formatLargeNumber(reservedForOutput),
														})}
													</div>
												)}
												{availableSpace > 0 && (
													<div>
														{t("chat:tokenProgress.availableSpace", {
															amount: formatLargeNumber(availableSpace),
														})}
													</div>
												)}
											</>
										)
									})()}
								</div>
							}
							side="top"
							sideOffset={8}>
							<span className="mr-1">
								{formatLargeNumber(contextTokens || 0)} / {formatLargeNumber(contextWindow)}
							</span>
						</StandardTooltip>
						{!!totalCost && <span>${totalCost.toFixed(2)}</span>}
						<div className="flex flex-grow justify-end gap-1 pr-0">
							<StandardTooltip content="Continue in Cloud from anywhere">
								<button
									onClick={() => vscode.postMessage({ type: "switchTab", tab: "account" })}
									className="shrink-0 min-h-[20px] min-w-[20px] p-[2px] cursor-pointer opacity-85 hover:opacity-100 bg-transparent border-none rounded-md">
									<Router size={14} />
								</button>
							</StandardTooltip>
						</div>
					</div>
				)}
				{/* Expanded state: Show task text and images */}
				{isTaskExpanded && (
					<>
						<div
							ref={textContainerRef}
							className="text-vscode-font-size overflow-y-auto break-words break-anywhere relative">
							<div
								ref={textRef}
								className="overflow-auto max-h-80 whitespace-pre-wrap break-words break-anywhere cursor-text"
								style={{
									display: "-webkit-box",
									WebkitLineClamp: "unset",
									WebkitBoxOrient: "vertical",
								}}>
								<Mention text={task.text} />
							</div>
						</div>
						{task.images && task.images.length > 0 && <Thumbnails images={task.images} />}

						<div className="border-t border-b border-vscode-panel-border/50 py-4 mt-2 mb-1">
							<table className="w-full">
								<tbody>
									{contextWindow > 0 && (
										<tr>
											<th
												className="font-bold text-left align-top w-1 whitespace-nowrap pl-1 pr-3 h-[24px]"
												data-testid="context-window-label">
												{t("chat:task.contextWindow")}
											</th>
											<td className="align-top">
												<div className={`max-w-80 -mt-0.5 flex flex-nowrap gap-1`}>
													<ContextWindowProgress
														contextWindow={contextWindow}
														contextTokens={contextTokens || 0}
														maxTokens={
															model
																? getModelMaxOutputTokens({
																		modelId,
																		model,
																		settings: apiConfiguration,
																	})
																: undefined
														}
													/>
													{condenseButton}
												</div>
											</td>
										</tr>
									)}

									<tr>
										<th className="font-bold text-left align-top w-1 whitespace-nowrap pl-1 pr-3 h-[24px]">
											{t("chat:task.tokens")}
										</th>
										<td className="align-top">
											<div className="flex items-center gap-1 flex-wrap">
												{typeof tokensIn === "number" && tokensIn > 0 && (
													<span>↑ {formatLargeNumber(tokensIn)}</span>
												)}
												{typeof tokensOut === "number" && tokensOut > 0 && (
													<span>↓ {formatLargeNumber(tokensOut)}</span>
												)}
											</div>
										</td>
									</tr>

									{((typeof cacheReads === "number" && cacheReads > 0) ||
										(typeof cacheWrites === "number" && cacheWrites > 0)) && (
										<tr>
											<th className="font-bold text-left align-top w-1 whitespace-nowrap pl-1 pr-3 h-[24px]">
												{t("chat:task.cache")}
											</th>
											<td className="align-top">
												<div className="flex items-center gap-1 flex-wrap">
													{typeof cacheWrites === "number" && cacheWrites > 0 && (
														<span>↑ {formatLargeNumber(cacheWrites)}</span>
													)}
													{typeof cacheReads === "number" && cacheReads > 0 && (
														<span>↓ {formatLargeNumber(cacheReads)}</span>
													)}
												</div>
											</td>
										</tr>
									)}

									{!!totalCost && (
										<tr>
											<th className="font-bold text-left align-top w-1 whitespace-nowrap pl-1 pr-3 h-[24px]">
												{t("chat:task.apiCost")}
											</th>
											<td className="align-top">
												<span>${totalCost?.toFixed(2)}</span>
											</td>
										</tr>
									)}

									{/* Cache size display */}
									{((typeof cacheReads === "number" && cacheReads > 0) ||
										(typeof cacheWrites === "number" && cacheWrites > 0)) && (
										<tr>
											<th className="font-bold text-left align-top w-1 whitespace-nowrap pl-1 pr-3 h-[24px]">
												{t("chat:task.cache")}
											</th>
											<td className="align-top">
												{prettyBytes(((cacheReads || 0) + (cacheWrites || 0)) * 4)}
											</td>
										</tr>
									)}

									{/* Size display */}
									{!!currentTaskItem?.size && currentTaskItem.size > 0 && (
										<tr>
											<th className="font-bold text-left align-top w-1 whitespace-nowrap pl-1 pr-2  h-[20px]">
												{t("chat:task.size")}
											</th>
											<td className="align-top">{prettyBytes(currentTaskItem.size)}</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>

						{/* Footer with task management buttons */}
						<div onClick={(e) => e.stopPropagation()}>
							<TaskActions
								item={currentTaskItem}
								buttonsDisabled={buttonsDisabled}
								showCloudNotification={showCloudNotification}
							/>
						</div>
					</>
				)}
			</div>

			{/* Cloud notification banner */}
			{showCloudNotification && <CloudNotificationBanner onDismiss={handleDismissCloudNotification} />}

			<TodoListDisplay todos={todos ?? (task as any)?.tool?.todos ?? []} />
		</div>
	)
}

export default memo(TaskHeader)
