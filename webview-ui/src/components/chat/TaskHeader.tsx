import { memo, useRef, useState } from "react"
import { useWindowSize } from "react-use"
import { useTranslation } from "react-i18next"
import { CloudUpload, CloudDownload, FoldVertical, ChevronUp } from "lucide-react"
import prettyBytes from "pretty-bytes"

import type { ClineMessage } from "@roo-code/types"

import { getModelMaxOutputTokens } from "@roo/api"

import { formatLargeNumber } from "@src/utils/format"
import { cn } from "@src/lib/utils"
import { StandardTooltip } from "@src/components/ui"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useSelectedModel } from "@/components/ui/hooks/useSelectedModel"

import Thumbnails from "../common/Thumbnails"

import { TaskActions } from "./TaskActions"
import { ShareButton } from "./ShareButton"
import { ContextWindowProgress } from "./ContextWindowProgress"
import { Mention } from "./Mention"
import { TodoListDisplay } from "./TodoListDisplay"

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
	const { apiConfiguration, currentTaskItem } = useExtensionState()
	const { id: modelId, info: model } = useSelectedModel(apiConfiguration)
	const [isTaskExpanded, setIsTaskExpanded] = useState(false)

	const textContainerRef = useRef<HTMLDivElement>(null)
	const textRef = useRef<HTMLDivElement>(null)
	const contextWindow = model?.contextWindow || 1

	const { width: windowWidth } = useWindowSize()

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
					"p-2.5 flex flex-col gap-1.5 relative z-1 cursor-pointer",
					"bg-vscode-button-secondaryBackground hover:bg-vscode-button-secondaryBackground/90",
					"text-vscode-foreground/80 hover:text-vscode-foreground",
					"transition-colors duration-150",
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
							{isTaskExpanded && <span className="font-bold">Task Details</span>}
							{!isTaskExpanded && <Mention text={task.text} />}
						</div>
						{isTaskExpanded && (
							<div className="flex items-center shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
								<StandardTooltip content={t("chat:task.collapse")}>
									<button
										onClick={() => setIsTaskExpanded(false)}
										className="shrink-0 min-h-[20px] min-w-[20px] p-[2px] cursor-pointer opacity-85 hover:opacity-100 bg-transparent border-none rounded-md">
										<ChevronUp size={16} />
									</button>
								</StandardTooltip>
							</div>
						)}
					</div>
					{!isTaskExpanded && (
						<div className="share-button" onClick={(e) => e.stopPropagation()}>
							<ShareButton item={currentTaskItem} disabled={buttonsDisabled} />
						</div>
					)}
				</div>
				{!isTaskExpanded && contextWindow > 0 && (
					<div className="flex items-center gap-2 text-sm" onClick={(e) => e.stopPropagation()}>
						<span>
							{formatLargeNumber(contextTokens || 0)} / {formatLargeNumber(contextWindow)}
						</span>
						{!!totalCost && <span>${totalCost.toFixed(2)}</span>}
					</div>
				)}
				{/* Expanded state: Show task text and images */}
				{isTaskExpanded && (
					<>
						<div
							ref={textContainerRef}
							className="-mt-0.5 text-vscode-font-size overflow-y-auto break-words break-anywhere relative">
							<div
								ref={textRef}
								className="overflow-auto max-h-80 whitespace-pre-wrap break-words break-anywhere"
								style={{
									display: "-webkit-box",
									WebkitLineClamp: "unset",
									WebkitBoxOrient: "vertical",
								}}>
								<Mention text={task.text} />
							</div>
						</div>
						{task.images && task.images.length > 0 && <Thumbnails images={task.images} />}

						<div className="flex flex-col gap-1">
							{contextWindow > 0 && (
								<div
									className={`w-full flex ${windowWidth < 400 ? "flex-col" : "flex-row"} gap-1 h-auto`}>
									<div className="flex items-center gap-1 flex-shrink-0">
										<span className="font-bold" data-testid="context-window-label">
											{t("chat:task.contextWindow")}
										</span>
									</div>
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
							)}

							<div className="flex items-center gap-1 flex-wrap h-[20px]">
								<span className="font-bold">{t("chat:task.tokens")}</span>
								{typeof tokensIn === "number" && tokensIn > 0 && (
									<span className="flex items-center gap-0.5">
										<i className="codicon codicon-arrow-up text-xs font-bold" />
										{formatLargeNumber(tokensIn)}
									</span>
								)}
								{typeof tokensOut === "number" && tokensOut > 0 && (
									<span className="flex items-center gap-0.5">
										<i className="codicon codicon-arrow-down text-xs font-bold" />
										{formatLargeNumber(tokensOut)}
									</span>
								)}
							</div>

							{((typeof cacheReads === "number" && cacheReads > 0) ||
								(typeof cacheWrites === "number" && cacheWrites > 0)) && (
								<div className="flex items-center gap-1 flex-wrap h-[20px]">
									<span className="font-bold">{t("chat:task.cache")}</span>
									{typeof cacheWrites === "number" && cacheWrites > 0 && (
										<span className="flex items-center gap-0.5">
											<CloudUpload size={16} />
											{formatLargeNumber(cacheWrites)}
										</span>
									)}
									{typeof cacheReads === "number" && cacheReads > 0 && (
										<span className="flex items-center gap-0.5">
											<CloudDownload size={16} />
											{formatLargeNumber(cacheReads)}
										</span>
									)}
								</div>
							)}

							{!!totalCost && (
								<div className="flex items-center gap-1 h-[20px]">
									<span className="font-bold">{t("chat:task.apiCost")}</span>
									<span>${totalCost?.toFixed(2)}</span>
								</div>
							)}

							{/* Cache size display */}
							{((typeof cacheReads === "number" && cacheReads > 0) ||
								(typeof cacheWrites === "number" && cacheWrites > 0)) && (
								<div className="flex items-center gap-1 h-[20px]">
									<span className="font-bold">Cache size</span>
									<span className="text-xs text-vscode-foreground opacity-85">
										{prettyBytes(((cacheReads || 0) + (cacheWrites || 0)) * 4)}
									</span>
								</div>
							)}

							{/* Size display */}
							{!!currentTaskItem?.size && currentTaskItem.size > 0 && (
								<div className="flex items-center gap-1 h-[20px]">
									<span className="font-bold">Size</span>
									<span className="text-xs text-vscode-foreground opacity-85">
										{prettyBytes(currentTaskItem.size)}
									</span>
								</div>
							)}
						</div>

						{/* Footer with task management buttons */}
						<div
							className="border-t border-vscode-panel-border/50 pt-2 mt-2"
							onClick={(e) => e.stopPropagation()}>
							<TaskActions item={currentTaskItem} buttonsDisabled={buttonsDisabled} />
						</div>
					</>
				)}
			</div>
			<TodoListDisplay todos={todos ?? (task as any)?.tool?.todos ?? []} />
		</div>
	)
}

export default memo(TaskHeader)
