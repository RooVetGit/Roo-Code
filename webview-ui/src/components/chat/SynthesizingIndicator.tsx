import React from "react"
import { cn } from "@/lib/utils"
import { useExtensionState } from "@/context/ExtensionStateContext"

/**
 * A component that displays the current status of context synthesizing
 */
export const SynthesizingIndicator: React.FC = () => {
	const { synthesizationStatus } = useExtensionState()

	if (!synthesizationStatus) {
		return null
	}

	return (
		<div
			className={cn(
				"flex items-center p-3 my-2 rounded-md transition-all duration-300",
				synthesizationStatus.status === "started"
					? "bg-vscode-inputValidation-infoBackground border border-vscode-inputValidation-infoBorder"
					: synthesizationStatus.status === "completed"
						? "bg-vscode-inputValidation-successBackground border border-vscode-inputValidation-successBorder"
						: "bg-vscode-inputValidation-errorBackground border border-vscode-inputValidation-errorBorder",
			)}>
			{synthesizationStatus.status === "started" && (
				<span className="codicon codicon-loading codicon-modifier-spin mr-2" />
			)}
			{synthesizationStatus.status === "completed" && <span className="codicon codicon-check mr-2" />}
			{synthesizationStatus.status === "failed" && <span className="codicon codicon-error mr-2" />}
			<span className="text-vscode-foreground">{synthesizationStatus.text}</span>
		</div>
	)
}

export default SynthesizingIndicator
