import { ReactNode } from "react"
import { cn } from "../../utils/tailwind"

interface SectionHeaderProps {
	children: ReactNode
	description?: string
	className?: string
}

export const SectionHeader = ({ children, description, className }: SectionHeaderProps) => {
	return (
		<div className={cn("sticky top-0 z-10 bg-vscode-bg mb-2", className)}>
			<h4 className="text-lg font-semibold m-0">{children}</h4>
			{description && <p className="text-vscode-description-fg text-sm mt-1 mb-0">{description}</p>}
		</div>
	)
}
