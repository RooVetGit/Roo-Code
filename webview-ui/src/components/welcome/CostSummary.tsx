import React, { useState, useEffect } from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { UsageSummary } from "@roo-code/types"
import { vscode } from "@src/utils/vscode"

interface CostSummaryProps {
	usageData?: {
		all: UsageSummary
		current: UsageSummary
	}
}

const CostSummary: React.FC<CostSummaryProps> = ({ usageData }) => {
	const [viewMode, setViewMode] = useState<"all" | "current">("all")

	// Request usage data on mount
	useEffect(() => {
		vscode.postMessage({ type: "requestPersistentUsageData" })
	}, [])

	if (!usageData) {
		return (
			<div className="cost-summary-card border border-vscode-panel-border rounded-lg p-4 mb-4">
				<h3 className="text-lg font-semibold mb-3">AI Inference Summary</h3>
				<div className="text-vscode-descriptionForeground">Loading usage data...</div>
			</div>
		)
	}

	const currentData = viewMode === "all" ? usageData.all : usageData.current
	const workspaceName = viewMode === "current" ? usageData.current.workspaceName : "All Workspaces"

	// Format currency
	const formatCost = (cost: number) => {
		return `$${cost.toFixed(4)}`
	}

	// Format large numbers with commas
	const formatNumber = (num: number) => {
		return num.toLocaleString()
	}

	return (
		<div className="cost-summary-card border border-vscode-panel-border rounded-lg p-4 mb-4">
			<div className="flex justify-between items-center mb-3">
				<h3 className="text-lg font-semibold">AI Inference Summary</h3>
				<div className="flex gap-2">
					<VSCodeButton
						appearance={viewMode === "current" ? "primary" : "secondary"}
						onClick={() => setViewMode("current")}
						className="text-xs">
						Current
					</VSCodeButton>
					<VSCodeButton
						appearance={viewMode === "all" ? "primary" : "secondary"}
						onClick={() => setViewMode("all")}
						className="text-xs">
						All
					</VSCodeButton>
				</div>
			</div>

			<div className="text-sm text-vscode-descriptionForeground mb-3">{workspaceName}</div>

			{/* Total Summary */}
			<div className="grid grid-cols-2 gap-4 mb-4">
				<div>
					<div className="text-xs text-vscode-descriptionForeground">Total Cost</div>
					<div className="text-xl font-bold">{formatCost(currentData.totalCost)}</div>
				</div>
				<div>
					<div className="text-xs text-vscode-descriptionForeground">Total Tokens</div>
					<div className="text-xl font-bold">
						{formatNumber(currentData.totalInputTokens + currentData.totalOutputTokens)}
					</div>
				</div>
			</div>

			{/* Token Breakdown */}
			<div className="grid grid-cols-2 gap-2 mb-4 text-sm">
				<div>
					<span className="text-vscode-descriptionForeground">Input: </span>
					<span>{formatNumber(currentData.totalInputTokens)}</span>
				</div>
				<div>
					<span className="text-vscode-descriptionForeground">Output: </span>
					<span>{formatNumber(currentData.totalOutputTokens)}</span>
				</div>
				{(currentData.totalCacheReads > 0 || currentData.totalCacheWrites > 0) && (
					<>
						<div>
							<span className="text-vscode-descriptionForeground">Cache Reads: </span>
							<span>{formatNumber(currentData.totalCacheReads)}</span>
						</div>
						<div>
							<span className="text-vscode-descriptionForeground">Cache Writes: </span>
							<span>{formatNumber(currentData.totalCacheWrites)}</span>
						</div>
					</>
				)}
			</div>

			{/* Mode Breakdown */}
			{Object.keys(currentData.modeBreakdown).length > 0 && (
				<div>
					<div className="text-xs text-vscode-descriptionForeground mb-2">Breakdown by Mode</div>
					<div className="space-y-2">
						{Object.entries(currentData.modeBreakdown)
							.sort(([, a], [, b]) => b.cost - a.cost)
							.map(([mode, data]) => (
								<div key={mode} className="flex justify-between items-center text-sm">
									<div className="flex items-center gap-2">
										<span className="capitalize">{mode}</span>
										<span className="text-xs text-vscode-descriptionForeground">
											({data.count} task{data.count !== 1 ? "s" : ""})
										</span>
									</div>
									<div className="flex gap-4">
										<span>{formatCost(data.cost)}</span>
										<span className="text-vscode-descriptionForeground">
											{formatNumber(data.inputTokens + data.outputTokens)} tokens
										</span>
									</div>
								</div>
							))}
					</div>
				</div>
			)}
		</div>
	)
}

export default CostSummary
