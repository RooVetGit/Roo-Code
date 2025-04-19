import { Section, SectionHeader, Card } from "../shared"

const SettingsSettings = () => {
	return (
		<div className="flex flex-col gap-4">
			<Section>
				<SectionHeader description="Configure application settings">Settings</SectionHeader>

				<Card title="Application Settings">
					<p className="text-vscode-fg">This section contains general application settings.</p>
				</Card>
			</Section>
		</div>
	)
}

export default SettingsSettings
