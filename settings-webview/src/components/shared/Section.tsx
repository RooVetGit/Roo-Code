import { ReactNode } from "react"
import { cn } from "../../utils/tailwind"

interface SectionProps {
	children: ReactNode
	className?: string
}

export const Section = ({ children, className }: SectionProps) => {
	return (
		<div
			className={cn(
				"flex flex-col gap-4 p-4 bg-vscode-bg border border-vscode-panel-border rounded mb-6",
				className,
			)}>
			{children}
		</div>
	)
}
