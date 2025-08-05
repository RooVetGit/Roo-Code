/**
 * Configuration for ChatView virtualization optimization
 */

export interface ViewportConfig {
	top: number
	bottom: number
}

export interface VirtualizationConfig {
	viewport: {
		default: ViewportConfig
		streaming: ViewportConfig
		expanded: ViewportConfig
		minimal: ViewportConfig
	}
	performance: {
		maxMessagesInDOM: number
		cleanupThreshold: number
		minCleanupInterval: number
	}
	autoScroll: {
		threshold: number
		smoothScrollMaxDistance: number
		debounceDelay: number
	}
	stateCache: {
		maxSize: number
		ttl: number
	}
}

export const VIRTUALIZATION_CONFIG: VirtualizationConfig = {
	// Base viewport extensions
	viewport: {
		default: { top: 500, bottom: 1000 },
		streaming: { top: 500, bottom: 3000 },
		expanded: { top: 2000, bottom: 2000 },
		minimal: { top: 200, bottom: 500 },
	},

	// Performance thresholds
	performance: {
		maxMessagesInDOM: 500,
		cleanupThreshold: 1000,
		minCleanupInterval: 5000, // 5 seconds
	},

	// Auto-scroll configuration
	autoScroll: {
		threshold: 50, // pixels from bottom to consider "at bottom"
		smoothScrollMaxDistance: 5000, // use instant scroll for larger jumps
		debounceDelay: 100,
	},

	// State preservation
	stateCache: {
		maxSize: 100,
		ttl: 30 * 60 * 1000, // 30 minutes
	},
}

export type DevicePerformance = "high" | "medium" | "low"

/**
 * Detects device performance capabilities to optimize virtualization
 */
export function detectDevicePerformance(): DevicePerformance {
	// Check for performance hints from browser
	if ("memory" in navigator) {
		const memory = (navigator as any).memory
		if (memory?.jsHeapSizeLimit) {
			const heapLimit = memory.jsHeapSizeLimit
			if (heapLimit > 2 * 1024 * 1024 * 1024) return "high" // > 2GB
			if (heapLimit > 1 * 1024 * 1024 * 1024) return "medium" // > 1GB
		}
	}

	// Check for hardware concurrency (CPU cores)
	if ("hardwareConcurrency" in navigator) {
		const cores = navigator.hardwareConcurrency
		if (cores >= 8) return "high"
		if (cores >= 4) return "medium"
	}

	// Check for device memory hint (Chrome only)
	if ("deviceMemory" in navigator) {
		const deviceMemory = (navigator as any).deviceMemory
		if (deviceMemory >= 8) return "high"
		if (deviceMemory >= 4) return "medium"
	}

	// Check connection type for mobile detection
	if ("connection" in navigator) {
		const connection = (navigator as any).connection
		if (connection?.effectiveType === "4g" && !isMobileDevice()) {
			return "medium"
		}
	}

	// Default to low for safety
	return "low"
}

/**
 * Simple mobile device detection
 */
function isMobileDevice(): boolean {
	return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

/**
 * Get viewport configuration based on device performance
 */
export function getViewportConfigForDevice(performance: DevicePerformance): ViewportConfig {
	switch (performance) {
		case "high":
			return { top: 1000, bottom: 2000 }
		case "medium":
			return VIRTUALIZATION_CONFIG.viewport.default
		case "low":
			return VIRTUALIZATION_CONFIG.viewport.minimal
	}
}
