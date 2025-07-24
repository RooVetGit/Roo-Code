import React from "react"

export const highlightText = (text: string, query: string): React.ReactNode => {
	if (!query.trim()) return text

	// Escape special regex characters to prevent regex injection
	const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
	const parts = text.split(new RegExp(`(${escapedQuery})`, "gi"))
	return parts.map((part, index) =>
		part.toLowerCase() === query.toLowerCase() ? (
			<mark key={index} className="bg-vscode-editor-findMatchHighlightBackground text-inherit">
				{part}
			</mark>
		) : (
			part
		),
	)
}

interface SearchHighlightProps {
	text: string
	searchQuery: string
	className?: string
}

export const SearchHighlight: React.FC<SearchHighlightProps> = ({ text, searchQuery, className }) => {
	return <span className={className}>{highlightText(text, searchQuery)}</span>
}

interface SettingHighlightWrapperProps {
	settingId: string
	searchQuery: string
	matches: Array<{ settingId: string }>
	children: React.ReactNode
}

export const SettingHighlightWrapper: React.FC<SettingHighlightWrapperProps> = ({
	settingId,
	searchQuery,
	matches,
	children,
}) => {
	const isHighlighted = matches.some((match) => match.settingId === settingId)

	if (!searchQuery || !isHighlighted) {
		return <>{children}</>
	}

	return (
		<div className="relative">
			<div className="absolute -left-2 top-0 bottom-0 w-1 bg-vscode-editor-findMatchHighlightBackground rounded" />
			{children}
		</div>
	)
}
