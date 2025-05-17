import { memo } from "react"

import { vscode } from "@/utils/vscode"
import { formatLargeNumber, formatDate } from "@/utils/format"
import { useExtensionState } from "@/context/ExtensionStateContext"

import { CopyButton } from "./CopyButton"
import { useTaskSearch, HierarchicalHistoryItem } from "./useTaskSearch" // Updated import

import { Coins, ChevronRight } from "lucide-react" // Added ChevronRight for children indicator

const HistoryPreview = () => {
	const { tasks, showAllWorkspaces } = useTaskSearch()
	useExtensionState()

	return (
		<>
			<div className="flex flex-col gap-3">
				{tasks.length !== 0 && (
					<>
						{tasks.slice(0, 3).map((item: HierarchicalHistoryItem) => {
							// Use the completed flag directly from the item
							const isTaskMarkedCompleted = item.completed ?? false
							return (
								<div
									key={item.id}
									className="bg-vscode-editor-background rounded relative overflow-hidden cursor-pointer border border-vscode-toolbar-hoverBackground/30 hover:border-vscode-toolbar-hoverBackground/60"
									onClick={() => vscode.postMessage({ type: "showTaskWithId", text: item.id })}>
									<div className="flex flex-col gap-2 p-3 pt-1">
										<div className="flex justify-between items-center">
											<div className="flex items-center">
												{item.children && item.children.length > 0 && (
													<ChevronRight className="inline-block size-3 mr-1 text-vscode-descriptionForeground" />
												)}
												<span className="text-xs font-medium text-vscode-descriptionForeground uppercase">
													{formatDate(item.ts)}
												</span>
											</div>
											<CopyButton itemTask={item.task} />
										</div>
										<div
											className="overflow-hidden whitespace-pre-wrap"
											style={{
												color: isTaskMarkedCompleted
													? "var(--vscode-testing-iconPassed)"
													: "var(--vscode-foreground)",
												display: "-webkit-box",
												WebkitLineClamp: 2,
												WebkitBoxOrient: "vertical",
												wordBreak: "break-word",
												overflowWrap: "anywhere",
											}}
											dangerouslySetInnerHTML={{ __html: item.task }} // Use dangerouslySetInnerHTML if task contains HTML
										/>
										<div className="flex flex-row gap-2 text-xs text-vscode-descriptionForeground">
											<span>↑ {formatLargeNumber(item.tokensIn || 0)}</span>
											<span>↓ {formatLargeNumber(item.tokensOut || 0)}</span>
											{!!item.totalCost && (
												<span>
													<Coins className="inline-block size-[1em]" />{" "}
													{"$" + item.totalCost?.toFixed(2)}
												</span>
											)}
										</div>
										{showAllWorkspaces && item.workspace && (
											<div className="flex flex-row gap-1 text-vscode-descriptionForeground text-xs mt-1">
												<span className="codicon codicon-folder scale-80" />
												<span>{item.workspace}</span>
											</div>
										)}
									</div>
								</div>
							)
						})}
					</>
				)}
			</div>
		</>
	)
}

export default memo(HistoryPreview)
