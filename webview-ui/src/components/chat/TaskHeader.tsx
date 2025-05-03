import { memo, useRef, useState } from "react"
import { useWindowSize } from "react-use"
// Remove TFunction import, it's not needed
import { VSCodeBadge, VSCodeButton } from "@vscode/webview-ui-toolkit/react" // Import VSCodeButton
import { CloudUpload, CloudDownload, Search } from "lucide-react" // Import Search icon

import { ClineMessage } from "@roo/shared/ExtensionMessage"

import { getMaxTokensForModel } from "@src/utils/model-utils"
import { formatLargeNumber } from "@src/utils/format"
import { cn } from "@src/lib/utils"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useSelectedModel } from "@/components/ui/hooks/useSelectedModel"

import Thumbnails from "../common/Thumbnails"

import { TaskActions } from "./TaskActions"
import { ContextWindowProgress } from "./ContextWindowProgress"
import { Mention } from "./Mention"

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
	toggleSearch: () => void // Renaming for clarity might be good later, but keep for now
	showSearch: boolean // Add showSearch state prop
	closeSearch: () => void // Add closeSearch function prop
	t: (key: string, options?: Record<string, any>) => string // Correct type for t function
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
	toggleSearch, // Keep this prop for now
	showSearch, // Destructure showSearch
	closeSearch, // Destructure closeSearch
	t, // Destructure t (use the passed one)
}: TaskHeaderProps) => {
	// Remove useTranslation hook as 't' is now passed as a prop
	// const { t } = useTranslation()
	const { apiConfiguration, currentTaskItem } = useExtensionState()
	const { info: model } = useSelectedModel(apiConfiguration)
	const [isTaskExpanded, setIsTaskExpanded] = useState(false)

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
					{/* Group Search and Close buttons */}
					<div className="flex items-center gap-1 shrink-0">
						{/* Updated Search Button Logic */}
						<VSCodeButton
							appearance="icon"
							onClick={showSearch ? closeSearch : toggleSearch} // Toggle behavior
							title={showSearch ? t("chat:search.close") : t("chat:search.title")} // Dynamic title
							aria-label={showSearch ? t("chat:search.close") : t("chat:search.title")} // Dynamic aria-label
						>
							{/* Reduce icon size for better proportion */}
							<Search size={10} />
						</VSCodeButton>
						{/* Close button removed as requested */}
					</div>
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
						</div>
					</>
				)}
			</div>
		</div>
	)
}

export default memo(TaskHeader)
