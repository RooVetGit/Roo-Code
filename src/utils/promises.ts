/**
 * Delays execution for the specified number of milliseconds
 * @param ms Time to delay in milliseconds
 * @returns A promise that resolves after the specified delay
 */
export const delay = (ms: number): Promise<void> => {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
