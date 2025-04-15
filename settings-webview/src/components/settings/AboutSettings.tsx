import { useState } from "react"
import { Section, SectionHeader, Card, Toggle } from "../shared"

const AboutSettings = () => {
	const [telemetryEnabled, setTelemetryEnabled] = useState(true)
	const [crashReportsEnabled, setCrashReportsEnabled] = useState(true)

	return (
		<div className="flex flex-col gap-4">
			<Section>
				<SectionHeader description="Information about the extension">About Roo Code</SectionHeader>

				<Card title="Version Information">
					<div className="flex gap-2 mb-3">
						<span className="font-semibold min-w-[120px]">Version:</span>
						<span>3.11.12</span>
					</div>
					<div className="flex gap-2 mb-3">
						<span className="font-semibold min-w-[120px]">Build Date:</span>
						<span>April 11, 2025</span>
					</div>
					<div className="flex gap-2 mb-3">
						<span className="font-semibold min-w-[120px]">Documentation:</span>
						<a
							href="https://github.com/Roo-Code/roo-code"
							target="_blank"
							className="text-vscode-button-bg hover:underline">
							GitHub Repository
						</a>
					</div>
				</Card>
			</Section>

			<Section>
				<SectionHeader description="Configure telemetry preferences">Telemetry Settings</SectionHeader>

				<Card>
					<Toggle
						id="telemetry-enabled"
						label="Enable Telemetry"
						description="Allow the extension to collect anonymous usage data to help improve the product"
						checked={telemetryEnabled}
						onChange={setTelemetryEnabled}
					/>

					<Toggle
						id="crash-reports-enabled"
						label="Enable Crash Reports"
						description="Allow the extension to send crash reports to help improve stability"
						checked={crashReportsEnabled}
						onChange={setCrashReportsEnabled}
					/>
				</Card>
			</Section>
		</div>
	)
}

export default AboutSettings
