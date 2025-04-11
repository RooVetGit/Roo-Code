import { useState } from "react"
import { makeStyles, shorthands, Button, Title2, Subtitle1, tokens, Divider } from "@fluentui/react-components"
import GeneralSettings from "./settings/GeneralSettings"
import PermissionsSettings from "./settings/PermissionsSettings"
import AboutSettings from "./settings/AboutSettings"
import PlaceholderSettings from "./settings/PlaceholderSettings"

type SettingsCategory = {
	id: string
	name: string
	description?: string
}

const SETTINGS_CATEGORIES: SettingsCategory[] = [
	{ id: "general", name: "General", description: "API configuration and general settings" },
	{ id: "permissions", name: "Permissions", description: "Configure auto-approval settings" },
	{ id: "browser", name: "Browser", description: "Browser tool settings" },
	{ id: "checkpoints", name: "Checkpoints", description: "Checkpoint settings" },
	{ id: "notifications", name: "Notifications", description: "Sound and notification settings" },
	{ id: "context", name: "Context Management", description: "Configure context settings" },
	{ id: "terminal", name: "Terminal", description: "Terminal settings" },
	{ id: "advanced", name: "Advanced", description: "Advanced settings" },
	{ id: "experimental", name: "Experimental", description: "Experimental features" },
	{ id: "about", name: "About", description: "Version and telemetry information" },
]

const useStyles = makeStyles({
	root: {
		display: "flex",
		height: "100%",
		width: "100%",
		overflow: "hidden",
	},
	sidebar: {
		display: "flex",
		flexDirection: "column",
		width: "250px",
		minWidth: "250px",
		height: "100%",
		borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
		overflowY: "auto",
		...shorthands.padding("16px", "0"),
	},
	content: {
		display: "flex",
		flexDirection: "column",
		flexGrow: 1,
		height: "100%",
		overflowY: "auto",
		...shorthands.padding("24px"),
	},
	categoryButton: {
		justifyContent: "flex-start",
		textAlign: "left",
		height: "auto",
		...shorthands.padding("12px", "16px"),
		...shorthands.borderRadius("0"),
	},
	categoryButtonSelected: {
		backgroundColor: tokens.colorNeutralBackground1Selected,
		"&:hover": {
			backgroundColor: tokens.colorNeutralBackground1Hover,
		},
	},
	categoryName: {
		fontWeight: tokens.fontWeightSemibold,
	},
	categoryDescription: {
		color: tokens.colorNeutralForeground2,
		fontSize: tokens.fontSizeBase200,
	},
	contentHeader: {
		marginBottom: "16px",
	},
	contentBody: {
		marginTop: "16px",
	},
})

const SettingsView = () => {
	const styles = useStyles()
	const [selectedCategory, setSelectedCategory] = useState<string>("general")

	return (
		<div className={styles.root}>
			{/* Left sidebar - Categories */}
			<div className={styles.sidebar}>
				{SETTINGS_CATEGORIES.map((category) => (
					<Button
						key={category.id}
						appearance="subtle"
						className={`${styles.categoryButton} ${selectedCategory === category.id ? styles.categoryButtonSelected : ""}`}
						onClick={() => setSelectedCategory(category.id)}>
						<div>
							<div className={styles.categoryName}>{category.name}</div>
							{category.description && (
								<div className={styles.categoryDescription}>{category.description}</div>
							)}
						</div>
					</Button>
				))}
			</div>

			{/* Right content area */}
			<div className={styles.content}>
				<div className={styles.contentHeader}>
					<Title2>{SETTINGS_CATEGORIES.find((c) => c.id === selectedCategory)?.name}</Title2>
					<Subtitle1>{SETTINGS_CATEGORIES.find((c) => c.id === selectedCategory)?.description}</Subtitle1>
				</div>

				<Divider />

				<div className={styles.contentBody}>
					{/* Render the appropriate settings component based on the selected category */}
					{selectedCategory === "general" && <GeneralSettings />}
					{selectedCategory === "permissions" && <PermissionsSettings />}
					{selectedCategory === "about" && <AboutSettings />}
					{selectedCategory !== "general" && selectedCategory !== "permissions" && selectedCategory !== "about" && (
						<PlaceholderSettings
							categoryId={selectedCategory}
							categoryName={SETTINGS_CATEGORIES.find((c) => c.id === selectedCategory)?.name || ""}
						/>
					)}
				</div>
			</div>
		</div>
	)
}

export default SettingsView
