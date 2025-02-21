import { useCallback, useState } from "react"
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"

interface NextStepSuggestProps {
	suggestions?: { task: string; mode: string }[]
	onSuggestionClick?: (task: string, mode: string) => void
}

const NextStepSuggest = ({ suggestions, onSuggestionClick }: NextStepSuggestProps) => {
	const [isExpanded, setIsExpanded] = useState(false)

	const handleSuggestionClick = useCallback(
		(suggestion: { task: string; mode: string }) => {
			onSuggestionClick?.(suggestion.task, suggestion.mode)
		},
		[onSuggestionClick],
	)

	const toggleExpanded = useCallback(() => {
		setIsExpanded((prev) => !prev)
	}, [])

	// Don't render if there are no suggestions or no click handler
	if (!suggestions?.length || !onSuggestionClick) {
		return null
	}

	const displaySuggestions = isExpanded ? suggestions : suggestions.slice(0, 3)
	const showToggle = suggestions.length > 2

	return (
		<nav className="px-4 pt-2" aria-label="Next step suggestions" role="navigation">
			<div className={cn("overflow-y-auto pr-4", isExpanded ? "max-h-[400px]" : "")} role="list">
				<div
					className={cn("flex gap-2 pb-4", isExpanded ? "flex-col" : "flex-row items-center")}
					role="listbox">
					{displaySuggestions.map((suggestion, index) => (
						<div key={index} className={isExpanded ? "w-full" : ""}>
							<Button
								variant="default"
								size="lg"
								className={cn(
									"text-left transition-all duration-200 hover:scale-[1.02] active:scale-98",
									"bg-vscode-button-background text-vscode-button-foreground hover:bg-vscode-button-hoverBackground",
									"focus:outline-2 focus:outline-vscode-focusBorder hover:shadow-md",
									"rounded-md overflow-hidden",
									isExpanded ? "w-full" : "min-w-[320px] max-w-[600px]",
									"h-[120px]",
								)}
								onClick={() => handleSuggestionClick(suggestion)}
								tabIndex={0}
								onKeyDown={(e) => e.key === "Enter" && handleSuggestionClick(suggestion)}
								style={{ padding: "24px" }}>
								<div className="flex flex-col justify-center h-full gap-3">
									<div className="break-words whitespace-normal">{suggestion.task}</div>
									<div className="text-sm font-medium text-vscode-badge-foreground bg-vscode-badge-background inline-flex px-2 py-0.5 rounded-sm self-start">
										{suggestion.mode}
									</div>
								</div>
							</Button>
						</div>
					))}
					{showToggle && (
						<div className={isExpanded ? "w-full" : ""}>
							<Button
								variant="secondary"
								size="lg"
								className={cn(
									"h-[40px] transition-all duration-200 hover:scale-[1.02] active:scale-98",
									"bg-vscode-button-secondaryBackground text-vscode-button-foreground",
									"hover:bg-vscode-button-secondaryHoverBackground hover:shadow-sm",
									"focus:outline-2 focus:outline-vscode-focusBorder",
									"rounded-md",
									"flex items-center gap-1 justify-center min-w-[120px]",
									isExpanded ? "w-full" : "min-w-[100px]",
								)}
								onClick={toggleExpanded}
								tabIndex={0}>
								{isExpanded ? (
									<>
										Show fewer ideas
										<span className="text-xs transition-transform">▲</span>
									</>
								) : (
									<>
										Show more ideas
										<span className="text-xs transition-transform">▼</span>
									</>
								)}
							</Button>
						</div>
					)}
				</div>
			</div>
		</nav>
	)
}

export default NextStepSuggest
