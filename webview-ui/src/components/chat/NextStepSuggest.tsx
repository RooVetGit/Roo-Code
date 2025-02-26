import { useCallback, useState } from "react"
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
		<div className="px-4 pt-2 h-full" aria-label="Next step suggestions">
			<div className="pr-4 h-full scrollbar-thin scrollbar-thumb-vscode-scrollbarSlider-background scrollbar-track-transparent">
				<div className={cn("flex gap-2.5 pb-2 flex-col h-full")}>
					{displayedSuggestions.map((suggestion) => (
						<div key={`${suggestion.task}-${suggestion.mode}-${ts}`} className="w-full">
							<Button
								variant="ui-toolkit-primary"
								className={cn(
									"text-left transition-colors duration-200",
									"focus:outline-none",
									"shadow-sm hover:shadow-md shadow-vscode-widget-shadow/50",
									"rounded-lg overflow-hidden",
									"w-full",
									"min-h-[80px]",
									"group",
								)}
								onClick={() => handleSuggestionClick(suggestion)}
								aria-label={`Execute task: ${suggestion.task} in ${suggestion.mode} mode`}>
								<div className="relative h-full p-2">
									<div className="flex flex-col h-full">
										<div className="text-base font-normal break-words whitespace-normal leading-relaxed mb-6">
											{suggestion.task}
										</div>
									</div>
									<Badge
										variant={"toolkit"}
										className="absolute bottom-2 left-2 text-[9px] uppercase tracking-wide font-medium px-1 py-0">
										{suggestion.mode}
									</Badge>
								</div>
							</Button>
						</div>
					))}
					{suggestions.length > 1 && (
						<Button
							variant="ghost"
							size="sm"
							className=" flex items-center gap-1"
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
