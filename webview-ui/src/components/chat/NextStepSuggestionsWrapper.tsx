import React, { useMemo } from "react"
import NextStepSuggest from "./NextStepSuggest"

interface NextStepSuggestionsWrapperProps {
	suggestion: string
	partial: boolean
	ts: number
	onSuggestionClick?: (task: string, mode: string) => void
}

const NextStepSuggestionsWrapper: React.FC<NextStepSuggestionsWrapperProps> = ({
	suggestion: suggestionRaw,
	ts,
	partial,
	onSuggestionClick,
}) => {
	const suggestions = useMemo(() => {
		if (partial) {
			return []
		}

		try {
			const parsed = JSON.parse(suggestionRaw ?? "[]")
			if (Array.isArray(parsed)) {
				return parsed.filter((item) => typeof item === "object" && item.task && item.mode)
			}

			return parsed
		} catch (error) {
			console.warn("Next step suggestions must be an array of task & mode objects", error)
			return []
		}
	}, [partial, suggestionRaw])

	if (!suggestions.length) {
		return null
	}

	return <NextStepSuggest suggestions={suggestions} onSuggestionClick={onSuggestionClick} ts={ts} />
}

export default NextStepSuggestionsWrapper
