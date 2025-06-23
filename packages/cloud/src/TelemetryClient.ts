import { TelemetryEventName, type TelemetryEvent, rooCodeTelemetryEventSchema } from "@roo-code/types"
import { BaseTelemetryClient, TelemetryRetryQueue } from "@roo-code/telemetry"
import * as vscode from "vscode"

import { getRooCodeApiUrl } from "./Config"
import { AuthService } from "./AuthService"
import { SettingsService } from "./SettingsService"

export class TelemetryClient extends BaseTelemetryClient {
	private retryQueue: TelemetryRetryQueue | null = null
	private context: vscode.ExtensionContext | null = null

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

	/**
	 * Initialize the retry queue with VSCode extension context
	 */
	public initializeRetryQueue(context: vscode.ExtensionContext): void {
		this.context = context
		const retrySettings = context.globalState.get("telemetryRetrySettings") as Record<string, unknown> | undefined
		this.retryQueue = new TelemetryRetryQueue(context, retrySettings)

		// Start periodic retry processing
		setInterval(async () => {
			if (this.retryQueue) {
				await this.retryQueue.processQueue((event) => this.attemptDirectSend(event))
			}
		}, 30000) // 30 seconds
	}

	private async fetch(path: string, options: RequestInit) {
		if (!this.authService.isAuthenticated()) {
			return
		}

		const token = this.authService.getSessionToken()

		if (!token) {
			console.error(`[TelemetryClient#fetch] Unauthorized: No session token available.`)
			return
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
	}

	public override async capture(event: TelemetryEvent) {
		if (!this.isTelemetryEnabled() || !this.isEventCapturable(event.event)) {
			if (this.debug) {
				console.info(`[TelemetryClient#capture] Skipping event: ${event.event}`)
			}

			return
		}

		// Try to send immediately first
		const success = await this.attemptDirectSend(event)

		if (!success && this.retryQueue) {
			// If immediate send fails, add to retry queue
			const priority = this.isHighPriorityEvent(event.event) ? "high" : "normal"
			await this.retryQueue.enqueue(event, priority)
		}
	}

	/**
	 * Attempts to send a telemetry event directly without retry logic
	 */
	private async attemptDirectSend(event: TelemetryEvent): Promise<boolean> {
		try {
			const payload = {
				type: event.event,
				properties: await this.getEventProperties(event),
			}

			if (this.debug) {
				console.info(`[TelemetryClient#attemptDirectSend] ${JSON.stringify(payload)}`)
			}

			const result = rooCodeTelemetryEventSchema.safeParse(payload)

			if (!result.success) {
				console.error(
					`[TelemetryClient#attemptDirectSend] Invalid telemetry event: ${result.error.message} - ${JSON.stringify(payload)}`,
				)
				return false
			}

			await this.fetch(`events`, { method: "POST", body: JSON.stringify(result.data) })
			return true
		} catch (error) {
			console.warn(`[TelemetryClient#attemptDirectSend] Error sending telemetry event: ${error}`)
			return false
		}
	}

	/**
	 * Determines if an event should be treated as high priority
	 */
	private isHighPriorityEvent(eventName: TelemetryEventName): boolean {
		const highPriorityEvents = new Set([
			TelemetryEventName.SCHEMA_VALIDATION_ERROR,
			TelemetryEventName.DIFF_APPLICATION_ERROR,
			TelemetryEventName.SHELL_INTEGRATION_ERROR,
			TelemetryEventName.CONSECUTIVE_MISTAKE_ERROR,
		])
		return highPriorityEvents.has(eventName)
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
		if (this.retryQueue) {
			this.retryQueue.dispose()
		}
	}
}
