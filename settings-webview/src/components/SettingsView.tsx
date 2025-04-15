import { useState } from "react"
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

const SettingsView = () => {
	const [selectedCategory, setSelectedCategory] = useState<string>("general")

	return (
		<div className="flex h-full w-full overflow-hidden">
			{/* Left sidebar - Categories */}
			<div className="flex flex-col w-[250px] min-w-[250px] h-full border-r border-vscode-panel-border overflow-y-auto py-4">
				{SETTINGS_CATEGORIES.map((category) => (
					<button
						key={category.id}
						className={`flex flex-col items-start text-left h-auto py-3 px-4 w-full hover:bg-vscode-button-hover-bg ${
							selectedCategory === category.id ? "bg-vscode-button-bg text-vscode-button-fg" : ""
						}`}
						onClick={() => setSelectedCategory(category.id)}>
						<div className="font-semibold">{category.name}</div>
						{category.description && (
							<div className="text-vscode-description-fg text-xs">{category.description}</div>
						)}
					</button>
				))}
			</div>

			{/* Right content area */}
			<div className="flex flex-col flex-grow h-full overflow-y-auto p-6">
				<div className="mb-4">
					<h1 className="text-2xl font-semibold mb-1">
						{SETTINGS_CATEGORIES.find((c) => c.id === selectedCategory)?.name}
					</h1>
					<h2 className="text-base text-vscode-description-fg">
						{SETTINGS_CATEGORIES.find((c) => c.id === selectedCategory)?.description}
					</h2>
				</div>

				<div className="h-px w-full bg-vscode-panel-border my-4"></div>

				<div className="mt-4">
					{/* Render the appropriate settings component based on the selected category */}
					{selectedCategory === "general" && <GeneralSettings />}
					{selectedCategory === "permissions" && <PermissionsSettings />}
					{selectedCategory === "about" && <AboutSettings />}
					{selectedCategory !== "general" &&
						selectedCategory !== "permissions" &&
						selectedCategory !== "about" && (
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
