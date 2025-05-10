/**
 * Compares two arrays of strings for equality regardless of order.
 * Handles null/undefined inputs and empty arrays gracefully.
 */
export function areArraysEqual(arr1: string[] | undefined | null, arr2: string[] | undefined | null): boolean {
	// Handle null/undefined cases
	if (!arr1 && !arr2) return true
	if (!arr1 || !arr2) return false

	// Handle empty arrays
	if (arr1.length === 0 && arr2.length === 0) return true

	// Sort and compare
	const sorted1 = [...arr1].sort()
	const sorted2 = [...arr2].sort()

	return sorted1.length === sorted2.length && sorted1.every((value, index) => value === sorted2[index])
}
