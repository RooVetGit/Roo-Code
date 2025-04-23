import { useState } from "react"
import GeneralSettings from "./settings/GeneralSettings"
import PermissionsSettings from "./settings/PermissionsSettings"
import AboutSettings from "./settings/AboutSettings"
import PlaceholderSettings from "./settings/PlaceholderSettings"
import SettingsSettings from "./settings/SettingsSettings"

// Import Hero icons
import {
	Cog6ToothIcon,
	ShieldCheckIcon,
	InformationCircleIcon,
	EnvelopeIcon,
	BoltIcon,
	TagIcon,
	GlobeAltIcon,
	FlagIcon,
	BellIcon,
	DocumentTextIcon,
	CommandLineIcon,
	AdjustmentsHorizontalIcon,
	BeakerIcon,
} from "@heroicons/react/24/outline"

type SettingsCategory = {
	id: string
	name: string
	description?: string
	icon?: React.ElementType
}

// Helper function to combine class names
function classNames(...classes: (string | boolean | undefined)[]) {
	return classes.filter(Boolean).join(" ")
}

const SETTINGS_CATEGORIES: SettingsCategory[] = [
	{ id: "email", name: "Email", description: "Email configuration settings", icon: EnvelopeIcon },
	{ id: "performance", name: "Performance", description: "Performance settings", icon: BoltIcon },
	{ id: "tags", name: "Tags", description: "Tag management settings", icon: TagIcon },
	{ id: "settings", name: "Settings", description: "General application settings", icon: Cog6ToothIcon },
	{
		id: "general",
		name: "General",
		description: "API configuration and general settings",
		icon: AdjustmentsHorizontalIcon,
	},
	{ id: "permissions", name: "Permissions", description: "Configure auto-approval settings", icon: ShieldCheckIcon },
	{ id: "browser", name: "Browser", description: "Browser tool settings", icon: GlobeAltIcon },
	{ id: "checkpoints", name: "Checkpoints", description: "Checkpoint settings", icon: FlagIcon },
	{ id: "notifications", name: "Notifications", description: "Sound and notification settings", icon: BellIcon },
	{ id: "context", name: "Context Management", description: "Configure context settings", icon: DocumentTextIcon },
	{ id: "terminal", name: "Terminal", description: "Terminal settings", icon: CommandLineIcon },
	{ id: "advanced", name: "Advanced", description: "Advanced settings", icon: AdjustmentsHorizontalIcon },
	{ id: "experimental", name: "Experimental", description: "Experimental features", icon: BeakerIcon },
	{ id: "about", name: "About", description: "Version and telemetry information", icon: InformationCircleIcon },
]

const SettingsView = () => {
	const [selectedCategory, setSelectedCategory] = useState<string>("settings")

	return (
		<div className="flex flex-col h-full w-full overflow-hidden">
			{/* Header with title and buttons */}
			<div className="bg-[#252526] p-4 border-b border-[#3c3c3c]">
				<div className="flex items-center justify-between">
					<h2 className="text-2xl font-bold text-white">Roo Code Settings Page</h2>
					<div className="flex space-x-3">
						<button
							type="button"
							className="inline-flex items-center rounded-md bg-[#3c3c3c] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#4c4c4c]">
							Close
						</button>
						<button
							type="button"
							className="inline-flex items-center rounded-md bg-[#0e639c] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#1177bb]">
							Save
						</button>
					</div>
				</div>
			</div>

			{/* Main content area with sidebar and settings */}
			<div className="flex flex-1 overflow-hidden">
				{/* Left sidebar - Categories */}
				<div className="flex flex-col w-[250px] min-w-[250px] h-full bg-[#1e1e1e] overflow-y-auto px-3 py-4">
					<nav className="flex flex-1 flex-col">
						<ul role="list" className="flex flex-1 flex-col space-y-1">
							{SETTINGS_CATEGORIES.map((category) => {
								const Icon = category.icon
								return (
									<li key={category.id}>
										<button
											className={classNames(
												"w-full flex items-center gap-x-3 rounded-md p-2 text-sm font-semibold",
												selectedCategory === category.id
													? "bg-[#333333] text-white"
													: "text-[#cccccc] hover:bg-[#2a2a2a] hover:text-white",
											)}
											onClick={() => setSelectedCategory(category.id)}>
											{Icon && <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />}
											<span>{category.name}</span>
										</button>
									</li>
								)
							})}
						</ul>
					</nav>
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
						{selectedCategory === "settings" && <SettingsSettings />}
						{selectedCategory !== "general" &&
							selectedCategory !== "permissions" &&
							selectedCategory !== "about" &&
							selectedCategory !== "settings" && (
								<PlaceholderSettings
									categoryId={selectedCategory}
									categoryName={
										SETTINGS_CATEGORIES.find((c) => c.id === selectedCategory)?.name || ""
									}
								/>
							)}
					</div>
				</div>
			</div>
		</div>
	)
}

export default SettingsView
