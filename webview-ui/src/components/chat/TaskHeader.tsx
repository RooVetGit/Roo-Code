import { memo, useRef, useState, useCallback } from "react" // Added useCallback
import { useWindowSize } from "react-use"
import { useTranslation } from "react-i18next"
import { VSCodeBadge } from "@vscode/webview-ui-toolkit/react"
import { CloudUpload, CloudDownload, Eye, EyeOff } from "lucide-react" // Added Eye, EyeOff

import { ClineMessage } from "@roo/shared/ExtensionMessage"

import { getMaxTokensForModel } from "@src/utils/model-utils"
import { formatLargeNumber } from "@src/utils/format"
import { cn } from "@src/lib/utils"
import { Button } from "@src/components/ui"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useSelectedModel } from "@src/components/ui/hooks/useSelectedModel" // Corrected path

import Thumbnails from "../common/Thumbnails"

import { TaskActions } from "./TaskActions"
import { ContextWindowProgress } from "./ContextWindowProgress"
import { Mention } from "./Mention"
import CostTrendChart from "./CostTrendChart"

export interface TaskHeaderProps {
	task: ClineMessage
	tokensIn: number
	tokensOut: number
	doesModelSupportPromptCache: boolean
	cacheWrites?: number
	cacheReads?: number
	totalCost: number
	contextTokens: number
	onClose: () => void
	costHistory?: { requestIndex: number; cumulativeCost: number; costDelta: number }[]
}

const TaskHeader = ({
	task,
	tokensIn,
	tokensOut,
	doesModelSupportPromptCache,
	cacheWrites,
	cacheReads,
	totalCost,
	contextTokens,
	onClose,
	costHistory,
}: TaskHeaderProps) => {
	const { t } = useTranslation()
	const { apiConfiguration, currentTaskItem } = useExtensionState()
	const { info: model } = useSelectedModel(apiConfiguration)
	const [isTaskExpanded, setIsTaskExpanded] = useState(false)
	// State for chart hover details
	const [chartHoverData, setChartHoverData] = useState<{ isHovering: boolean; index?: number; cost?: number } | null>(
		null,
	)
	const [isChartVisible, setIsChartVisible] = useState(true) // State for chart visibility

	const textContainerRef = useRef<HTMLDivElement>(null)
	const textRef = useRef<HTMLDivElement>(null)
	const contextWindow = model?.contextWindow || 1

	const { width: windowWidth } = useWindowSize()

	// Callback for CostTrendChart hover changes
	const handleChartHoverChange = useCallback(
		(hoverData: { isHovering: boolean; index?: number; cost?: number } | null) => {
			setChartHoverData(hoverData)
		},
		[],
	) // Empty dependency array as setChartHoverData is stable

	const toggleChartVisibility = useCallback(() => {
		setIsChartVisible((prev) => !prev)
	}, [])

	// Removed console log

	return (
		<div className="py-2 px-3">
			<div
				className={cn(
					"rounded-xs p-2.5 flex flex-col gap-1.5 relative z-1 border",
					!!isTaskExpanded
						? "border-vscode-panel-border text-vscode-foreground"
						: "border-vscode-panel-border/80 text-vscode-foreground/80",
				)}>
				<div className="flex justify-between items-center gap-2">
					<div
						className="flex items-center cursor-pointer -ml-0.5 select-none grow min-w-0"
						onClick={() => setIsTaskExpanded(!isTaskExpanded)}>
						<div className="flex items-center shrink-0">
							<span className={`codicon codicon-chevron-${isTaskExpanded ? "down" : "right"}`}></span>
						</div>
						<div className="ml-1.5 whitespace-nowrap overflow-hidden text-ellipsis grow min-w-0">
							<span className="font-bold">
								{t("chat:task.title")}
								{!isTaskExpanded && ":"}
							</span>
							{!isTaskExpanded && (
								<span className="ml-1">
									<Mention text={task.text} />
								</span>
							)}
						</div>
					</div>
					<Button
						variant="ghost"
						size="icon"
						onClick={onClose}
						title={t("chat:task.closeAndStart")}
						className="shrink-0 w-5 h-5">
						<span className="codicon codicon-close" />
					</Button>
				</div>
				{/* Collapsed state: Track context and cost if we have any */}
				{!isTaskExpanded && contextWindow > 0 && (
					<div className={`w-full flex flex-row gap-1 h-auto`}>
						<ContextWindowProgress
							contextWindow={contextWindow}
							contextTokens={contextTokens || 0}
							maxTokens={getMaxTokensForModel(model, apiConfiguration)}
						/>
						{!!totalCost && <VSCodeBadge>${totalCost.toFixed(2)}</VSCodeBadge>}
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
							{isTaskExpanded && contextWindow > 0 && (
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
										maxTokens={getMaxTokensForModel(model, apiConfiguration)}
									/>
								</div>
							)}
							<div className="flex justify-between items-center h-[20px]">
								<div className="flex items-center gap-1 flex-wrap">
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
								{!totalCost && <TaskActions item={currentTaskItem} />}
							</div>

							{doesModelSupportPromptCache &&
								((typeof cacheReads === "number" && cacheReads > 0) ||
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
								<div className="flex justify-between items-center h-[20px]">
									<div className="flex items-center gap-1">
										<span className="font-bold">{t("chat:task.apiCost")}</span>
										<span>${totalCost?.toFixed(2)}</span>
									</div>
									<TaskActions item={currentTaskItem} />
								</div>
							)}

							{/* Cost Trend Chart */}
							{(() => {
								// console.log("TaskHeader costHistory:", costHistory);
								return (
									costHistory &&
									costHistory.length > 0 && (
										<div className="flex flex-col">
											{" "}
											{/* Removed mt-2, rely on parent gap-1 */}
											{/* Row for Title, Hover Data, and Actions */}
											<div className="flex justify-between items-center h-[20px]">
												{" "}
												{/* Match height and layout */}
												<div className="flex items-center gap-1">
													{" "}
													{/* Group title and hover data */}
													<span className="font-bold">Cost Chart:</span> {/* Updated title */}
													{/* Display hover data next to title */}
													{chartHoverData?.isHovering &&
														chartHoverData.cost !== undefined &&
														chartHoverData.index !== undefined && (
															<span>
																{" "}
																{/* Use plain span like API Cost value */}
																Request {chartHoverData.index}: $
																{chartHoverData.cost.toFixed(2)}{" "}
																{/* Updated hover text */}
															</span>
														)}
												</div>
												{/* Action Buttons Area */}
												<div className="flex items-center gap-1">
													{/* Visibility Toggle Button */}
													<Button
														variant="ghost"
														size="icon"
														onClick={toggleChartVisibility}
														title={
															isChartVisible
																? t("chat:task.hideChart")
																: t("chat:task.showChart")
														}
														className="shrink-0 w-5 h-5">
														{" "}
														{/* Removed margin adjustment */}
														{isChartVisible ? <EyeOff size={16} /> : <Eye size={16} />}
													</Button>
													{/* Other action buttons could go here */}
												</div>
											</div>
											{/* Chart Component - Conditionally Rendered */}
											{isChartVisible && (
												<CostTrendChart
													data={costHistory}
													onHoverChange={handleChartHoverChange}
												/>
											)}
										</div>
									)
								)
							})()}
						</div>
					</>
				)}
			</div>
		</div>
	)
}

export default memo(TaskHeader)
