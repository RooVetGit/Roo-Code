import { ReactNode } from "react"
import { cn } from "../../utils/tailwind"

/**
 * Props for the Section component.
 * @interface SectionProps
 * @property {ReactNode} children - The content to be rendered inside the section.
 * @property {string} [className] - Optional additional CSS classes for the section.
 */
interface SectionProps {
	children: ReactNode
	className?: string
}

/**
 * A reusable Section component that wraps its children in a styled container.
 * @param {SectionProps} props - The props for the Section component.
 * @returns {JSX.Element} A div element containing the section content.
 */
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
