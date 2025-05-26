import React from "react"
import { cn } from "@/lib/utils"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@src/components/ui/accordion"

interface ExpandableSectionProps {
	title: string
	children: React.ReactNode
	className?: string
	defaultExpanded?: boolean
	badge?: string
	matched?: boolean
}

export const ExpandableSection: React.FC<ExpandableSectionProps> = ({
	title,
	children,
	className,
	defaultExpanded = false,
	badge,
	matched = false,
}) => {
	// Create a unique value for the accordion item
	const accordionValue = React.useMemo(() => `section-${title.replace(/\s+/g, "-").toLowerCase()}`, [title])

	return (
		<Accordion
			type="single"
			collapsible
			defaultValue={defaultExpanded ? accordionValue : undefined}
			className={cn("border-t-0", className, {
				"bg-vscode-list-activeSelectionBackground": matched,
			})}>
			<AccordionItem value={accordionValue}>
				<AccordionTrigger
					className="py-2 text-sm hover:no-underline hover:cursor-pointer"
					aria-controls="details-content"
					id="details-button">
					<div className="flex items-center gap-2 w-full">
						<span className="font-medium flex items-center">
							<span className="codicon codicon-list-unordered mr-1"></span>
							{title}
						</span>
						{badge && (
							<span className="text-xs bg-primary text-primary-foreground px-1 py-0.5 rounded">
								{badge}
							</span>
						)}
					</div>
				</AccordionTrigger>
				<AccordionContent id="details-content" className="pt-0" role="region" aria-labelledby="details-button">
					{children}
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	)
}
