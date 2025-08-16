import { PostHog } from "posthog-node"
import * as vscode from "vscode"

import { TelemetryEventName, type TelemetryEvent } from "@roo-code/types"

import { QueuedTelemetryClient } from "./QueuedTelemetryClient"

/**
 * PostHogTelemetryClient handles telemetry event tracking for the Roo Code extension.
 * Uses PostHog analytics to track user interactions and system events.
 * Respects user privacy settings and VSCode's global telemetry configuration.
 * Includes automatic queuing and retry for failed events.
 */
export class PostHogTelemetryClient extends QueuedTelemetryClient {
	private client: PostHog
	private distinctId: string = vscode.env.machineId
	// Git repository properties that should be filtered out
	private readonly gitPropertyNames = ["repositoryUrl", "repositoryName", "defaultBranch"]

	constructor(context: vscode.ExtensionContext, debug = false) {
		// Use workspace-specific storage to avoid conflicts between multiple VS Code windows
		const storagePath = context.storageUri?.fsPath || context.globalStorageUri?.fsPath || context.extensionPath

		super(
			"posthog",
			storagePath,
			{
				type: "exclude",
				events: [TelemetryEventName.TASK_MESSAGE, TelemetryEventName.LLM_COMPLETION],
			},
			debug,
		)

		this.client = new PostHog(process.env.POSTHOG_API_KEY || "", {
			host: "https://us.i.posthog.com",
			// Disable PostHog's internal retry mechanism since we handle our own
			flushAt: 1, // Flush after every event
			flushInterval: 0, // Disable automatic flushing
		})

		// Disable PostHog's internal error logging to reduce noise
		this.client.on("error", (error) => {
			console.error("[PostHogTelemetryClient] PostHog internal error:", error)
		})
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

	/**
	 * Send event to PostHog (called by the base class)
	 */
	protected async sendEvent(event: TelemetryEvent): Promise<void> {
		const properties = await this.getEventProperties(event)

		// PostHog queues events internally and flushes them in batches
		// We need to force a flush to know if the send actually succeeded
		try {
			this.client.capture({
				distinctId: this.distinctId,
				event: event.event,
				properties,
			})

			// Force immediate flush to detect network errors
			// This will throw if there's a network issue
			await this.client.flush()
		} catch (error) {
			// Differentiate between different types of errors
			const errorMessage = error instanceof Error ? error.message : String(error)

			// Check if it's a configuration error that won't be fixed by retrying
			const isConfigError =
				errorMessage.toLowerCase().includes("api key") ||
				errorMessage.toLowerCase().includes("invalid configuration")

			if (isConfigError) {
				// Don't queue config errors - they won't succeed on retry
				// Silently fail for config errors to not break the extension
				return
			}

			// Re-throw network and other transient errors to trigger queuing
			throw error
		}
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
		if (this.telemetryEnabled) {
			this.client.optIn()
		} else {
			this.client.optOut()
		}
	}

	public override async shutdown(): Promise<void> {
		// First shutdown the queue processing
		await super.shutdown()
		// Then shutdown the PostHog client
		await this.client.shutdown()
	}
}
