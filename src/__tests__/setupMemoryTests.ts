// Track memory usage before and after each test
let startMemory: NodeJS.MemoryUsage

beforeEach(() => {
	if (global.gc) {
		global.gc()
	}
	startMemory = process.memoryUsage()
})

afterEach(() => {
	if (global.gc) {
		global.gc()
	}
	const endMemory = process.memoryUsage()
	const diff = {
		heapUsed: endMemory.heapUsed - startMemory.heapUsed,
		heapTotal: endMemory.heapTotal - startMemory.heapTotal,
		external: endMemory.external - startMemory.external,
		rss: endMemory.rss - startMemory.rss,
	}

	// Log if memory increase is significant (> 50MB)
	const SIGNIFICANT_INCREASE = 50 * 1024 * 1024 // 50MB in bytes
	if (diff.heapUsed > SIGNIFICANT_INCREASE) {
		console.warn(`\nSignificant memory increase detected in test:`)
		console.warn(`Heap Used: +${(diff.heapUsed / 1024 / 1024).toFixed(2)}MB`)
		console.warn(`Heap Total: +${(diff.heapTotal / 1024 / 1024).toFixed(2)}MB`)
		console.warn(`External: +${(diff.external / 1024 / 1024).toFixed(2)}MB`)
		console.warn(`RSS: +${(diff.rss / 1024 / 1024).toFixed(2)}MB\n`)
	}
})

// Add global error handler to catch memory errors
process.on("uncaughtException", (error) => {
	if (error.message.includes("heap out of memory")) {
		console.error("\nHeap out of memory error detected!")
		console.error("Current memory usage:")
		const usage = process.memoryUsage()
		console.error(`Heap Used: ${(usage.heapUsed / 1024 / 1024).toFixed(2)}MB`)
		console.error(`Heap Total: ${(usage.heapTotal / 1024 / 1024).toFixed(2)}MB`)
		console.error(`External: ${(usage.external / 1024 / 1024).toFixed(2)}MB`)
		console.error(`RSS: ${(usage.rss / 1024 / 1024).toFixed(2)}MB\n`)
	}
	throw error
})
