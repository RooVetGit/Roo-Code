import React, { useState } from "react"
import { Check, ChevronDown, Info, X } from "lucide-react"
import { cn } from "../../lib/utils"
import { useTranslation, Trans } from "react-i18next"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { CommandPattern } from "../../utils/commandPatterns"
import { StandardTooltip } from "../ui/standard-tooltip"

interface CommandPatternSelectorProps {
	patterns: CommandPattern[]
	allowedCommands: string[]
	deniedCommands: string[]
	onAllowPatternChange: (pattern: string) => void
	onDenyPatternChange: (pattern: string) => void
}

export const CommandPatternSelector: React.FC<CommandPatternSelectorProps> = ({
	patterns,
	allowedCommands,
	deniedCommands,
	onAllowPatternChange,
	onDenyPatternChange,
}) => {
	const { t } = useTranslation()
	const [isExpanded, setIsExpanded] = useState(false)

	const getPatternStatus = (pattern: string): "allowed" | "denied" | "none" => {
		if (allowedCommands.includes(pattern)) return "allowed"
		if (deniedCommands.includes(pattern)) return "denied"
		return "none"
	}

	return (
		<div className="border-t border-vscode-panel-border bg-vscode-sideBar-background/30">
			<button
				onClick={() => setIsExpanded(!isExpanded)}
				className="flex items-center gap-2 w-full px-3 py-2 text-xs text-vscode-descriptionForeground hover:text-vscode-foreground hover:bg-vscode-list-hoverBackground transition-all"
				aria-expanded={isExpanded}
				aria-label={t(
					isExpanded ? "chat:commandExecution.collapseManagement" : "chat:commandExecution.expandManagement",
				)}>
				<ChevronDown
					className={cn("size-3 transition-transform duration-200", {
						"rotate-0": isExpanded,
						"-rotate-90": !isExpanded,
					})}
				/>
				<span className="font-medium">{t("chat:commandExecution.manageCommands")}</span>
				<StandardTooltip
					content={
						<Trans
							i18nKey="chat:commandExecution.commandManagementDescription"
							components={{
								settingsLink: (
									<VSCodeLink
										href="#"
										onClick={(e) => {
											e.preventDefault()
											window.postMessage(
												{
													type: "action",
													action: "settingsButtonClicked",
													values: { section: "autoApprove" },
												},
												"*",
											)
										}}
										className="inline"
									/>
								),
							}}
						/>
					}>
					<Info className="size-3 ml-1" />
				</StandardTooltip>
			</button>

			{isExpanded && (
				<div className="px-3 pb-3 space-y-2">
					{patterns.map((item, index) => {
						const status = getPatternStatus(item.pattern)
						return (
							<div key={`${item.pattern}-${index}`} className="ml-5 flex items-center gap-2">
								<div className="flex-1">
									<span className="font-mono text-xs text-vscode-foreground">{item.pattern}</span>
									{item.description && (
										<span className="text-xs text-vscode-descriptionForeground ml-2">
											- {item.description}
										</span>
									)}
								</div>
								<div className="flex items-center gap-1">
									<button
										className={cn("p-1 rounded transition-all", {
											"bg-green-500/20 text-green-500 hover:bg-green-500/30":
												status === "allowed",
											"text-vscode-descriptionForeground hover:text-green-500 hover:bg-green-500/10":
												status !== "allowed",
										})}
										onClick={() => onAllowPatternChange(item.pattern)}
										aria-label={t(
											status === "allowed"
												? "chat:commandExecution.removeFromAllowed"
												: "chat:commandExecution.addToAllowed",
										)}>
										<Check className="size-3.5" />
									</button>
									<button
										className={cn("p-1 rounded transition-all", {
											"bg-red-500/20 text-red-500 hover:bg-red-500/30": status === "denied",
											"text-vscode-descriptionForeground hover:text-red-500 hover:bg-red-500/10":
												status !== "denied",
										})}
										onClick={() => onDenyPatternChange(item.pattern)}
										aria-label={t(
											status === "denied"
												? "chat:commandExecution.removeFromDenied"
												: "chat:commandExecution.addToDenied",
										)}>
										<X className="size-3.5" />
									</button>
								</div>
							</div>
						)
					})}
				</div>
			)}
		</div>
	)
}
