import { mentionRegex } from "../../../src/shared/context-mentions"
import { Fzf } from "fzf"
import { ModeConfig } from "../../../src/shared/modes"
import * as path from "path"

export interface SearchResult {
	path: string
	type: "file" | "folder"
	label?: string
}
export function insertMention(
	text: string,
	position: number,
	value: string,
): { newValue: string; mentionIndex: number } {
	// Handle slash command
	if (text.startsWith("/")) {
		return {
			newValue: value,
			mentionIndex: 0,
		}
	}

	const beforeCursor = text.slice(0, position)
	const afterCursor = text.slice(position)

	// Find the position of the last '@' symbol before the cursor
	const lastAtIndex = beforeCursor.lastIndexOf("@")

	let newValue: string
	let mentionIndex: number

	/**
	 * Multi-level escaping for spaces in file paths.
	 *
	 * This is a critical section that handles the complex escaping of spaces in file paths.
	 *
	 * WHY FOUR BACKSLASHES?
	 * =====================
	 * The sequence "\\\\" in JavaScript represents two literal backslashes in the actual string.
	 * When we want to output "\\", we need to write it as "\\\\" in code.
	 *
	 * THE ESCAPING PIPELINE:
	 * =====================
	 * 1. First, we identify any already escaped spaces (e.g., "\ ") and temporarily replace them
	 *    with a special marker.
	 *
	 * 2. Then we escape any regular spaces with a single backslash.
	 *
	 * 3. Finally, we replace our markers with double-backslash followed by space.
	 *    This ensures that spaces that were already escaped get properly double-escaped.
	 *
	 * EXAMPLE:
	 * =====================
	 * Input: "file\ with spaces.txt"
	 * After step 1: "file\ESCAPED_SPACEwith spaces.txt"
	 * After step 2: "file\ESCAPED_SPACEwith\ spaces.txt"
	 * After step 3: "file\\ with\ spaces.txt"
	 *
	 * This approach handles the case when:
	 * - A file path comes from convertToMentionPath (which has already escaped spaces once)
	 * - We need to ensure those escapes are preserved when inserted into text
	 * - The final string will have double backslashes before spaces from convertToMentionPath
	 *   and single backslashes before spaces added in this function
	 */
	// Escape spaces, handling already escaped spaces
	const formattedValue = value
		.replace(/\\ /g, "\\ESCAPED_SPACE") // Temporarily replace already escaped spaces
		.replace(/ /g, "\\ ") // Escape all normal spaces
		.replace(/\\ESCAPED_SPACE/g, "\\\\ ") // Restore escaped spaces with proper escaping

	if (lastAtIndex !== -1) {
		// If there's an '@' symbol, replace text after it up to the next space/end
		const beforeMention = text.slice(0, lastAtIndex)

		// Extract and preserve the rest of the text after the word being replaced
		const afterMentionMatch = afterCursor.match(/^\S*\s*(.*)$/)
		const afterMentionText = afterMentionMatch ? afterMentionMatch[1] : ""

		newValue = beforeMention + "@" + formattedValue + "  " + afterMentionText
		mentionIndex = lastAtIndex
	} else {
		// If there's no '@' symbol, insert the mention at the cursor position
		// Handle special cases
		if (text === "") {
			// For empty text, use original behavior with single space
			newValue = "@" + formattedValue + " "
		} else if (position === 0) {
			newValue = "@" + formattedValue + "  " + afterCursor
		} else if (position === text.length) {
			newValue = beforeCursor + "@" + formattedValue + "  "
		} else {
			newValue = beforeCursor + "@" + formattedValue + " " + afterCursor
		}
		mentionIndex = position
	}

	return { newValue, mentionIndex }
}

export function removeMention(text: string, position: number): { newText: string; newPosition: number } {
	const beforeCursor = text.slice(0, position)
	const afterCursor = text.slice(position)

	// Check if we're at the end of a mention
	const matchEnd = beforeCursor.match(new RegExp(mentionRegex.source + "$"))

	if (matchEnd) {
		// If we're at the end of a mention, remove it
		const newText = text.slice(0, position - matchEnd[0].length) + afterCursor.replace(" ", "") // removes the first space after the mention
		const newPosition = position - matchEnd[0].length
		return { newText, newPosition }
	}

	// If we're not at the end of a mention, just return the original text and position
	return { newText: text, newPosition: position }
}

export enum ContextMenuOptionType {
	OpenedFile = "openedFile",
	File = "file",
	Folder = "folder",
	Problems = "problems",
	Terminal = "terminal",
	URL = "url",
	Git = "git",
	NoResults = "noResults",
	Mode = "mode", // Add mode type
}

export interface ContextMenuQueryItem {
	type: ContextMenuOptionType
	value?: string
	label?: string
	description?: string
	icon?: string
}

export function getContextMenuOptions(
	query: string,
	selectedType: ContextMenuOptionType | null = null,
	queryItems: ContextMenuQueryItem[],
	dynamicSearchResults: SearchResult[] = [],
	modes?: ModeConfig[],
): ContextMenuQueryItem[] {
	// Handle slash commands for modes
	if (query.startsWith("/")) {
		const modeQuery = query.slice(1)
		if (!modes?.length) return [{ type: ContextMenuOptionType.NoResults }]

		// Create searchable strings array for fzf
		const searchableItems = modes.map((mode) => ({
			original: mode,
			searchStr: mode.name,
		}))

		// Initialize fzf instance for fuzzy search
		const fzf = new Fzf(searchableItems, {
			selector: (item) => item.searchStr,
		})

		// Get fuzzy matching items
		const matchingModes = modeQuery
			? fzf.find(modeQuery).map((result) => ({
					type: ContextMenuOptionType.Mode,
					value: result.item.original.slug,
					label: result.item.original.name,
					description: result.item.original.roleDefinition.split("\n")[0],
				}))
			: modes.map((mode) => ({
					type: ContextMenuOptionType.Mode,
					value: mode.slug,
					label: mode.name,
					description: mode.roleDefinition.split("\n")[0],
				}))

		return matchingModes.length > 0 ? matchingModes : [{ type: ContextMenuOptionType.NoResults }]
	}

	const workingChanges: ContextMenuQueryItem = {
		type: ContextMenuOptionType.Git,
		value: "git-changes",
		label: "Working changes",
		description: "Current uncommitted changes",
		icon: "$(git-commit)",
	}

	if (query === "") {
		if (selectedType === ContextMenuOptionType.File) {
			const files = queryItems
				.filter(
					(item) =>
						item.type === ContextMenuOptionType.File || item.type === ContextMenuOptionType.OpenedFile,
				)
				.map((item) => ({
					type: item.type,
					value: item.value,
				}))
			return files.length > 0 ? files : [{ type: ContextMenuOptionType.NoResults }]
		}

		if (selectedType === ContextMenuOptionType.Folder) {
			const folders = queryItems
				.filter((item) => item.type === ContextMenuOptionType.Folder)
				.map((item) => ({ type: ContextMenuOptionType.Folder, value: item.value }))
			return folders.length > 0 ? folders : [{ type: ContextMenuOptionType.NoResults }]
		}

		if (selectedType === ContextMenuOptionType.Git) {
			const commits = queryItems.filter((item) => item.type === ContextMenuOptionType.Git)
			return commits.length > 0 ? [workingChanges, ...commits] : [workingChanges]
		}

		return [
			{ type: ContextMenuOptionType.Problems },
			{ type: ContextMenuOptionType.Terminal },
			{ type: ContextMenuOptionType.URL },
			{ type: ContextMenuOptionType.Folder },
			{ type: ContextMenuOptionType.File },
			{ type: ContextMenuOptionType.Git },
		]
	}

	const lowerQuery = query.toLowerCase()
	const suggestions: ContextMenuQueryItem[] = []

	// Check for top-level option matches
	if ("git".startsWith(lowerQuery)) {
		suggestions.push({
			type: ContextMenuOptionType.Git,
			label: "Git Commits",
			description: "Search repository history",
			icon: "$(git-commit)",
		})
	} else if ("git-changes".startsWith(lowerQuery)) {
		suggestions.push(workingChanges)
	}
	if ("problems".startsWith(lowerQuery)) {
		suggestions.push({ type: ContextMenuOptionType.Problems })
	}
	if ("terminal".startsWith(lowerQuery)) {
		suggestions.push({ type: ContextMenuOptionType.Terminal })
	}
	if (query.startsWith("http")) {
		suggestions.push({ type: ContextMenuOptionType.URL, value: query })
	}

	// Add exact SHA matches to suggestions
	if (/^[a-f0-9]{7,40}$/i.test(lowerQuery)) {
		const exactMatches = queryItems.filter(
			(item) => item.type === ContextMenuOptionType.Git && item.value?.toLowerCase() === lowerQuery,
		)
		if (exactMatches.length > 0) {
			suggestions.push(...exactMatches)
		} else {
			// If no exact match but valid SHA format, add as option
			suggestions.push({
				type: ContextMenuOptionType.Git,
				value: lowerQuery,
				label: `Commit ${lowerQuery}`,
				description: "Git commit hash",
				icon: "$(git-commit)",
			})
		}
	}

	const searchableItems = queryItems.map((item) => ({
		original: item,
		searchStr: [item.value, item.label, item.description].filter(Boolean).join(" "),
	}))

	// Initialize fzf instance for fuzzy search
	const fzf = new Fzf(searchableItems, {
		selector: (item) => item.searchStr,
	})

	// Get fuzzy matching items
	const matchingItems = query ? fzf.find(query).map((result) => result.item.original) : []

	// Separate matches by type
	const openedFileMatches = matchingItems.filter((item) => item.type === ContextMenuOptionType.OpenedFile)

	const gitMatches = matchingItems.filter((item) => item.type === ContextMenuOptionType.Git)

	// Convert search results to queryItems format
	const searchResultItems = dynamicSearchResults.map((result) => {
		const formattedPath = result.path.startsWith("/") ? result.path : `/${result.path}`

		return {
			type: result.type === "folder" ? ContextMenuOptionType.Folder : ContextMenuOptionType.File,
			value: formattedPath,
			label: result.label || path.basename(result.path),
			description: formattedPath,
		}
	})

	const allItems = [...suggestions, ...openedFileMatches, ...searchResultItems, ...gitMatches]

	// Remove duplicates - normalize paths by ensuring all have leading slashes
	const seen = new Set()
	const deduped = allItems.filter((item) => {
		// Normalize paths for deduplication by ensuring leading slashes
		const normalizedValue = item.value
		let key = ""
		if (
			item.type === ContextMenuOptionType.File ||
			item.type === ContextMenuOptionType.Folder ||
			item.type === ContextMenuOptionType.OpenedFile
		) {
			key = normalizedValue!
		} else {
			key = `${item.type}-${normalizedValue}`
		}
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})

	return deduped.length > 0 ? deduped : [{ type: ContextMenuOptionType.NoResults }]
}

export function shouldShowContextMenu(text: string, position: number): boolean {
	// Handle slash command
	if (text.startsWith("/")) {
		return position <= text.length && !text.includes(" ")
	}
	const beforeCursor = text.slice(0, position)
	const atIndex = beforeCursor.lastIndexOf("@")

	if (atIndex === -1) {
		return false
	}

	const textAfterAt = beforeCursor.slice(atIndex + 1)

	// Check if there's any whitespace after the '@'
	if (/\s/.test(textAfterAt)) return false

	// Don't show the menu if it's clearly a URL
	if (textAfterAt.toLowerCase().startsWith("http")) {
		return false
	}

	// Show menu in all other cases
	return true
}
