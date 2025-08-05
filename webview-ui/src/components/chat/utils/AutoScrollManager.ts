/**
 * Manages auto-scroll behavior for the chat view
 * Detects user intent and provides smooth scrolling experience
 */
export class AutoScrollManager {
	private isUserScrolling: boolean = false
	private lastScrollTop: number = 0
	private lastScrollTime: number = 0
	private scrollVelocity: number = 0
	private scrollTimeout: NodeJS.Timeout | null = null
	private atBottomThreshold: number
	private isScrolling: boolean = false

	// Performance tracking
	private scrollEventCount: number = 0
	private lastFPSCheck: number = Date.now()

	constructor(threshold: number = 50) {
		this.atBottomThreshold = threshold
	}

	/**
	 * Handle scroll events and detect user intent
	 */
	handleScroll(scrollTop: number, scrollHeight: number, clientHeight: number, timestamp: number = Date.now()): void {
		const deltaScroll = scrollTop - this.lastScrollTop
		const deltaTime = timestamp - this.lastScrollTime
		const distanceFromBottom = scrollHeight - scrollTop - clientHeight

		// Calculate scroll velocity for smooth scroll detection
		if (deltaTime > 0) {
			this.scrollVelocity = Math.abs(deltaScroll) / deltaTime
		}

		// Detect user scrolling
		const isScrollingUp = deltaScroll < -5 // Small threshold to avoid noise
		const significantScroll = Math.abs(deltaScroll) > 10

		console.log("[VIRTUALIZATION] AutoScrollManager.handleScroll:", {
			scrollTop,
			scrollHeight,
			clientHeight,
			deltaScroll,
			deltaTime,
			distanceFromBottom,
			scrollVelocity: this.scrollVelocity,
			isScrollingUp,
			significantScroll,
			timestamp: new Date().toISOString(),
		})

		if (isScrollingUp && distanceFromBottom > this.atBottomThreshold) {
			console.log("[VIRTUALIZATION] User scrolling detected: scrolling up")
			this.isUserScrolling = true
			this.isScrolling = true
		} else if (significantScroll && !this.isNearBottom(scrollTop, scrollHeight, clientHeight)) {
			console.log("[VIRTUALIZATION] User scrolling detected: significant scroll")
			this.isUserScrolling = true
			this.isScrolling = true
		}

		// Reset user scrolling flag if they scroll to bottom
		if (distanceFromBottom <= this.atBottomThreshold) {
			if (this.isUserScrolling) {
				console.log("[VIRTUALIZATION] User scrolling reset: reached bottom")
			}
			this.isUserScrolling = false
		}

		// Update state
		this.lastScrollTop = scrollTop
		this.lastScrollTime = timestamp
		this.scrollEventCount++

		// Clear existing timeout
		if (this.scrollTimeout) {
			clearTimeout(this.scrollTimeout)
		}

		// Set timeout to detect end of scrolling
		this.scrollTimeout = setTimeout(() => {
			console.log("[VIRTUALIZATION] Scrolling ended")
			this.isScrolling = false
			this.scrollVelocity = 0
			this.scrollTimeout = null
		}, 150)
	}

	/**
	 * Check if should auto-scroll to bottom
	 */
	shouldAutoScroll(hasExpandedMessages: boolean = false): boolean {
		// Don't auto-scroll if:
		// 1. User is manually scrolling
		// 2. There are expanded messages (user might be reading)
		// 3. Currently in a scroll animation
		const shouldScroll = !this.isUserScrolling && !hasExpandedMessages && !this.isScrolling

		console.log("[VIRTUALIZATION] AutoScrollManager.shouldAutoScroll:", {
			shouldScroll,
			isUserScrolling: this.isUserScrolling,
			hasExpandedMessages,
			isScrolling: this.isScrolling,
			timestamp: new Date().toISOString(),
		})

		return shouldScroll
	}

	/**
	 * Check if scroll position is near bottom
	 */
	isNearBottom(scrollTop: number, scrollHeight: number, clientHeight: number): boolean {
		const distanceFromBottom = scrollHeight - scrollTop - clientHeight
		return distanceFromBottom <= this.atBottomThreshold
	}

	/**
	 * Check if currently at the very bottom
	 */
	isAtBottom(scrollTop: number, scrollHeight: number, clientHeight: number): boolean {
		const distanceFromBottom = scrollHeight - scrollTop - clientHeight
		return distanceFromBottom <= 1 // 1px tolerance for rounding
	}

	/**
	 * Reset user scrolling flag
	 */
	resetUserScrolling(): void {
		console.log("[VIRTUALIZATION] User scrolling reset manually")
		this.isUserScrolling = false
	}

	/**
	 * Force user scrolling state (e.g., when user expands a message)
	 */
	forceUserScrolling(): void {
		console.log("[VIRTUALIZATION] User scrolling forced")
		this.isUserScrolling = true
	}

	/**
	 * Get current scroll velocity
	 */
	getScrollVelocity(): number {
		return this.scrollVelocity
	}

	/**
	 * Check if currently scrolling
	 */
	isCurrentlyScrolling(): boolean {
		return this.isScrolling
	}

	/**
	 * Calculate optimal scroll behavior based on distance
	 */
	getScrollBehavior(currentTop: number, targetTop: number, maxSmoothDistance: number = 5000): ScrollBehavior {
		const distance = Math.abs(targetTop - currentTop)
		const behavior = distance > maxSmoothDistance ? "auto" : "smooth"

		console.log("[VIRTUALIZATION] Scroll behavior calculated:", {
			currentTop,
			targetTop,
			distance,
			maxSmoothDistance,
			behavior,
			timestamp: new Date().toISOString(),
		})

		// Use instant scroll for large jumps to avoid janky animation
		if (distance > maxSmoothDistance) {
			return "auto"
		}

		// Use smooth scroll for smaller distances
		return "smooth"
	}

	/**
	 * Get scroll performance metrics
	 */
	getScrollMetrics(): {
		fps: number
		isUserScrolling: boolean
		velocity: number
		isScrolling: boolean
	} {
		const now = Date.now()
		const timeDelta = now - this.lastFPSCheck
		const fps = timeDelta > 0 ? (this.scrollEventCount * 1000) / timeDelta : 60

		// Reset counters
		if (timeDelta > 1000) {
			this.scrollEventCount = 0
			this.lastFPSCheck = now
		}

		return {
			fps: Math.min(60, Math.round(fps)),
			isUserScrolling: this.isUserScrolling,
			velocity: this.scrollVelocity,
			isScrolling: this.isScrolling,
		}
	}

	/**
	 * Update threshold for bottom detection
	 */
	setBottomThreshold(threshold: number): void {
		this.atBottomThreshold = threshold
	}

	/**
	 * Get current state for debugging
	 */
	getState(): {
		isUserScrolling: boolean
		lastScrollTop: number
		scrollVelocity: number
		isScrolling: boolean
		atBottomThreshold: number
	} {
		return {
			isUserScrolling: this.isUserScrolling,
			lastScrollTop: this.lastScrollTop,
			scrollVelocity: this.scrollVelocity,
			isScrolling: this.isScrolling,
			atBottomThreshold: this.atBottomThreshold,
		}
	}

	/**
	 * Reset all state
	 */
	reset(): void {
		this.isUserScrolling = false
		this.lastScrollTop = 0
		this.lastScrollTime = 0
		this.scrollVelocity = 0
		this.isScrolling = false
		this.scrollEventCount = 0

		if (this.scrollTimeout) {
			clearTimeout(this.scrollTimeout)
			this.scrollTimeout = null
		}
	}

	/**
	 * Cleanup resources
	 */
	dispose(): void {
		if (this.scrollTimeout) {
			clearTimeout(this.scrollTimeout)
			this.scrollTimeout = null
		}
	}
}
