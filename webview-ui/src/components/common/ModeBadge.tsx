import React from "react"
import { findModeBySlug, getAllModes } from "@roo/modes"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { StandardTooltip } from "@/components/ui"
import { cn } from "@/lib/utils"

interface ModeBadgeProps {
	modeSlug?: string
	className?: string
}

export const ModeBadge: React.FC<ModeBadgeProps> = ({ modeSlug, className }) => {
	const { customModes } = useExtensionState()

	if (!modeSlug) {
		return null
	}

	// Get all modes (built-in + custom)
	const allModes = getAllModes(customModes)
	const mode = findModeBySlug(modeSlug, allModes)
	const displayName = mode?.name || modeSlug // Fallback to slug if mode deleted

	return (
		<StandardTooltip content={displayName}>
			<span
				className={cn(
					"inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
					"bg-vscode-badge-background text-vscode-badge-foreground",
					"max-w-[120px] truncate",
					className,
				)}>
				{displayName}
			</span>
		</StandardTooltip>
	)
}
