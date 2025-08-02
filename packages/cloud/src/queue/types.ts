import { TelemetryEvent } from "@roo-code/types"

/**
 * Represents a telemetry event stored in the queue with metadata for processing
 */
export interface QueuedTelemetryEvent {
	/**
	 * Unique identifier for the queued event
	 * Format: "evt_<timestamp>_<random>"
	 */
	id: string

	/**
	 * Unix timestamp when the event was added to the queue
	 */
	timestamp: number

	/**
	 * The actual telemetry event to be sent
	 */
	event: TelemetryEvent

	/**
	 * Number of times this event has failed to send
	 */
	retryCount: number

	/**
	 * Unix timestamp of the last processing attempt
	 * undefined if never attempted
	 */
	lastAttemptTimestamp?: number

	/**
	 * Error message from the last failed attempt
	 * undefined if no failures or not attempted
	 */
	lastError?: string
}

/**
 * Interface for persisting the queue to storage
 */
export interface QueueStorage {
	/**
	 * Add a new event to the queue
	 * @param event The event to add
	 * @throws Error if storage fails
	 */
	add(event: QueuedTelemetryEvent): Promise<void>

	/**
	 * Remove an event from the queue by ID
	 * @param id The event ID to remove
	 * @returns true if removed, false if not found
	 */
	remove(id: string): Promise<boolean>

	/**
	 * Update an existing event in the queue
	 * @param event The updated event
	 * @returns true if updated, false if not found
	 */
	update(event: QueuedTelemetryEvent): Promise<boolean>

	/**
	 * Get all events in the queue, ordered by timestamp (FIFO)
	 * @returns Array of queued events
	 */
	getAll(): Promise<QueuedTelemetryEvent[]>

	/**
	 * Get the number of events in the queue
	 * @returns Count of queued events
	 */
	getCount(): Promise<number>

	/**
	 * Clear all events from the queue
	 */
	clear(): Promise<void>

	/**
	 * Get the total size of the queue in bytes
	 * @returns Size in bytes
	 */
	getSize(): Promise<number>
}

/**
 * Interface for processing events from the queue
 */
export interface QueueProcessor {
	/**
	 * Process a single queued event
	 * @param event The event to process
	 * @returns true if successfully processed, false otherwise
	 */
	process(event: QueuedTelemetryEvent): Promise<boolean>

	/**
	 * Check if the processor is ready to process events
	 * @returns true if ready (e.g., authenticated, connected)
	 */
	isReady(): Promise<boolean>
}

/**
 * Status information about the queue
 */
export interface QueueStatus {
	/**
	 * Number of events in the queue
	 */
	count: number

	/**
	 * Total size of the queue in bytes
	 */
	sizeInBytes: number

	/**
	 * Whether the queue is currently processing
	 */
	isProcessing: boolean

	/**
	 * Oldest event timestamp, undefined if queue is empty
	 */
	oldestEventTimestamp?: number

	/**
	 * Number of events with retry attempts
	 */
	failedEventCount: number
}

/**
 * Configuration options for the queue
 */
export interface QueueOptions {
	/**
	 * Maximum number of retry attempts before giving up on an event
	 * Default: 3
	 */
	maxRetries?: number

	/**
	 * Whether to automatically process the queue when new events are added
	 * Default: true
	 */
	processOnEnqueue?: boolean

	/**
	 * Maximum storage size in bytes (1MB = 1048576 bytes)
	 * Default: 1048576
	 */
	maxStorageSize?: number
}

/**
 * Represents a lock for multi-instance queue processing
 */
export interface QueueLock {
	/**
	 * Unique identifier of the instance holding the lock
	 */
	instanceId: string

	/**
	 * Unix timestamp when the lock was acquired
	 */
	acquiredAt: number

	/**
	 * Unix timestamp when the lock expires
	 */
	expiresAt: number

	/**
	 * Optional hostname for debugging
	 */
	hostname?: string
}

/**
 * Multi-instance behavior configuration
 */
export interface MultiInstanceConfig {
	/**
	 * Whether to enable multi-instance coordination
	 * Default: true
	 */
	enabled?: boolean

	/**
	 * Lock duration in milliseconds
	 * Default: 30000 (30 seconds)
	 */
	lockDurationMs?: number

	/**
	 * How often to check for expired locks in milliseconds
	 * Default: 5000 (5 seconds)
	 */
	lockCheckIntervalMs?: number

	/**
	 * Maximum time to wait for acquiring a lock in milliseconds
	 * Default: 10000 (10 seconds)
	 */
	lockAcquireTimeoutMs?: number

	/**
	 * Behavior when multiple instances are detected
	 * - 'compete': All instances compete for the lock (default)
	 * - 'leader': Only one instance processes (leader election)
	 * - 'disabled': No coordination, all instances process independently
	 */
	mode?: "compete" | "leader" | "disabled"
}

/**
 * Extended queue options with multi-instance support
 */
export interface QueueOptionsWithMultiInstance extends QueueOptions {
	/**
	 * Multi-instance configuration
	 */
	multiInstance?: MultiInstanceConfig
}
