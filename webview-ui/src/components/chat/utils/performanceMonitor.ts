/**
 * Performance metrics for ChatView virtualization
 */
export interface PerformanceMetrics {
	renderTime: number[]
	scrollFPS: number
	memoryUsage: number
	messageCount: number
	visibleMessageCount: number
	domNodeCount: number
	lastMeasurement: number
}

/**
 * Performance thresholds for monitoring
 */
export interface PerformanceThresholds {
	maxRenderTime: number
	minScrollFPS: number
	maxMemoryUsage: number
	maxDOMNodes: number
}

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
	maxRenderTime: 16.67, // 60 FPS target
	minScrollFPS: 30,
	maxMemoryUsage: 256 * 1024 * 1024, // 256MB - more reasonable for modern web apps
	maxDOMNodes: 5000,
}

/**
 * Monitors and tracks performance metrics for ChatView
 */
export class PerformanceMonitor {
	private metrics: PerformanceMetrics = {
		renderTime: [],
		scrollFPS: 60,
		memoryUsage: 0,
		messageCount: 0,
		visibleMessageCount: 0,
		domNodeCount: 0,
		lastMeasurement: Date.now(),
	}

	private frameCount = 0
	private lastFrameTime = performance.now()
	private rafId: number | null = null
	private isMonitoring = false
	private thresholds: PerformanceThresholds
	private performanceObserver: PerformanceObserver | null = null

	// Callbacks for threshold violations
	private onThresholdViolation?: (metric: string, value: number, threshold: number) => void

	constructor(
		thresholds: Partial<PerformanceThresholds> = {},
		onThresholdViolation?: (metric: string, value: number, threshold: number) => void,
	) {
		this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds }
		this.onThresholdViolation = onThresholdViolation

		// Set up performance observer if available
		if (typeof PerformanceObserver !== "undefined") {
			try {
				this.performanceObserver = new PerformanceObserver((list) => {
					for (const entry of list.getEntries()) {
						if (entry.entryType === "measure" && entry.name.startsWith("chat-")) {
							this.recordRenderTime(entry.duration)
						}
					}
				})
				this.performanceObserver.observe({ entryTypes: ["measure"] })
			} catch (_e) {
				console.warn("PerformanceObserver not available:", _e)
			}
		}
	}

	/**
	 * Start monitoring performance
	 */
	startMonitoring(): void {
		if (this.isMonitoring) return

		this.isMonitoring = true
		this.measureFPS()
	}

	/**
	 * Stop monitoring performance
	 */
	stopMonitoring(): void {
		this.isMonitoring = false

		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId)
			this.rafId = null
		}
	}

	/**
	 * Measure render performance
	 */
	measureRender<T>(label: string, callback: () => T): T {
		const startMark = `${label}-start`
		const endMark = `${label}-end`

		performance.mark(startMark)
		const result = callback()
		performance.mark(endMark)

		try {
			performance.measure(label, startMark, endMark)
			const measure = performance.getEntriesByName(label, "measure")[0]
			if (measure) {
				this.recordRenderTime(measure.duration)
			}
		} catch (_e) {
			// Fallback for browsers that don't support performance.measure
			const start = performance.getEntriesByName(startMark, "mark")[0]?.startTime || 0
			const end = performance.getEntriesByName(endMark, "mark")[0]?.startTime || 0
			this.recordRenderTime(end - start)
		}

		// Clean up marks
		performance.clearMarks(startMark)
		performance.clearMarks(endMark)
		performance.clearMeasures(label)

		return result
	}

	/**
	 * Record a render time measurement
	 */
	private recordRenderTime(duration: number): void {
		this.metrics.renderTime.push(duration)

		// Keep only last 100 measurements
		if (this.metrics.renderTime.length > 100) {
			this.metrics.renderTime.shift()
		}

		// Check threshold
		if (duration > this.thresholds.maxRenderTime) {
			this.violateThreshold("renderTime", duration, this.thresholds.maxRenderTime)
		}
	}

	/**
	 * Measure FPS using requestAnimationFrame
	 */
	private measureFPS = (): void => {
		if (!this.isMonitoring) return

		const now = performance.now()
		const delta = now - this.lastFrameTime

		if (delta >= 1000) {
			this.metrics.scrollFPS = Math.round((this.frameCount * 1000) / delta)
			this.frameCount = 0
			this.lastFrameTime = now

			// Check threshold
			if (this.metrics.scrollFPS < this.thresholds.minScrollFPS) {
				this.violateThreshold("scrollFPS", this.metrics.scrollFPS, this.thresholds.minScrollFPS)
			}
		}

		this.frameCount++
		this.rafId = requestAnimationFrame(this.measureFPS)
	}

	/**
	 * Update scroll FPS (called from scroll handler)
	 */
	updateScrollFPS(): void {
		// This is called from scroll events to track scroll performance
		this.frameCount++
	}

	/**
	 * Update memory usage
	 */
	updateMemoryUsage(): void {
		if ("memory" in performance) {
			const memory = (performance as any).memory
			this.metrics.memoryUsage = memory.usedJSHeapSize || 0

			// Check threshold
			if (this.metrics.memoryUsage > this.thresholds.maxMemoryUsage) {
				this.violateThreshold("memoryUsage", this.metrics.memoryUsage, this.thresholds.maxMemoryUsage)
			}
		}
	}

	/**
	 * Update message counts
	 */
	updateMessageCounts(total: number, visible: number): void {
		this.metrics.messageCount = total
		this.metrics.visibleMessageCount = visible
	}

	/**
	 * Update DOM node count
	 */
	updateDOMNodeCount(): void {
		// Use a more efficient method to count DOM nodes
		// Only count nodes within the chat container to reduce overhead
		const chatContainer = document.querySelector('[data-testid="chat-messages-container"]') || document.body
		this.metrics.domNodeCount = chatContainer.getElementsByTagName("*").length

		// Check threshold
		if (this.metrics.domNodeCount > this.thresholds.maxDOMNodes) {
			this.violateThreshold("domNodeCount", this.metrics.domNodeCount, this.thresholds.maxDOMNodes)
		}
	}

	/**
	 * Get current metrics
	 */
	getMetrics(): PerformanceMetrics {
		return { ...this.metrics, lastMeasurement: Date.now() }
	}

	/**
	 * Get average render time
	 */
	getAverageRenderTime(): number {
		if (this.metrics.renderTime.length === 0) return 0
		const sum = this.metrics.renderTime.reduce((a, b) => a + b, 0)
		return sum / this.metrics.renderTime.length
	}

	/**
	 * Get performance score (0-100)
	 */
	getPerformanceScore(): number {
		const renderScore = Math.max(0, 100 - (this.getAverageRenderTime() / this.thresholds.maxRenderTime) * 50)
		const fpsScore = Math.min(100, (this.metrics.scrollFPS / 60) * 100)
		const memoryScore = Math.max(0, 100 - (this.metrics.memoryUsage / this.thresholds.maxMemoryUsage) * 50)
		const domScore = Math.max(0, 100 - (this.metrics.domNodeCount / this.thresholds.maxDOMNodes) * 50)

		return Math.round((renderScore + fpsScore + memoryScore + domScore) / 4)
	}

	/**
	 * Log current metrics to console
	 */
	logMetrics(): void {
		const score = this.getPerformanceScore()
		const avgRenderTime = this.getAverageRenderTime()

		console.log("ChatView Performance Metrics:", {
			score: `${score}/100`,
			avgRenderTime: `${avgRenderTime.toFixed(2)}ms`,
			scrollFPS: this.metrics.scrollFPS,
			memoryUsage: `${(this.metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
			efficiency: `${this.metrics.visibleMessageCount}/${this.metrics.messageCount} messages rendered`,
			domNodes: this.metrics.domNodeCount,
		})
	}

	/**
	 * Get performance report
	 */
	getReport(): {
		score: number
		metrics: PerformanceMetrics
		averageRenderTime: number
		issues: string[]
	} {
		const issues: string[] = []
		const avgRenderTime = this.getAverageRenderTime()

		if (avgRenderTime > this.thresholds.maxRenderTime) {
			issues.push(
				`Render time (${avgRenderTime.toFixed(2)}ms) exceeds target (${this.thresholds.maxRenderTime}ms)`,
			)
		}

		if (this.metrics.scrollFPS < this.thresholds.minScrollFPS) {
			issues.push(`Scroll FPS (${this.metrics.scrollFPS}) below minimum (${this.thresholds.minScrollFPS})`)
		}

		if (this.metrics.memoryUsage > this.thresholds.maxMemoryUsage) {
			issues.push(
				`Memory usage (${(this.metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB) exceeds limit (${(this.thresholds.maxMemoryUsage / 1024 / 1024).toFixed(0)}MB)`,
			)
		}

		if (this.metrics.domNodeCount > this.thresholds.maxDOMNodes) {
			issues.push(`DOM nodes (${this.metrics.domNodeCount}) exceeds limit (${this.thresholds.maxDOMNodes})`)
		}

		return {
			score: this.getPerformanceScore(),
			metrics: this.getMetrics(),
			averageRenderTime: avgRenderTime,
			issues,
		}
	}

	/**
	 * Handle threshold violation
	 */
	private violateThreshold(metric: string, value: number, threshold: number): void {
		if (this.onThresholdViolation) {
			this.onThresholdViolation(metric, value, threshold)
		}
	}

	/**
	 * Reset all metrics
	 */
	reset(): void {
		this.metrics = {
			renderTime: [],
			scrollFPS: 60,
			memoryUsage: 0,
			messageCount: 0,
			visibleMessageCount: 0,
			domNodeCount: 0,
			lastMeasurement: Date.now(),
		}
		this.frameCount = 0
		this.lastFrameTime = performance.now()
	}

	/**
	 * Cleanup resources
	 */
	dispose(): void {
		this.stopMonitoring()

		if (this.performanceObserver) {
			this.performanceObserver.disconnect()
			this.performanceObserver = null
		}
	}
}

/**
 * Create a singleton performance monitor instance
 */
let globalMonitor: PerformanceMonitor | null = null

export function getGlobalPerformanceMonitor(): PerformanceMonitor {
	if (!globalMonitor) {
		globalMonitor = new PerformanceMonitor({}, (metric, value, threshold) => {
			console.warn(`Performance threshold violated: ${metric} = ${value} (threshold: ${threshold})`)
		})
	}
	return globalMonitor
}
