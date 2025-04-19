import { ReactNode } from "react"
import { cn } from "../../utils/tailwind"

interface CardProps {
	title?: string
	children: ReactNode
	className?: string
}

export const Card = ({ title, children, className }: CardProps) => {
	return (
		<div className={cn("bg-vscode-bg border border-vscode-panel-border rounded p-4 mb-4", className)}>
			{title && <h3 className="font-semibold text-lg mt-0 mb-3">{title}</h3>}
			{children}
		</div>
	)
}
