/**
 * Retry Handler with Exponential Backoff and Jitter
 *
 * This utility provides a configurable retry mechanism with exponential backoff strategy
 * for handling transient failures in asynchronous operations. Key features include:
 *
 * 1. Exponential Backoff: Progressively increases the delay between retry attempts
 *    to reduce system load during recovery periods.
 *
 * 2. Maximum Delay Cap: Prevents retry delays from growing beyond a reasonable threshold.
 *
 * 3. Jitter: Optional randomization of delay times to prevent thundering herd problems
 *    when multiple clients retry simultaneously.
 *
 * 4. Selective Retry: Allows precise control over which errors should trigger a retry
 *    through a customizable predicate function.
 */

/**
 * Configuration options for the RetryHandler
 */
export interface RetryHandlerOptions {
	/**
	 * The maximum number of retry attempts before giving up.
	 * Default: 5
	 */
	maxRetries?: number

	/**
	 * The initial delay in milliseconds before the first retry.
	 * Default: 1000 (1 second)
	 */
	initialDelay?: number

	/**
	 * The maximum delay in milliseconds that the backoff is allowed to reach.
	 * Default: 30000 (30 seconds)
	 */
	maxDelay?: number

	/**
	 * The multiplier for the exponential backoff calculation.
	 * Each retry will wait approximately backoffFactor times longer than the previous attempt.
	 * Default: 2
	 */
	backoffFactor?: number

	/**
	 * Whether to apply random jitter to the delay to prevent retry storms.
	 * When true, adds a random factor between 0.5 and 1.5 to the delay.
	 * Default: true
	 */
	jitter?: boolean
}

export class RetryHandler {
	private readonly maxRetries: number
	private readonly initialDelay: number
	private readonly maxDelay: number
	private readonly backoffFactor: number
	private readonly jitter: boolean

	/**
	 * Creates a new instance of the RetryHandler
	 * @param options Configuration options for the retry handler
	 */
	constructor(options?: RetryHandlerOptions) {
		this.maxRetries = options?.maxRetries ?? 5
		this.initialDelay = options?.initialDelay ?? 1000
		this.maxDelay = options?.maxDelay ?? 30000
		this.backoffFactor = options?.backoffFactor ?? 2
		this.jitter = options?.jitter ?? true

		// Validate configuration values
		if (this.maxRetries < 0) {
			throw new Error("maxRetries must be a non-negative number")
		}
		if (this.initialDelay <= 0) {
			throw new Error("initialDelay must be a positive number")
		}
		if (this.maxDelay <= 0) {
			throw new Error("maxDelay must be a positive number")
		}
		if (this.maxDelay < this.initialDelay) {
			throw new Error("maxDelay must be greater than or equal to initialDelay")
		}
		if (this.backoffFactor <= 0) {
			throw new Error("backoffFactor must be a positive number")
		}
	}

	/**
	 * Executes the provided function with retry logic
	 *
	 * @param fn The asynchronous function to execute and retry on failure
	 * @param shouldRetry A predicate function that determines whether a given error should trigger a retry
	 * @returns A promise that resolves with the result of the function or rejects with the last error
	 */
	public async execute<T>(fn: () => Promise<T>, shouldRetry: (error: any) => boolean): Promise<T> {
		let lastError: any

		for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
			try {
				// Attempt to execute the function
				return await fn()
			} catch (error) {
				// Save the error for potential re-throw
				lastError = error

				// If we've exhausted all retry attempts or shouldn't retry this error, give up
				if (attempt >= this.maxRetries || !shouldRetry(error)) {
					throw error
				}

				// Calculate delay for the next retry
				const delay = this.calculateDelay(attempt)

				// Wait before the next attempt
				await this.wait(delay)
			}
		}

		// This should never be reached due to the throw in the loop,
		// but TypeScript requires a return statement
		throw lastError
	}

	/**
	 * Calculates the delay for a specific retry attempt using exponential backoff
	 * and optional jitter
	 *
	 * @param attempt The current retry attempt (0-based)
	 * @returns The calculated delay in milliseconds
	 */
	private calculateDelay(attempt: number): number {
		// Calculate base delay with exponential backoff: initialDelay * (backoffFactor ^ attempt)
		let delay = this.initialDelay * Math.pow(this.backoffFactor, attempt)

		// Apply jitter if enabled
		if (this.jitter) {
			// Apply a random factor between 0.5 and 1.5
			const jitterFactor = 0.5 + Math.random()
			delay *= jitterFactor
		}

		// Ensure the delay doesn't exceed the maximum
		return Math.min(delay, this.maxDelay)
	}

	/**
	 * Returns a promise that resolves after the specified delay
	 *
	 * @param ms The delay in milliseconds
	 * @returns A promise that resolves after the delay
	 */
	private wait(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}
}
