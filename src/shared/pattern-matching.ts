/**
 * Shared pattern matching utilities for MCP tool/server restrictions
 * Supports glob-style patterns with * and ? wildcards
 * Used by both frontend (webview) and backend (extension) code
 */

/**
 * Convert glob pattern to regex for matching
 * @param pattern - Glob pattern with * and ? wildcards
 * @returns RegExp object for pattern matching
 */
export function globToRegex(pattern: string): RegExp {
	// Escape special regex characters except * and ?
	const escaped = pattern
		.replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape special chars
		.replace(/\*/g, ".*") // Convert * to .*
		.replace(/\?/g, ".") // Convert ? to .

	return new RegExp(`^${escaped}$`, "i") // Case insensitive, match entire string
}

/**
 * Check if a string matches a glob pattern (supports * and ? wildcards)
 * @param text - Text to test against pattern
 * @param pattern - Glob pattern or exact string
 * @returns boolean indicating if text matches pattern
 */
export function matchesGlobPattern(text: string, pattern: string): boolean {
	// If pattern contains glob characters, use pattern matching
	if (pattern.includes("*") || pattern.includes("?")) {
		try {
			const regex = globToRegex(pattern)
			return regex.test(text)
		} catch (error) {
			console.error(`Invalid glob pattern: ${pattern}`, error)
			return false
		}
	}
	// Otherwise use exact string matching
	return text === pattern
}

/**
 * Check if a name matches any pattern in a list
 * @param name - Name to test
 * @param patterns - Array of patterns (can include wildcards)
 * @returns boolean indicating if name matches any pattern
 */
export function matchesAnyPattern(name: string, patterns: string[]): boolean {
	return patterns.some((pattern) => matchesGlobPattern(name, pattern))
}

/**
 * Check if a string matches a pattern with fallback to contains search
 * Used for UI search/filter functionality
 * @param text - Text to test against pattern
 * @param searchTerm - Pattern or search term
 * @returns boolean indicating if text matches pattern
 */
export function matchesPatternOrContains(text: string, searchTerm: string): boolean {
	if (!searchTerm) return true

	// If the search term contains * or ?, treat it as a pattern
	if (searchTerm.includes("*") || searchTerm.includes("?")) {
		try {
			const regex = globToRegex(searchTerm)
			return regex.test(text)
		} catch (e) {
			// If regex creation fails, fall back to simple includes
			return text.toLowerCase().includes(searchTerm.toLowerCase())
		}
	}

	// Otherwise, do simple contains search
	return text.toLowerCase().includes(searchTerm.toLowerCase())
}

/**
 * Check if a pattern contains wildcards
 * @param pattern - Pattern to check
 * @returns boolean indicating if pattern has wildcards
 */
export function isWildcardPattern(pattern: string): boolean {
	return pattern.includes("*") || pattern.includes("?")
}

/**
 * Filter an array of items by pattern matching against specified fields
 * @param items - Array of items to filter
 * @param searchTerm - Pattern or search term
 * @param fields - Fields to search in each item (must be string fields)
 * @returns Filtered array
 */
export function filterByPattern<T>(items: T[], searchTerm: string, fields: (keyof T)[]): T[] {
	if (!searchTerm) return items

	return items.filter((item) =>
		fields.some((field) => {
			const value = item[field]
			if (typeof value === "string") {
				return matchesPatternOrContains(value, searchTerm)
			}
			return false
		}),
	)
}

/**
 * Pattern specificity information for ranking patterns
 */
export interface PatternSpecificity {
	/** Whether the pattern is an exact match (no wildcards) */
	isExact: boolean
	/** Specificity score - higher is more specific */
	specificity: number
}

/**
 * Calculate pattern specificity for ranking purposes
 * Exact patterns (no wildcards) always rank higher than wildcard patterns
 * Among wildcard patterns, longer patterns with more literal characters rank higher
 * @param pattern - Pattern to analyze
 * @returns Pattern specificity information
 */
export function getPatternSpecificity(pattern: string): PatternSpecificity {
	// Safety check for undefined pattern
	if (!pattern || typeof pattern !== "string") {
		return {
			isExact: false,
			specificity: 0,
		}
	}

	const hasWildcards = isWildcardPattern(pattern)

	if (!hasWildcards) {
		// Exact patterns always have highest priority
		return {
			isExact: true,
			specificity: pattern.length,
		}
	}

	// For wildcard patterns, count non-wildcard characters
	const literalCharCount = pattern.replace(/[*?]/g, "").length
	return {
		isExact: false,
		specificity: literalCharCount,
	}
}

/**
 * Find the most specific pattern that matches the given text
 * Prioritizes exact matches over wildcard patterns
 * Among wildcard patterns, prioritizes those with more literal characters
 * @param text - Text to match against
 * @param patterns - Array of patterns to check
 * @returns Most specific matching pattern, or null if no match
 */
export function findMostSpecificMatchingPattern(text: string, patterns: string[]): string | null {
	// Safety check for undefined patterns
	if (!patterns || !Array.isArray(patterns)) {
		return null
	}

	const matchingPatterns = patterns.filter((pattern) => matchesGlobPattern(text, pattern))

	if (matchingPatterns.length === 0) {
		return null
	}

	if (matchingPatterns.length === 1) {
		return matchingPatterns[0]
	}

	// Find the most specific pattern
	let mostSpecific = matchingPatterns[0]
	let bestSpecificity = getPatternSpecificity(mostSpecific)

	for (let i = 1; i < matchingPatterns.length; i++) {
		const currentPattern = matchingPatterns[i]
		const currentSpecificity = getPatternSpecificity(currentPattern)

		// Exact patterns always win over wildcard patterns
		if (currentSpecificity.isExact && !bestSpecificity.isExact) {
			mostSpecific = currentPattern
			bestSpecificity = currentSpecificity
		}
		// Among exact patterns, prefer longer ones
		else if (currentSpecificity.isExact && bestSpecificity.isExact) {
			if (currentSpecificity.specificity > bestSpecificity.specificity) {
				mostSpecific = currentPattern
				bestSpecificity = currentSpecificity
			}
		}
		// Among wildcard patterns, prefer more specific ones (when current is not exact and best is not exact)
		else if (!currentSpecificity.isExact && !bestSpecificity.isExact) {
			if (currentSpecificity.specificity > bestSpecificity.specificity) {
				mostSpecific = currentPattern
				bestSpecificity = currentSpecificity
			}
		}
		// If best is exact and current is wildcard, keep best (exact wins)
	}

	return mostSpecific
}
