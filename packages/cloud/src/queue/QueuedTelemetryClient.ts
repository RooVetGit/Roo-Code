import * as vscode from "vscode"
import { TelemetryEvent, TelemetryEventName, TelemetryPropertiesProvider } from "@roo-code/types"
import { BaseTelemetryClient } from "@roo-code/telemetry"
import { TelemetryEventQueue } from "./TelemetryEventQueue"
import { GlobalStateQueueStorage } from "./GlobalStateQueueStorage"
import { CloudQueueProcessor } from "./CloudQueueProcessor"
import { TelemetryClient } from "../TelemetryClient"
import type { QueueStatus, MultiInstanceConfig, QueueOptionsWithMultiInstance } from "./types"

/**
 * A telemetry client that queues events for reliable delivery
 * Events are persisted to VS Code's globalState and processed in FIFO order
 * Supports multi-instance coordination to prevent race conditions
 */
export class QueuedTelemetryClient extends BaseTelemetryClient {
	private queue: TelemetryEventQueue
	private storage: GlobalStateQueueStorage
	private processingInterval?: NodeJS.Timeout

	constructor(
		private cloudClient: TelemetryClient,
		private context: vscode.ExtensionContext,
		debug = false,
		multiInstanceConfig?: MultiInstanceConfig,
	) {
		super(
			{
				type: "exclude",
				events: [TelemetryEventName.TASK_CONVERSATION_MESSAGE],
			},
			debug,
		)

		// Initialize queue components with multi-instance support
		this.storage = new GlobalStateQueueStorage(context, undefined, multiInstanceConfig)
		const processor = new CloudQueueProcessor(cloudClient)

		const queueOptions: QueueOptionsWithMultiInstance = {
			processOnEnqueue: true,
			multiInstance: multiInstanceConfig,
		}

		this.queue = new TelemetryEventQueue(this.storage, processor, queueOptions)

		// Log instance information
		const instanceInfo = this.storage.getInstanceInfo()
		console.info(
			`[QueuedTelemetryClient] Initialized with instance: ${instanceInfo.instanceId} on ${instanceInfo.hostname}`,
		)

		// Set up periodic processing if in leader mode
		if (multiInstanceConfig?.mode === "leader") {
			this.setupPeriodicProcessing()
		}
	}

	/**
	 * Set up periodic queue processing for leader mode
	 */
	private setupPeriodicProcessing(): void {
		const interval = this.storage["multiInstanceConfig"].lockCheckIntervalMs || 5000

		this.processingInterval = setInterval(async () => {
			try {
				// Only process if we can acquire the lock (leader election)
				const processed = await this.queue.processQueue()
				if (processed > 0) {
					console.debug(`[QueuedTelemetryClient] Periodic processing: ${processed} events`)
				}
			} catch (error) {
				console.error("[QueuedTelemetryClient] Periodic processing error:", error)
			}
		}, interval)
	}

	/**
	 * Capture a telemetry event by adding it to the queue
	 */
	public override async capture(event: TelemetryEvent): Promise<void> {
		if (!this.isTelemetryEnabled() || !this.isEventCapturable(event.event)) {
			if (this.debug) {
				console.info(`[QueuedTelemetryClient#capture] Skipping event: ${event.event}`)
			}
			return
		}

		// Add to queue instead of sending directly
		await this.queue.enqueue(event)
	}

	/**
	 * Manually trigger queue processing
	 * Returns the number of events successfully processed
	 */
	public async processQueue(): Promise<number> {
		return this.queue.processQueue()
	}

	/**
	 * Get the current status of the queue
	 */
	public async getQueueStatus(): Promise<
		QueueStatus & {
			instanceInfo?: {
				instanceId: string
				hostname: string
				multiInstanceEnabled: boolean
				multiInstanceMode: string
			}
		}
	> {
		const status = await this.queue.getStatus()
		const instanceInfo = this.storage.getInstanceInfo()

		return {
			...status,
			instanceInfo: {
				...instanceInfo,
				multiInstanceEnabled: this.storage["multiInstanceConfig"].enabled,
				multiInstanceMode: this.storage["multiInstanceConfig"].mode,
			},
		}
	}

	/**
	 * Clear all events from the queue
	 */
	public async clearQueue(): Promise<void> {
		await this.queue.clear()
	}

	/**
	 * Update telemetry state
	 */
	public override updateTelemetryState(didUserOptIn: boolean): void {
		this.cloudClient.updateTelemetryState(didUserOptIn)
		this.telemetryEnabled = didUserOptIn
	}

	/**
	 * Check if telemetry is enabled
	 */
	public override isTelemetryEnabled(): boolean {
		return this.cloudClient.isTelemetryEnabled()
	}

	/**
	 * Check if a specific event is capturable
	 */
	protected override isEventCapturable(eventName: TelemetryEventName): boolean {
		// Use parent class logic for subscription filtering
		return super.isEventCapturable(eventName)
	}

	/**
	 * Set the telemetry provider
	 */
	public override setProvider(provider: TelemetryPropertiesProvider): void {
		super.setProvider(provider)
		this.cloudClient.setProvider(provider)
	}

	/**
	 * Shutdown the client and process any remaining events
	 */
	public override async shutdown(): Promise<void> {
		// Stop periodic processing
		if (this.processingInterval) {
			clearInterval(this.processingInterval)
			this.processingInterval = undefined
		}

		// Process any remaining events before shutdown
		try {
			const processed = await this.queue.processQueue()
			console.info(`[QueuedTelemetryClient] Processed ${processed} events during shutdown`)
		} catch (error) {
			console.error("[QueuedTelemetryClient] Failed to process queue during shutdown:", error)
		}

		// Cleanup queue resources
		await this.queue.shutdown()

		// Shutdown the underlying cloud client
		await this.cloudClient.shutdown()
	}

	/**
	 * Force process the queue (useful for testing or manual triggers)
	 */
	public async forceProcessQueue(): Promise<number> {
		console.info("[QueuedTelemetryClient] Force processing queue")
		return this.queue.processQueue()
	}

	/**
	 * Get multi-instance lock statistics
	 */
	public async getLockStats(): Promise<{
		hasLock: boolean
		lockHolder?: string
		lockAge?: number
		isExpired?: boolean
	}> {
		return this.storage.getLockStats()
	}
}
