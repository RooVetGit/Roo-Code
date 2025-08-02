import React from "react"
import { getModeBySlug } from "../../../../src/shared/modes"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { Badge } from "@/components/ui/badge"
import { StandardTooltip } from "@/components/ui/standard-tooltip"

export interface ModeBadgeProps {
	modeSlug: string
	className?: string
}

/**
 * ModeBadge component displays a badge showing the mode name for a given mode slug.
 * It handles cases where the mode is undefined or deleted gracefully.
 * For long mode names, it truncates with ellipsis and shows full name in tooltip.
 */
const ModeBadge: React.FC<ModeBadgeProps> = ({ modeSlug, className }) => {
	const { customModes } = useExtensionState()

	// Get mode details using the existing getModeBySlug function
	const mode = getModeBySlug(modeSlug, customModes)

	// If mode is not found, don't render anything
	if (!mode) {
		return null
	}

	// Extract just the mode name (without emoji if present)
	// Mode names can be like "💻 Code" or just "Code"
	const modeName = mode.name

	// For very long mode names, we'll let CSS handle truncation
	const badgeContent = (
		<Badge
			variant="outline"
			className={`text-xs font-medium max-w-24 truncate ${className || ""}`}
			title={modeName} // Fallback tooltip
		>
			{modeName}
		</Badge>
	)

	// If the mode name is longer than ~20 characters, wrap with tooltip
	if (modeName.length > 20) {
		return <StandardTooltip content={modeName}>{badgeContent}</StandardTooltip>
	}

	return badgeContent
}

export default ModeBadge
