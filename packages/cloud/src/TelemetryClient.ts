import {
	TelemetryEventName,
	type TelemetryEvent,
	rooCodeTelemetryEventSchema,
	type ClineMessage,
} from "@roo-code/types"
import { BaseTelemetryClient } from "@roo-code/telemetry"
import * as vscode from "vscode"

import { getRooCodeApiUrl } from "./Config"
import type { AuthService } from "./auth"
import type { SettingsService } from "./SettingsService"
import { TelemetryQueue, TelemetryRetryManager } from "./telemetry"

export class TelemetryClient extends BaseTelemetryClient {
	private queue?: TelemetryQueue
	private retryManager?: TelemetryRetryManager
	private connectionStatusCallback?: (isConnected: boolean) => void
	private queueSizeCallback?: (size: number, isAboveWarningThreshold: boolean) => void

	constructor(
		private authService: AuthService,
		private settingsService: SettingsService,
		private context?: vscode.ExtensionContext,
		debug = false,
	) {
		super(
			{
				type: "exclude",
				events: [TelemetryEventName.TASK_CONVERSATION_MESSAGE],
			},
			debug,
		)

		// Initialize queue and retry manager if context is provided
		if (context) {
			// Initialize queue
			this.queue = new TelemetryQueue(context, {
				maxQueueSize: 1000,
				maxRetries: 5,
				queueSizeWarningThreshold: 100,
			})

			// Initialize retry manager
			this.retryManager = new TelemetryRetryManager(
				this.queue,
				async (event) => {
					// Send event without queueing on retry
					await this.sendEventDirect(event)
				},
				{
					retryIntervalMs: 30000, // 30 seconds
					batchSize: 10,
					onConnectionStatusChange: (isConnected) => {
						if (this.connectionStatusCallback) {
							this.connectionStatusCallback(isConnected)
						}
					},
					onQueueSizeChange: (size, isAboveWarningThreshold) => {
						if (this.queueSizeCallback) {
							this.queueSizeCallback(size, isAboveWarningThreshold)
						}
					},
				},
			)

			// Start the retry manager
			this.retryManager.start()
		}
	}

	/**
	 * Sets a callback for connection status changes
	 */
	public setConnectionStatusCallback(callback: (isConnected: boolean) => void): void {
		this.connectionStatusCallback = callback
	}

	/**
	 * Sets a callback for queue size changes
	 */
	public setQueueSizeCallback(callback: (size: number, isAboveWarningThreshold: boolean) => void): void {
		this.queueSizeCallback = callback
	}

	/**
	 * Gets the current connection status
	 */
	public getConnectionStatus(): boolean {
		return this.retryManager?.getConnectionStatus() ?? true
	}

	/**
	 * Gets the current queue metadata
	 */
	public async getQueueMetadata() {
		if (!this.queue) {
			return null
		}
		return this.queue.getQueueMetadata()
	}

	/**
	 * Manually triggers a retry of queued events
	 */
	public async triggerRetry(): Promise<void> {
		if (this.retryManager) {
			await this.retryManager.triggerRetry()
		}
	}

	private async fetch(path: string, options: RequestInit) {
		if (!this.authService.isAuthenticated()) {
			throw new Error("Not authenticated")
		}

		const token = this.authService.getSessionToken()

		if (!token) {
			throw new Error("No session token available")
		}

		const response = await fetch(`${getRooCodeApiUrl()}/api/${path}`, {
			...options,
			headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
		})

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`)
		}

		return response
	}

	/**
	 * Sends an event directly without queueing (used by retry manager)
	 */
	private async sendEventDirect(event: TelemetryEvent): Promise<void> {
		const payload = {
			type: event.event,
			properties: event.properties || {},
		}

		const result = rooCodeTelemetryEventSchema.safeParse(payload)

		if (!result.success) {
			throw new Error(`Invalid telemetry event: ${result.error.message}`)
		}

		await this.fetch(`events`, { method: "POST", body: JSON.stringify(result.data) })
	}

	public override async capture(event: TelemetryEvent) {
		if (!this.isTelemetryEnabled() || !this.isEventCapturable(event.event)) {
			if (this.debug) {
				console.info(`[TelemetryClient#capture] Skipping event: ${event.event}`)
			}
			return
		}

		const payload = {
			type: event.event,
			properties: await this.getEventProperties(event),
		}

		if (this.debug) {
			console.info(`[TelemetryClient#capture] ${JSON.stringify(payload)}`)
		}

		const result = rooCodeTelemetryEventSchema.safeParse(payload)

		if (!result.success) {
			console.error(
				`[TelemetryClient#capture] Invalid telemetry event: ${result.error.message} - ${JSON.stringify(payload)}`,
			)
			return
		}

		try {
			await this.fetch(`events`, { method: "POST", body: JSON.stringify(result.data) })
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error(`[TelemetryClient#capture] Error sending telemetry event: ${errorMessage}`)

			// Queue the event for retry if we have a queue
			if (this.queue && this.retryManager) {
				await this.retryManager.queueFailedEvent(event, errorMessage)
			}
		}
	}

	public async backfillMessages(messages: ClineMessage[], taskId: string): Promise<void> {
		if (!this.authService.isAuthenticated()) {
			if (this.debug) {
				console.info(`[TelemetryClient#backfillMessages] Skipping: Not authenticated`)
			}
			return
		}

		const token = this.authService.getSessionToken()

		if (!token) {
			console.error(`[TelemetryClient#backfillMessages] Unauthorized: No session token available.`)
			return
		}

		try {
			const mergedProperties = await this.getEventProperties({
				event: TelemetryEventName.TASK_MESSAGE,
				properties: { taskId },
			})

			const formData = new FormData()
			formData.append("taskId", taskId)
			formData.append("properties", JSON.stringify(mergedProperties))

			formData.append(
				"file",
				new File([JSON.stringify(messages)], "task.json", {
					type: "application/json",
				}),
			)

			if (this.debug) {
				console.info(
					`[TelemetryClient#backfillMessages] Uploading ${messages.length} messages for task ${taskId}`,
				)
			}

			// Custom fetch for multipart - don't set Content-Type header (let browser set it)
			const response = await fetch(`${getRooCodeApiUrl()}/api/events/backfill`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					// Note: No Content-Type header - browser will set multipart/form-data with boundary
				},
				body: formData,
			})

			if (!response.ok) {
				console.error(
					`[TelemetryClient#backfillMessages] POST events/backfill -> ${response.status} ${response.statusText}`,
				)
			} else if (this.debug) {
				console.info(`[TelemetryClient#backfillMessages] Successfully uploaded messages for task ${taskId}`)
			}
		} catch (error) {
			console.error(`[TelemetryClient#backfillMessages] Error uploading messages: ${error}`)
		}
	}

	public override updateTelemetryState(_didUserOptIn: boolean) {}

	public override isTelemetryEnabled(): boolean {
		return true
	}

	protected override isEventCapturable(eventName: TelemetryEventName): boolean {
		// Ensure that this event type is supported by the telemetry client
		if (!super.isEventCapturable(eventName)) {
			return false
		}

		// Only record message telemetry if a cloud account is present and explicitly configured to record messages
		if (eventName === TelemetryEventName.TASK_MESSAGE) {
			return this.settingsService.getSettings()?.cloudSettings?.recordTaskMessages || false
		}

		// Other telemetry types are capturable at this point
		return true
	}

	public override async shutdown() {
		// Stop the retry manager
		if (this.retryManager) {
			this.retryManager.stop()
		}
		// Clear callbacks to prevent memory leaks
		this.connectionStatusCallback = undefined
		this.queueSizeCallback = undefined
	}
}
