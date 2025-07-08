import { type TelemetryEvent } from "@roo-code/types"
import { BaseTelemetryClient } from "./BaseTelemetryClient"

/**
 * OnPremTelemetryClient for on-premises deployments.
 * When ON_PREM environment variable is set to "true", all telemetry is disabled.
 * This ensures no data leaves the corporate network.
 */
export class OnPremTelemetryClient extends BaseTelemetryClient {
	private isOnPremMode: boolean

	constructor(debug = false) {
		super(
			{
				type: "exclude",
				events: [], // No events excluded by default
			},
			debug,
		)

		// Check ON_PREM environment variable
		this.isOnPremMode = process.env.ON_PREM === "true"

		if (this.debug) {
			if (this.isOnPremMode) {
				console.info("[OnPremTelemetryClient] ON_PREM mode: All telemetry disabled")
			} else {
				console.info("[OnPremTelemetryClient] Standard mode: Telemetry enabled")
			}
		}
	}

	public override async capture(event: TelemetryEvent): Promise<void> {
		if (this.isOnPremMode) {
			if (this.debug) {
				console.info(
					`[OnPremTelemetryClient#capture] ON_PREM mode: Telemetry disabled - skipping ${event.event}`,
				)
			}
			return
		}

		if (this.debug) {
			console.info(
				`[OnPremTelemetryClient#capture] OnPremTelemetryClient: Telemetry enabled - capturing ${event.event}`,
			)
		}

		// In normal mode, we would delegate to actual telemetry implementation
		// For now, this is a no-op implementation as this is primarily for blocking
	}

	public override isTelemetryEnabled(): boolean {
		return !this.isOnPremMode
	}

	public override updateTelemetryState(_didUserOptIn: boolean): void {
		// No-op: ON_PREM mode is controlled via environment variable only
	}

	public override async shutdown(): Promise<void> {
		// No-op: Nothing to clean up
	}
}
