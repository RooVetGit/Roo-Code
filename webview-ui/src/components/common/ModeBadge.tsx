import React from "react"
import { getModeBySlug } from "@roo/modes"
import { Badge } from "@/components/ui/badge"
import { StandardTooltip } from "@/components/ui"
import { cn } from "@/lib/utils"
import { useExtensionState } from "@/context/ExtensionStateContext"

interface ModeBadgeProps {
	modeSlug: string | undefined
	className?: string
}

export const ModeBadge: React.FC<ModeBadgeProps> = ({ modeSlug, className }) => {
	const { customModes } = useExtensionState()

	if (!modeSlug) {
		return null
	}

	const mode = getModeBySlug(modeSlug, customModes)

	// If mode is not found (e.g., deleted custom mode), show the slug as fallback
	const displayName = mode?.name || modeSlug

	// Truncate long mode names
	const truncatedName = displayName.length > 20 ? `${displayName.substring(0, 17)}...` : displayName

	return (
		<StandardTooltip content={displayName}>
			<Badge
				variant="outline"
				className={cn(
					"text-xs font-normal px-1.5 py-0 h-5",
					"bg-vscode-badge-background text-vscode-badge-foreground",
					"border-vscode-badge-background",
					className,
				)}>
				{truncatedName}
			</Badge>
		</StandardTooltip>
	)
}
