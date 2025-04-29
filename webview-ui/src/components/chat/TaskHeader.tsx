import { memo, useRef, useState, useCallback } from "react" // Import useCallback
import { useWindowSize } from "react-use"
import { useTranslation } from "react-i18next"
import { CloudUpload, CloudDownload } from "lucide-react"

import { ClineMessage } from "@roo/shared/ExtensionMessage"

import { getMaxTokensForModel } from "@src/utils/model-utils"
import { formatLargeNumber } from "@src/utils/format"
import { cn } from "@src/lib/utils"
import { Button } from "@src/components/ui"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useSelectedModel } from "@/components/ui/hooks/useSelectedModel"

import Thumbnails from "../common/Thumbnails"

import { TaskActions } from "./TaskActions"
import { ContextWindowProgress } from "./ContextWindowProgress"
import { Mention } from "./Mention"
import CostTrendChart from "./CostTrendChart"
import CostSparkline from "./CostSparkline" // Import the sparkline component

// Define the structure for cost history data points (matching CostTrendChart)
interface CostHistoryDataPoint {
	requestIndex: number
	cumulativeCost: number
	costDelta: number
}

// Define the type for the view mode
export type CostViewMode = "cumulative" | "task"

export interface TaskHeaderProps {
	task: ClineMessage
	tokensIn: number
	tokensOut: number
	doesModelSupportPromptCache: boolean
	cacheWrites?: number
	cacheReads?: number
	totalCost: number
	costHistory: CostHistoryDataPoint[] // Add the new prop type
	contextTokens: number
	onClose: () => void
}

const TaskHeader = ({
	task,
	tokensIn,
	tokensOut,
	doesModelSupportPromptCache,
	cacheWrites,
	cacheReads,
	totalCost,
	costHistory, // Destructure the new prop
	contextTokens,
	onClose,
}: TaskHeaderProps) => {
	const { t } = useTranslation()
	const { apiConfiguration, currentTaskItem } = useExtensionState()
	const { info: model } = useSelectedModel(apiConfiguration)
	const [isTaskExpanded, setIsTaskExpanded] = useState(false)
	// Lift state up: Manage view mode here
	const [costViewMode, setCostViewMode] = useState<CostViewMode>("cumulative")

	// Callback to update the view mode
	const handleCostViewModeChange = useCallback((newMode: CostViewMode) => {
		setCostViewMode(newMode)
	}, [])

	const textContainerRef = useRef<HTMLDivElement>(null)
	const textRef = useRef<HTMLDivElement>(null)
	const contextWindow = model?.contextWindow || 1

	const { width: windowWidth } = useWindowSize()

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
					<div className={`w-full flex flex-row items-center gap-1 h-auto`}>
						{" "}
						{/* Added items-center */}
						<ContextWindowProgress
							contextWindow={contextWindow}
							contextTokens={contextTokens || 0}
							maxTokens={getMaxTokensForModel(model, apiConfiguration)}
						/>
						{/* Cost Display */}
						<div className="flex items-center gap-1 ml-auto rounded-md px-1 py-0.5">
							{" "}
							{/* Removed border classes */}
							{/* Add Sparkline back - Pass viewMode */}
							{costHistory && costHistory.length > 1 && (
								<CostSparkline data={costHistory} height={16} width={35} viewMode={costViewMode} />
							)}
							{/* Apply default foreground color and remove explicit size */}
							{!!totalCost && (
								<span className="text-[var(--vscode-foreground)]">${totalCost.toFixed(2)}</span>
							)}
						</div>
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
							{/* Render the cost trend chart if history is available - Pass state and handler */}
							{costHistory && costHistory.length > 0 && (
								<div className="mt-2">
									{" "}
									{/* Add some margin */}
									<CostTrendChart
										data={costHistory}
										costThreshold={2.0}
										viewMode={costViewMode}
										onViewModeChange={handleCostViewModeChange}
									/>
								</div>
							)}
						</div>
					</>
				)}
			</div>
		</div>
	)
}

export default memo(TaskHeader)
