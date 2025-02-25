import { useCallback, useState } from "react"
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"
import { ChevronDown, ChevronUp } from "lucide-react"

interface NextStepSuggestProps {
	suggestions?: { task: string; mode: string; id?: string }[]
	onSuggestionClick?: (task: string, mode: string) => void
	ts: number
}

const NextStepSuggest = ({ suggestions = [], onSuggestionClick, ts = 1 }: NextStepSuggestProps) => {
	const [isExpanded, setIsExpanded] = useState(false)

	const handleSuggestionClick = useCallback(
		(suggestion: { task: string; mode: string }) => {
			onSuggestionClick?.(suggestion.task, suggestion.mode)
		},
		[onSuggestionClick],
	)

	const toggleExpand = useCallback(() => {
		setIsExpanded((prev) => !prev)
	}, [])

	// Don't render if there are no suggestions or no click handler
	if (!suggestions?.length || !onSuggestionClick) {
		return null
	}

	const displayedSuggestions = isExpanded ? suggestions : suggestions.slice(0, 1)

	return (
		<nav className="px-4 pt-2" aria-label="Next step suggestions" role="navigation">
			<div className="pr-4 max-h-[400px] scrollbar-thin scrollbar-thumb-vscode-scrollbarSlider-background scrollbar-track-transparent">
				<div className={cn("flex gap-2.5 pb-4 flex-col")}>
					{displayedSuggestions.map((suggestion) => (
						<div key={`${suggestion.task}-${suggestion.mode}-${ts}`} className="w-full">
							<Button
								variant="default"
								size="default"
								className={cn(
									"text-left transition-colors duration-200",
									"bg-vscode-button-background/80 text-vscode-button-foreground hover:bg-vscode-list-hoverBackground hover:text-vscode-list-hoverForeground",
									"focus:outline-none focus:ring-2 focus:ring-vscode-focusBorder",
									"shadow-sm hover:shadow-md shadow-vscode-widget-shadow/50",
									"rounded-lg overflow-hidden",
									"w-full",
									"min-h-[80px]",
									"group",
								)}
								onClick={() => handleSuggestionClick(suggestion)}
								aria-label={`Execute task: ${suggestion.task} in ${suggestion.mode} mode`}>
								<div className="flex flex-col justify-between h-full p-2">
									<div className="text-base font-normal break-words whitespace-normal leading-relaxed group-hover:text-vscode-button-foreground">
										{suggestion.task}
									</div>
									<div className="text-xs font-medium text-vscode-badge-foreground bg-vscode-badge-background inline-flex items-center px-2 py-1 rounded self-start group-hover:bg-vscode-button-hoverBackground/90 group-hover:text-vscode-button-foreground">
										{suggestion.mode} mode
									</div>
								</div>
							</Button>
						</div>
					))}
					{suggestions.length > 1 && (
						<Button
							variant="ghost"
							size="sm"
							className="text-vscode-textLink hover:text-vscode-textLink-foreground flex items-center gap-1"
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
		</nav>
	)
}

export default NextStepSuggest
