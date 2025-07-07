import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import {
	matchesPatternOrContains,
	filterByPattern,
	matchesGlobPattern,
	findMostSpecificMatchingPattern,
} from "../../../src/shared/pattern-matching"

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

/**
 * Pattern matching utilities for MCP tool/server restrictions
 * Re-exported from shared utilities for frontend use
 */
export const patternMatching = {
	/**
	 * Check if a string matches a pattern with fallback to contains search
	 * @param text - Text to test against pattern
	 * @param searchTerm - Pattern or search term
	 * @returns boolean indicating if text matches pattern
	 */
	matchesPattern: matchesPatternOrContains,

	/**
	 * Check if a string matches a glob pattern (exact matching for restrictions)
	 * @param text - Text to test against pattern
	 * @param pattern - Glob pattern or exact string
	 * @returns boolean indicating if text matches pattern
	 */
	matchesGlobPattern: matchesGlobPattern,

	/**
	 * Find the most specific pattern that matches the given text
	 * @param text - Text to match against
	 * @param patterns - Array of patterns to check
	 * @returns Most specific matching pattern, or null if no match
	 */
	findMostSpecificMatchingPattern: findMostSpecificMatchingPattern,

	/**
	 * Filter an array of items by pattern matching against specified fields
	 * @param items - Array of items to filter
	 * @param searchTerm - Pattern or search term
	 * @param fields - Fields to search in each item
	 * @returns Filtered array
	 */
	filterByPattern,
}
