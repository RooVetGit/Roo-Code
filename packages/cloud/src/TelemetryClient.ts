import * as vscode from "vscode"
import {
	TelemetryEventName,
	type TelemetryEvent,
	rooCodeTelemetryEventSchema,
	type ClineMessage,
} from "@roo-code/types"
import { BaseTelemetryClient } from "@roo-code/telemetry"

import { getRooCodeApiUrl } from "./Config"
import type { AuthService } from "./auth"
import type { SettingsService } from "./SettingsService"
import { TelemetryQueue } from "./TelemetryQueue"

export class TelemetryClient extends BaseTelemetryClient {
	private queue: TelemetryQueue

	constructor(
		private context: vscode.ExtensionContext,
		private authService: AuthService,
		private settingsService: SettingsService,
		debug = false,
	) {
		super(
			{
				type: "exclude",
				events: [TelemetryEventName.TASK_CONVERSATION_MESSAGE],
			},
			debug,
		)
		this.queue = new TelemetryQueue(context, debug)
	}

	private async fetch(path: string, options: RequestInit): Promise<Response | undefined> {
		if (!this.authService.isAuthenticated()) {
			return undefined
		}

		const token = this.authService.getSessionToken()

		if (!token) {
			console.error(`[TelemetryClient#fetch] Unauthorized: No session token available.`)
			return undefined
		}

		const response = await fetch(`${getRooCodeApiUrl()}/api/${path}`, {
			...options,
			headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
		})

		if (!response.ok) {
			console.error(
				`[TelemetryClient#fetch] ${options.method} ${path} -> ${response.status} ${response.statusText}`,
			)
		}

		return response
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

		// Add event to queue
		await this.queue.enqueue(result.data)

		// Process queue asynchronously if not already processing
		if (!this.queue.isProcessingQueue()) {
			// Don't await - let it process in the background
			this.processQueue().catch((error) => {
				if (this.debug) {
					console.error(`[TelemetryClient#capture] Error processing queue:`, error)
				}
			})
		}
	}

	/**
	 * Processes the telemetry queue, sending events to the cloud service
	 */
	private async processQueue(): Promise<void> {
		if (!this.authService.isAuthenticated()) {
			if (this.debug) {
				console.info("[TelemetryClient#processQueue] Skipping: Not authenticated")
			}
			return
		}

		this.queue.setProcessingState(true)

		try {
			while (true) {
				const queuedEvent = await this.queue.peek()
				if (!queuedEvent) {
					break // Queue is empty
				}

				try {
					// Attempt to send the event
					const response = await this.fetch(`events`, {
						method: "POST",
						body: JSON.stringify(queuedEvent.event),
					})

					// Check if response indicates success (fetch doesn't throw on HTTP errors)
					if (response === undefined || (response && response.ok !== false)) {
						// Success - remove from queue
						await this.queue.dequeue(queuedEvent.id)

						if (this.debug) {
							console.info(`[TelemetryClient#processQueue] Successfully sent event ${queuedEvent.id}`)
						}
					} else {
						// HTTP error - mark as failed
						await this.queue.markFailed(queuedEvent.id)

						if (this.debug) {
							console.error(`[TelemetryClient#processQueue] HTTP error for event ${queuedEvent.id}`)
						}

						// Stop processing on error to avoid rapid retry loops
						break
					}
				} catch (error) {
					// Network or other error - mark as failed and move to end of queue
					await this.queue.markFailed(queuedEvent.id)

					if (this.debug) {
						console.error(`[TelemetryClient#processQueue] Failed to send event ${queuedEvent.id}:`, error)
					}

					// Stop processing on error to avoid rapid retry loops
					break
				}
			}
		} finally {
			this.queue.setProcessingState(false)
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

	public override async shutdown() {}
}
