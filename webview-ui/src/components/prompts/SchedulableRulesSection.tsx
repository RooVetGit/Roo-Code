import React, { useState } from "react"
import { vscode } from "../../utils/vscode"

type SchedulableRule = {
	fileName: string
	displayInterval: string
	nextExecution: number
}

type SchedulableRulesSectionProps = {
	rules: SchedulableRule[]
}

const SchedulableRulesSection: React.FC<SchedulableRulesSectionProps> = ({ rules }) => {
	const [isExpanded, setIsExpanded] = useState(true)

	const formatTimeRemaining = (ms: number): string => {
		if (ms <= 0) return "Now"

		const seconds = Math.floor(ms / 1000)
		const minutes = Math.floor(seconds / 60)
		const hours = Math.floor(minutes / 60)
		const days = Math.floor(hours / 24)

		if (days > 0) return `${days}d ${hours % 24}h`
		if (hours > 0) return `${hours}h ${minutes % 60}m`
		if (minutes > 0) return `${minutes}m ${seconds % 60}s`
		return `${seconds}s`
	}

	if (rules.length === 0) return null

	return (
		<div className="py-5 border-b border-vscode-input-border">
			<div className="flex justify-between items-center mb-3">
				<div onClick={() => setIsExpanded(!isExpanded)} className="cursor-pointer flex items-center">
					<span className={`codicon codicon-${isExpanded ? "chevron-down" : "chevron-right"} mr-2`}></span>
					<h3 className="text-vscode-foreground m-0">Schedulable Rules</h3>
				</div>
			</div>

			{isExpanded && (
				<>
					<div className="text-sm text-vscode-descriptionForeground mb-3">
						Rules that are automatically applied at specified time intervals. Click a rule to edit it.
					</div>

					<div className="space-y-2">
						{rules.map((rule) => (
							<div
								key={rule.fileName}
								className="flex justify-between items-center p-2 hover:bg-vscode-list-hoverBackground rounded cursor-pointer"
								onClick={() => {
									vscode.postMessage({
										type: "openFile",
										text: `./${rule.fileName}`,
										values: {
											create: false,
										},
									})
								}}>
								<div>
									<div className="font-medium">{rule.fileName}</div>
									<div className="text-xs text-vscode-descriptionForeground">
										Every {rule.displayInterval}
									</div>
								</div>
								<div className="flex items-center">
									<span className="text-xs bg-vscode-badge-background text-vscode-badge-foreground rounded-full px-2 py-1">
										Next: {formatTimeRemaining(rule.nextExecution)}
									</span>
								</div>
							</div>
						))}
					</div>
				</>
			)}
		</div>
	)
}

export default SchedulableRulesSection
