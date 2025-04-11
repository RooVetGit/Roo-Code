import { makeStyles, shorthands, Text } from "@fluentui/react-components"
import { Section, SectionHeader, Card } from "../shared"

const useStyles = makeStyles({
	root: {
		display: "flex",
		flexDirection: "column",
		...shorthands.gap("16px"),
	},
})

interface PlaceholderSettingsProps {
	categoryId: string
	categoryName: string
}

const PlaceholderSettings = ({ categoryId, categoryName }: PlaceholderSettingsProps) => {
	const styles = useStyles()

	return (
		<div className={styles.root}>
			<Section>
				<SectionHeader description={`This section will contain ${categoryName.toLowerCase()} settings`}>
					{categoryName} Settings
				</SectionHeader>

				<Card title={`${categoryName} Configuration`}>
					<Text>
						The {categoryName.toLowerCase()} settings will be implemented here. This is a placeholder for
						the {categoryId} category.
					</Text>
				</Card>
			</Section>
		</div>
	)
}

export default PlaceholderSettings
