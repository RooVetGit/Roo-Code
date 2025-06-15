import {
	TelemetryEvent,
	TelemetryEventName,
	TelemetryClient,
	TelemetryPropertiesProvider,
	TelemetryEventSubscription,
} from "@roo-code/types"

export abstract class BaseTelemetryClient implements TelemetryClient {
	protected providerRef: WeakRef<TelemetryPropertiesProvider> | null = null
	protected telemetryEnabled: boolean = false

	constructor(
		public readonly subscription?: TelemetryEventSubscription,
		protected readonly debug = false,
	) {}

	protected isEventCapturable(eventName: TelemetryEventName): boolean {
		if (!this.subscription) {
			return true
		}

		return this.subscription.type === "include"
			? this.subscription.events.includes(eventName)
			: !this.subscription.events.includes(eventName)
	}

	protected async getEventProperties(event: TelemetryEvent): Promise<TelemetryEvent["properties"]> {
		let providerProperties: TelemetryEvent["properties"] = {}
		const provider = this.providerRef?.deref()

		if (provider) {
			try {
				// Get the telemetry properties directly from the provider.
				// For cloud telemetry clients, use cloud-specific properties if available.
				if (this.isCloudTelemetryClient() && provider.getCloudTelemetryProperties) {
					providerProperties = await provider.getCloudTelemetryProperties()
				} else {
					providerProperties = await provider.getTelemetryProperties()
				}
			} catch (error) {
				// Log error but continue with capturing the event.
				console.error(
					`Error getting telemetry properties: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}

		// Merge provider properties with event-specific properties.
		// Event properties take precedence in case of conflicts.
		return { ...providerProperties, ...(event.properties || {}) }
	}

	/**
	 * Determines if this is a cloud telemetry client that should receive extended properties
	 * Override in subclasses to identify cloud telemetry clients
	 */
	protected isCloudTelemetryClient(): boolean {
		return false
	}

	public abstract capture(event: TelemetryEvent): Promise<void>

	public setProvider(provider: TelemetryPropertiesProvider): void {
		this.providerRef = new WeakRef(provider)
	}

	public abstract updateTelemetryState(didUserOptIn: boolean): void

	public isTelemetryEnabled(): boolean {
		return this.telemetryEnabled
	}

	public abstract shutdown(): Promise<void>
}
