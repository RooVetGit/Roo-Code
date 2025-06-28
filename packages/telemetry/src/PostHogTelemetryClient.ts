import { PostHog } from "posthog-node"
import * as vscode from "vscode"

import { TelemetryEventName, type TelemetryEvent } from "@roo-code/types"

import { BaseTelemetryClient } from "./BaseTelemetryClient"

/**
 * PostHogTelemetryClient handles telemetry event tracking for the Roo Code extension.
 * Uses PostHog analytics to track user interactions and system events.
 * Respects user privacy settings and VSCode's global telemetry configuration.
 */
export class PostHogTelemetryClient extends BaseTelemetryClient {
	private client?: PostHog
	private distinctId: string = vscode.env.machineId
	// Git repository properties that should be filtered out
	private readonly gitPropertyNames = ["repositoryUrl", "repositoryName", "defaultBranch"]

	constructor(debug = false) {
		super(
			{
				type: "exclude",
				events: [TelemetryEventName.TASK_MESSAGE, TelemetryEventName.LLM_COMPLETION],
			},
			debug,
		)

		const apiKey = process.env.POSTHOG_API_KEY
		if (apiKey) {
			this.client = new PostHog(apiKey, { host: "https://us.i.posthog.com" })
		} else {
			console.warn("[PostHogTelemetryClient] POSTHOG_API_KEY is not set. Telemetry will be disabled.")
		}
	}

	/**
	 * Filter out git repository properties for PostHog telemetry
	 * @param propertyName The property name to check
	 * @returns Whether the property should be included in telemetry events
	 */
	protected override isPropertyCapturable(propertyName: string): boolean {
		// Filter out git repository properties
		if (this.gitPropertyNames.includes(propertyName)) {
			return false
		}
		return true
	}

	public override async capture(event: TelemetryEvent): Promise<void> {
		if (!this.client || !this.isTelemetryEnabled() || !this.isEventCapturable(event.event)) {
			if (this.debug && this.client) {
				console.info(`[PostHogTelemetryClient#capture] Skipping event: ${event.event}`)
			}
			return
		}

		if (this.debug) {
			console.info(`[PostHogTelemetryClient#capture] ${event.event}`)
		}

		this.client.capture({
			distinctId: this.distinctId,
			event: event.event,
			properties: await this.getEventProperties(event),
		})
	}

	/**
	 * Updates the telemetry state based on user preferences and VSCode settings.
	 * Only enables telemetry if both VSCode global telemetry is enabled and
	 * user has opted in.
	 * @param didUserOptIn Whether the user has explicitly opted into telemetry
	 */
	public override updateTelemetryState(didUserOptIn: boolean): void {
		this.telemetryEnabled = false

		// First check global telemetry level - telemetry should only be enabled when level is "all".
		const telemetryLevel = vscode.workspace.getConfiguration("telemetry").get<string>("telemetryLevel", "all")
		const globalTelemetryEnabled = telemetryLevel === "all"

		// We only enable telemetry if global vscode telemetry is enabled.
		if (globalTelemetryEnabled) {
			this.telemetryEnabled = didUserOptIn
		}

		// Update PostHog client state based on telemetry preference.
		if (!this.client) {
			return
		}
		if (this.telemetryEnabled) {
			this.client.optIn()
		} else {
			this.client.optOut()
		}
	}

	public override async shutdown(): Promise<void> {
		if (this.client) {
			await this.client.shutdown()
		}
	}
}
