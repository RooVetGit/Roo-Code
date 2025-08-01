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
	private telemetryQueue: TelemetryQueue | null = null
	private context: vscode.ExtensionContext | null = null
	private isOnline = true

	constructor(
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
	}

	public setContext(context: vscode.ExtensionContext): void {
		this.context = context

		try {
			this.telemetryQueue = new TelemetryQueue(context)

			// Process any queued events on initialization
			this.processQueuedEvents()
		} catch (error) {
			console.error(`Failed to initialize telemetry queue: ${error}`)
			// Continue without queue functionality
			this.telemetryQueue = null
		}
	}

	private async fetch(path: string, options: RequestInit): Promise<boolean> {
		if (!this.authService.isAuthenticated()) {
			return false
		}

		const token = this.authService.getSessionToken()

		if (!token) {
			console.error(`[TelemetryClient#fetch] Unauthorized: No session token available.`)
			return false
		}

		try {
			const response = await fetch(`${getRooCodeApiUrl()}/api/${path}`, {
				...options,
				headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
			})

			const isSuccess = response.ok

			if (!isSuccess) {
				console.error(
					`[TelemetryClient#fetch] ${options.method} ${path} -> ${response.status} ${response.statusText}`,
				)
			}

			// Update connection status based on response
			this.updateConnectionStatus(isSuccess || response.status < 500)

			return isSuccess
		} catch (error) {
			// Network error - we're offline
			console.error(`[TelemetryClient#fetch] Network error: ${error}`)
			this.updateConnectionStatus(false)
			return false
		}
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
			const success = await this.fetch(`events`, { method: "POST", body: JSON.stringify(result.data) })

			if (!success && this.telemetryQueue) {
				// Failed to send, add to queue
				await this.telemetryQueue.enqueue(event)
			}
		} catch (error) {
			console.error(`[TelemetryClient#capture] Error sending telemetry event: ${error}`)

			// Add to queue on error
			if (this.telemetryQueue) {
				await this.telemetryQueue.enqueue(event)
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
		if (this.telemetryQueue) {
			this.telemetryQueue.dispose()
		}
	}

	private updateConnectionStatus(isOnline: boolean): void {
		this.isOnline = isOnline

		if (this.telemetryQueue) {
			this.telemetryQueue.updateConnectionStatus(isOnline)

			// If we're back online, process queued events
			if (isOnline) {
				this.processQueuedEvents()
			}
		}
	}

	private async processQueuedEvents(): Promise<void> {
		if (!this.telemetryQueue) {
			return
		}

		await this.telemetryQueue.processQueue(async (event) => {
			// Reuse the capture logic but send directly
			const payload = {
				type: event.event,
				properties: await this.getEventProperties(event),
			}

			const result = rooCodeTelemetryEventSchema.safeParse(payload)

			if (!result.success) {
				// Invalid event, don't retry
				return true
			}

			return await this.fetch(`events`, { method: "POST", body: JSON.stringify(result.data) })
		})
	}

	public async checkConnection(): Promise<void> {
		// Simple health check to update connection status
		try {
			const response = await fetch(`${getRooCodeApiUrl()}/api/health`, {
				method: "GET",
				headers: { "Content-Type": "application/json" },
			})

			this.updateConnectionStatus(response.ok)
		} catch {
			this.updateConnectionStatus(false)
		}
	}

	public getConnectionStatus(): "online" | "offline" {
		return this.telemetryQueue?.getConnectionStatus() || "online"
	}

	public getQueueSize(): number {
		return this.telemetryQueue?.getQueueSize() || 0
	}
}
