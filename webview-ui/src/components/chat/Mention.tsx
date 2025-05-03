import { mentionRegexGlobal } from "@roo/shared/context-mentions"

import React from "react" // Needed for React.ReactNode
import { vscode } from "../../utils/vscode"

interface MentionProps {
	text?: string
	withShadow?: boolean
	// Add search props
	searchText?: string
	highlightText?: (text: string, searchTerm: string) => React.ReactNode
}

export const Mention = ({ text, withShadow = false, searchText, highlightText }: MentionProps) => {
	// Destructure props
	if (!text) {
		return <>{text}</>
	}

	const parts = text.split(mentionRegexGlobal).map((part, index) => {
		if (index % 2 === 0) {
			// This is regular text. Apply highlighting.
			return searchText && highlightText ? highlightText(part, searchText) : part
		} else {
			// This is a mention.
			return (
				<span
					key={index}
					className={`${withShadow ? "mention-context-highlight-with-shadow" : "mention-context-highlight"} cursor-pointer`}
					onClick={() => vscode.postMessage({ type: "openMention", text: part })}>
					{/* Apply highlighting to the mention text */}
					{searchText && highlightText ? highlightText(`@${part}`, searchText) : `@${part}`}
				</span>
			)
		}
	})

	return <>{parts}</>
}
