import { QueueProcessor, QueuedTelemetryEvent } from "./types"
import { TelemetryClient } from "../TelemetryClient"

/**
 * Processes queued telemetry events by sending them to the cloud
 */
export class CloudQueueProcessor implements QueueProcessor {
	constructor(private telemetryClient: TelemetryClient) {}

	async process(event: QueuedTelemetryEvent): Promise<boolean> {
		try {
			// Use the telemetry client to send the event
			await this.telemetryClient.capture(event.event)
			console.debug(`[CloudQueueProcessor] Successfully processed event ${event.id}`)
			return true
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error(`[CloudQueueProcessor] Failed to process event ${event.id}:`, errorMessage)

			// Store error for debugging
			event.lastError = errorMessage

			// Determine if we should retry based on error type
			if (this.isRetryableError(error)) {
				return false
			}

			// Non-retryable error, consider it "processed" to remove from queue
			console.warn(`[CloudQueueProcessor] Non-retryable error for event ${event.id}, removing from queue`)
			return true
		}
	}

	async isReady(): Promise<boolean> {
		// Always ready - no connection detection per requirements
		return true
	}

	private isRetryableError(error: unknown): boolean {
		const errorMessage = error instanceof Error ? error.message : String(error)

		// Don't retry validation errors
		if (errorMessage.includes("validation") || errorMessage.includes("invalid")) {
			return false
		}

		// Don't retry authentication errors (user needs to re-authenticate)
		if (errorMessage.includes("401") || errorMessage.includes("403") || errorMessage.includes("Unauthorized")) {
			return false
		}

		// Don't retry if the event schema is invalid
		if (errorMessage.includes("Invalid telemetry event")) {
			return false
		}

		// Retry network and server errors
		return true
	}
}
