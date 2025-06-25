import * as React from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip"

interface StandardTooltipProps {
	children: React.ReactNode
	content: React.ReactNode
	side?: "top" | "right" | "bottom" | "left"
	align?: "start" | "center" | "end"
	sideOffset?: number
	className?: string
	asChild?: boolean
}

/**
 * StandardTooltip component that enforces consistent 300ms delay across the application.
 * This component wraps the Radix UI tooltip with a standardized delay duration.
 */
export function StandardTooltip({
	children,
	content,
	side = "top",
	align = "center",
	sideOffset = 4,
	className,
	asChild = true,
}: StandardTooltipProps) {
	return (
		<TooltipProvider delayDuration={300}>
			<Tooltip>
				<TooltipTrigger asChild={asChild}>{children}</TooltipTrigger>
				<TooltipContent side={side} align={align} sideOffset={sideOffset} className={className}>
					{content}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	)
}
