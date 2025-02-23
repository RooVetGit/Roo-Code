import { useCallback } from "react"
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"

interface NextStepSuggestProps {
	suggestions?: { task: string; mode: string; id?: string }[]
	onSuggestionClick?: (task: string, mode: string) => void
}

const NextStepSuggest = ({ suggestions = [], onSuggestionClick }: NextStepSuggestProps) => {
	const handleSuggestionClick = useCallback(
		(suggestion: { task: string; mode: string }) => {
			onSuggestionClick?.(suggestion.task, suggestion.mode)
		},
		[onSuggestionClick],
	)

	// Don't render if there are no suggestions or no click handler
	if (!suggestions?.length || !onSuggestionClick) {
		return null
	}

	return (
		<nav className="px-4 pt-2" aria-label="Next step suggestions" role="navigation">
			<div className="overflow-y-auto pr-4 max-h-[400px] scrollbar-thin scrollbar-thumb-vscode-scrollbarSlider-background scrollbar-track-transparent">
				<div className={cn("flex gap-2.5 pb-4 flex-col")}>
					{suggestions.map((suggestion) => (
						<div key={`${suggestion.task}-${suggestion.mode}`} className="w-full">
							<Button
								variant="default"
								size="default"
								className={cn(
									"text-left transition-colors duration-200",
									"bg-vscode-button-background/80 text-vscode-button-foreground hover:bg-vscode-button-hoverBackground",
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
				</div>
			</div>
		</nav>
	)
}

export default NextStepSuggest
