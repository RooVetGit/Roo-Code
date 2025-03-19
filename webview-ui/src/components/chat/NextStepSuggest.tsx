import { useCallback, useRef, useState } from "react"
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Badge } from "../ui/badge"

interface NextStepSuggestProps {
	suggestions?: { task: string; mode: string; id?: string }[]
	onSuggestionClick?: (task: string, mode: string) => void
	ts: number
}

const NextStepSuggest = ({ suggestions = [], onSuggestionClick, ts = 1 }: NextStepSuggestProps) => {
	const [isExpanded, setIsExpanded] = useState(false)
	const buttonRef = useRef<HTMLButtonElement>(null)

	const handleSuggestionClick = useCallback(
		(suggestion: { task: string; mode: string }) => {
			onSuggestionClick?.(suggestion.task, suggestion.mode)
		},
		[onSuggestionClick],
	)

	const toggleExpand = useCallback(() => {
		setIsExpanded((prev) => !prev)

		// Use setTimeout to ensure the DOM has updated before scrolling
		setTimeout(() => {
			if (buttonRef.current) {
				// Use scrollIntoView to ensure the button is visible
				buttonRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" })
			}
		}, 100) // Increased timeout to ensure DOM updates
	}, [])

	// Don't render if there are no suggestions or no click handler
	if (!suggestions?.length || !onSuggestionClick) {
		return null
	}

	const displayedSuggestions = isExpanded ? suggestions : suggestions.slice(0, 1)

	return (
		<div className="h-full" aria-label="Next step suggestions">
			<div className="h-full scrollbar-thin scrollbar-thumb-vscode-scrollbarSlider-background scrollbar-track-transparent">
				<div className={cn("flex gap-2.5 pb-2 flex-col h-full")}>
					{displayedSuggestions.map((suggestion) => (
						<div key={`${suggestion.task}-${suggestion.mode}-${ts}`} className="w-full">
							<Button
								variant="ui-toolkit-primary-no-border"
								className={cn(
									"text-left",
									"focus:outline-none",
									"overflow-hidden",
									"w-full",
									"group h-full",
									"rounded-[3px]",
									"p-[9px] whitespace-pre-wrap break-words overflow-wrap-anywhere",
								)}
								onClick={() => handleSuggestionClick(suggestion)}
								aria-label={`Execute task: ${suggestion.task} in ${suggestion.mode} mode`}>
								<div className="relative h-full w-full">
									<div className="flex justify-between items-start gap-2.5 h-full w-full">
										<span className="block flex-grow p-1 whitespace-pre-wrap break-words overflow-wrap-anywhere w-full h-full pb-6">
											{suggestion.task}
										</span>
									</div>
									<Badge
										variant="toolkit-no-border"
										className="absolute bottom-0 right-2 text-[9px] uppercase tracking-wide font-medium py-0">
										{suggestion.mode}
									</Badge>
								</div>
							</Button>
						</div>
					))}
					{suggestions.length > 1 && (
						<Button
							ref={buttonRef}
							variant="ghost"
							size="sm"
							className="flex items-center gap-1"
							onClick={toggleExpand}
							aria-label={isExpanded ? "Show less suggestions" : "Show more suggestions"}>
							{isExpanded ? (
								<>
									<ChevronUp className="w-4 h-4" />
									Show Less
								</>
							) : (
								<>
									<ChevronDown className="w-4 h-4" />
									Show More ({suggestions.length - 1} more)
								</>
							)}
						</Button>
					)}
				</div>
			</div>
		</div>
	)
}

export default NextStepSuggest
