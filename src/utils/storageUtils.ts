import { getExtensionContext } from "../extension"

/**
 * Formats a number of bytes into a human-readable string with units (Bytes, KB, MB, GB, etc.).
 *
 * @param bytes The number of bytes.
 * @param decimals The number of decimal places to include (default is 2).
 * @returns A string representing the formatted bytes.
 */
export function formatBytes(bytes: number, decimals = 2): string {
	if (bytes === 0) {
		return "0 Bytes"
	}
	const k = 1024
	const dm = decimals < 0 ? 0 : decimals
	const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
}

/**
 * Logs the estimated sizes of items in the VS Code global state to the console.
 * Only logs items that exceed the specified minimum size threshold.
 *
 * @param minSizeBytes The minimum size in bytes to log (default: 10KB)
 */
export function logGlobalStorageSize(minSizeBytes: number = 10 * 1024): void {
	const context = getExtensionContext()
	try {
		console.log(`[Roo Code] Global State Storage Estimates (items > ${formatBytes(minSizeBytes)}):`)
		const globalStateKeys = context.globalState.keys()
		const stateSizes: { key: string; size: number }[] = []
		let totalSize = 0
		let itemsSkipped = 0

		for (const key of globalStateKeys) {
			const value = context.globalState.get(key)
			try {
				const valueString = JSON.stringify(value)
				const size = valueString.length
				totalSize += size

				if (size >= minSizeBytes) {
					stateSizes.push({ key, size })
				} else {
					itemsSkipped++
				}
			} catch (e) {
				// Handle cases where value might not be stringifiable
				stateSizes.push({ key, size: -1 }) // Indicate an error or unmeasurable size
				console.log(`  - ${key}: (Error calculating size)`)
			}
		}

		stateSizes.sort((a, b) => b.size - a.size)

		stateSizes.forEach((item) => {
			if (item.size === -1) {
				// Already logged error
			} else if (item.size === undefined) {
				console.log(`  - ${item.key}: (undefined value)`)
			} else {
				console.log(`  - ${item.key}: ${formatBytes(item.size)}`)
			}
		})

		console.log(`  Total size of all items: ${formatBytes(totalSize)}`)
		console.log(`  Items below threshold (${itemsSkipped}): not shown`)
		console.log("---")
	} catch (e: any) {
		console.log(`Error displaying global state sizes: ${e.message}`)
	}
}
