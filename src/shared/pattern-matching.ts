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
