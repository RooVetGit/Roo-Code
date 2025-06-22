/**
 * Sliding Window Rate Limiter Implementation
 *
 * Justification for choosing the Sliding Window algorithm:
 *
 * 1. Accuracy: Unlike fixed window counters that can allow burst traffic at window
 *    boundaries, sliding window provides more consistent rate limiting by considering
 *    the actual time distribution of requests.
 *
 * 2. Memory Efficiency: Only stores timestamps within the current window period,
 *    automatically cleaning up old entries, making it memory-efficient for high-volume
 *    applications.
 *
 * 3. Fairness: Ensures a smooth rate of requests over time rather than allowing sudden
 *    spikes, which provides a more predictable system behavior and resource usage.
 *
 * 4. Adaptability: Can be easily adjusted to different time windows (minutes, seconds)
 *    while maintaining the same consistent behavior.
 */

/**
 * Configuration options for the SlidingWindowRateLimiter
 */
export interface SlidingWindowRateLimiterOptions {
	/**
	 * The maximum number of requests allowed within the time window.
	 * If not provided, this will be calculated from rateLimitSeconds or default to 60.
	 */
	requestsPerWindow?: number

	/**
	 * The time window duration in milliseconds. Default is 60000 (1 minute).
	 * This is calculated from rateLimitSeconds if provided, otherwise uses this value directly.
	 */
	windowMs?: number

	/**
	 * The minimum time between requests in seconds.
	 * If provided, windowMs and requestsPerWindow will be calculated accordingly.
	 * For example, if rateLimitSeconds is 10, then it will allow 1 request per 10 seconds,
	 * or 6 requests per minute.
	 */
	rateLimitSeconds?: number
}

export class SlidingWindowRateLimiter {
	/**
	 * When `rateLimitSeconds` is supplied we want to guarantee a minimum spacing
	 * (a.k.a. cool-down) between consecutive requests.  This value (in ms)
	 * represents that interval.  If it is **undefined** we will fall back to the
	 * classic sliding-window algorithm that controls *average* throughput but can
	 * still allow bursts at the beginning of a window.
	 */
	private readonly minIntervalMs?: number

	private readonly requestsPerWindow: number
	private readonly windowMs: number
	private readonly requestTimestamps: number[] = []

	/**
	 * The next timestamp (in ms) when a request is allowed if `minIntervalMs` is
	 * being enforced.
	 */
	private nextAvailableTime = 0

	/**
	 * Internal chain used to serialize `acquire()` calls when a strict
	 * `minIntervalMs` is enforced.  This guarantees that each caller observes the
	 * updated scheduling state (i.e. `nextAvailableTime`) and prevents the race
	 * condition where several concurrent calls all think a slot is immediately
	 * available.
	 */
	private serial: Promise<void> = Promise.resolve()

	/**
	 * Creates a new instance of the SlidingWindowRateLimiter
	 * @param options Configuration options for the rate limiter
	 */
	constructor(options?: SlidingWindowRateLimiterOptions) {
		if (options?.rateLimitSeconds) {
			// When a strict minimum interval is required we will *also* keep the
			// sliding-window counters so that extremely long-running burst scenarios
			// are still prevented.
			this.minIntervalMs = options.rateLimitSeconds * 1000

			// Maintain a 2-minute window for additional protection against sustained
			// high-traffic scenarios.  This mirrors the previous behaviour while
			// adding the per-request spacing guarantee.
			const windowSizeInSeconds = 120 // 2 minutes
			this.windowMs = windowSizeInSeconds * 1000
			this.requestsPerWindow = Math.floor(windowSizeInSeconds / options.rateLimitSeconds)
		} else {
			// Use provided values or defaults (pure sliding-window mode)
			this.requestsPerWindow = options?.requestsPerWindow ?? 60
			this.windowMs = options?.windowMs ?? 60 * 1000 // Default: 1 minute in milliseconds
		}

		// Validate final values
		if (this.requestsPerWindow <= 0) {
			throw new Error("Calculated requestsPerWindow must be a positive number")
		}
	}

	/**
	 * Acquires permission to proceed with a request
	 *
	 * @returns A promise that resolves when the request is permitted to proceed
	 */
	public async acquire(): Promise<void> {
		if (this.minIntervalMs !== undefined) {
			// Capture to help TypeScript's control-flow analysis in the async body
			const intervalMs = this.minIntervalMs!

			// Ensure **all** acquire() callers run through the following sequence one
			// after another.
			const nextInChain = this.serial.then(async () => {
				const now = Date.now()

				// Calculate how long we need to wait so we keep at least minIntervalMs
				// between *granted* requests.
				const waitTime = Math.max(this.nextAvailableTime - now, 0)
				if (waitTime > 0) {
					await new Promise((r) => setTimeout(r, waitTime))
				}

				// Record when the next request is allowed *before* doing the heavy
				// lifting so concurrent callers will see the updated schedule.
				this.nextAvailableTime = Date.now() + intervalMs

				// Proceed with the regular sliding-window accounting.
				await this.acquireWithoutMinInterval()
			})

			// Replace the promise chain but deliberately swallow errors in the chain
			// so that a single failing acquire doesn't block others forever. The
			// error is still propagated to the individual caller via `nextInChain`.
			this.serial = nextInChain.catch(() => {})

			return nextInChain
		}

		// Fallback to pure sliding-window behaviour when no fixed interval is set.
		return this.acquireWithoutMinInterval()
	}

	/**
	 * The original acquire logic that only enforces the sliding-window quotas. It
	 * is extracted so that we can reuse it *after* satisfying the min-interval
	 * delay.
	 */
	private async acquireWithoutMinInterval(): Promise<void> {
		// Clean up expired timestamps that are outside the current window
		this.cleanupExpiredTimestamps()

		if (this.requestTimestamps.length < this.requestsPerWindow) {
			this.recordRequest()

			// Update the next allowed time if we have a min-interval configured.
			if (this.minIntervalMs !== undefined) {
				this.nextAvailableTime = Date.now() + this.minIntervalMs
			}

			return
		}

		// We are over the quota for the current window; wait until the oldest
		// request timestamp exits the window.
		return new Promise<void>((resolve) => {
			const oldestTimestamp = this.requestTimestamps[0]
			const timeToWait = oldestTimestamp + this.windowMs - Date.now()

			setTimeout(() => {
				this.cleanupExpiredTimestamps()
				this.recordRequest()

				if (this.minIntervalMs !== undefined) {
					this.nextAvailableTime = Date.now() + this.minIntervalMs
				}

				resolve()
			}, timeToWait + 1)
		})
	}

	/**
	 * Records the current request timestamp and adds it to the sliding window
	 */
	private recordRequest(): void {
		this.requestTimestamps.push(Date.now())
	}

	/**
	 * Removes timestamps that have fallen outside the current time window
	 */
	private cleanupExpiredTimestamps(): void {
		const cutoffTime = Date.now() - this.windowMs

		// Remove all timestamps that are older than the cutoff time
		while (this.requestTimestamps.length > 0 && this.requestTimestamps[0] <= cutoffTime) {
			this.requestTimestamps.shift()
		}
	}
}
