// No need for Fluent UI imports
import { Section, SectionHeader, Card } from "../shared"

interface PlaceholderSettingsProps {
	categoryId: string
	categoryName: string
}

const PlaceholderSettings = ({ categoryId, categoryName }: PlaceholderSettingsProps) => {
	return (
		<div className="flex flex-col gap-4">
			<Section>
				<SectionHeader description={`This section will contain ${categoryName.toLowerCase()} settings`}>
					{categoryName} Settings
				</SectionHeader>

				<Card title={`${categoryName} Configuration`}>
					<p className="text-vscode-fg">
						Settings content for {categoryId} will be implemented here. This is a placeholder for the{" "}
						{categoryId} category.
					</p>
				</Card>
			</Section>
		</div>
	)
}

export default PlaceholderSettings
