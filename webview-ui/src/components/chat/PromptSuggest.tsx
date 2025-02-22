import { useCallback } from "react"
import { cn } from "../../lib/utils"

interface PromptSuggestProps {
	suggestions?: string[]
	onSuggestionClick?: (text: string) => void
}

const PromptSuggest = ({ suggestions, onSuggestionClick }: PromptSuggestProps) => {
	const handleSuggestionClick = useCallback(
		(text: string) => {
			onSuggestionClick?.(text)
		},
		[onSuggestionClick],
	)

	// Don't render if there are no suggestions or no click handler
	if (!suggestions?.length || !onSuggestionClick) {
		return null
	}

	return (
		<div className="px-4 pt-2">
			<div className="h-[200px] overflow-y-auto">
				<div className="flex flex-wrap pb-8">
					{suggestions.map((suggestion, index) => (
						<div key={index} className="mb-2 inline-block mr-2">
							<button
								onClick={() => handleSuggestionClick(suggestion)}
								className={cn(
									"px-4 py-1.5 rounded-md text-sm font-medium text-left w-full",
									"bg-vscode-button-background hover:bg-vscode-button-hoverBackground",
									"text-vscode-button-foreground hover:shadow-md",
									"transition-colors duration-100 outline-none hover:bg-vscode-list-hoverBackground",
									"hover:outline hover:outline-1 hover:outline-vscode-button-hoverBackground",
									"active:scale-95 active:shadow-sm",
									"focus:outline focus:outline-2 focus:outline-vscode-focusBorder focus:shadow-md",
								)}>
								{suggestion}
							</button>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}

export default PromptSuggest
