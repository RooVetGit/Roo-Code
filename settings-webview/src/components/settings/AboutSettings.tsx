import { useState } from "react"
import { makeStyles, shorthands, Text, Link, tokens } from "@fluentui/react-components"
import { Section, SectionHeader, Card, Toggle } from "../shared"

const useStyles = makeStyles({
	root: {
		display: "flex",
		flexDirection: "column",
		...shorthands.gap("16px"),
	},
	infoRow: {
		display: "flex",
		...shorthands.gap("8px"),
		marginBottom: "12px",
	},
	label: {
		fontWeight: tokens.fontWeightSemibold,
		minWidth: "120px",
		color: tokens.colorNeutralForeground1,
	},
	value: {
		color: tokens.colorNeutralForeground1,
	},
})

const AboutSettings = () => {
	const styles = useStyles()
	const [telemetryEnabled, setTelemetryEnabled] = useState(true)
	const [crashReportsEnabled, setCrashReportsEnabled] = useState(true)

	return (
		<div className={styles.root}>
			<Section>
				<SectionHeader description="Information about the extension">About Roo Code</SectionHeader>

				<Card title="Version Information">
					<div className={styles.infoRow}>
						<Text className={styles.label}>Version:</Text>
						<Text className={styles.value}>3.11.12</Text>
					</div>
					<div className={styles.infoRow}>
						<Text className={styles.label}>Build Date:</Text>
						<Text className={styles.value}>April 11, 2025</Text>
					</div>
					<div className={styles.infoRow}>
						<Text className={styles.label}>Documentation:</Text>
						<Link href="https://github.com/Roo-Code/roo-code" target="_blank">
							GitHub Repository
						</Link>
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
