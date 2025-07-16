/**
 * Memory monitoring utilities for code indexing operations
 */

export interface MemoryStats {
	used: number
	total: number
	percentage: number
}

export class MemoryMonitor {
	private static instance: MemoryMonitor
	private memoryThreshold = 0.85 // 85% memory usage threshold
	private lastCheck = 0
	private checkInterval = 5000 // Check every 5 seconds

	static getInstance(): MemoryMonitor {
		if (!MemoryMonitor.instance) {
			MemoryMonitor.instance = new MemoryMonitor()
		}
		return MemoryMonitor.instance
	}

	/**
	 * Get current memory usage statistics
	 */
	getMemoryStats(): MemoryStats {
		const memUsage = process.memoryUsage()
		const totalMemory = require("os").totalmem()
		const used = memUsage.heapUsed + memUsage.external

		return {
			used,
			total: totalMemory,
			percentage: used / totalMemory,
		}
	}

	/**
	 * Check if memory usage is above threshold
	 */
	isMemoryPressure(): boolean {
		const stats = this.getMemoryStats()
		return stats.percentage > this.memoryThreshold
	}

	/**
	 * Force garbage collection if available
	 */
	forceGC(): void {
		if (global.gc) {
			global.gc()
		}
	}

	/**
	 * Check memory and force GC if needed (throttled)
	 */
	checkAndCleanup(): boolean {
		const now = Date.now()
		if (now - this.lastCheck < this.checkInterval) {
			return false
		}

		this.lastCheck = now
		const isHighMemory = this.isMemoryPressure()

		if (isHighMemory) {
			this.forceGC()
			console.warn("Memory pressure detected, forced garbage collection")
		}

		return isHighMemory
	}

	/**
	 * Get memory usage in MB for logging
	 */
	getMemoryUsageMB(): number {
		const stats = this.getMemoryStats()
		return Math.round(stats.used / 1024 / 1024)
	}
}
