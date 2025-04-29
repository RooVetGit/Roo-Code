import { memo } from "react"
import { Palette } from "lucide-react"

import { useAppTranslation } from "@/i18n/TranslationContext"
// Removed incorrect imports for Label, RadioGroup, RadioGroupItem
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui" // Import from index
import { Section } from "./Section"
import { SectionHeader } from "./SectionHeader"
import { SetCachedStateField } from "./types"
import { ExtensionStateContextType } from "@/context/ExtensionStateContext"

// Define the types for the props, including the settings values and the setter function
interface AppearanceSettingsProps {
	colorTheme: string // e.g., 'sync', 'roo-light', 'roo-dark'
	densityMode: string // e.g., 'comfortable', 'compact'
	setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType>
}

// Define the available themes and densities
const colorThemes = [
	{ value: "sync", labelKey: "settings:appearance.theme.sync" },
	{ value: "roo-light", labelKey: "settings:appearance.theme.rooLight" },
	{ value: "roo-dark", labelKey: "settings:appearance.theme.rooDark" },
]

const densityModes = [
	{ value: "comfortable", labelKey: "settings:appearance.density.comfortable" },
	{ value: "compact", labelKey: "settings:appearance.density.compact" },
]

const AppearanceSettingsComponent = ({ colorTheme, densityMode, setCachedStateField }: AppearanceSettingsProps) => {
	const { t } = useAppTranslation()

	const handleThemeChange = (value: string) => {
		setCachedStateField("colorTheme", value)
	}

	const handleDensityChange = (value: string) => {
		setCachedStateField("densityMode", value)
	}

	return (
		<>
			<SectionHeader>
				{/* Use spacing variable for gap */}
				<div className="flex items-center gap-[var(--spacing-unit-sm)]">
					<Palette className="w-4" />
					<div>{t("settings:sections.appearance")}</div>
				</div>
			</SectionHeader>

			<Section>
				{/* Use spacing variable for gap */}
				<div className="grid gap-[var(--spacing-unit)]">
					{/* Color Theme Setting */}
					{/* Use spacing variable for gap */}
					<div className="grid grid-cols-3 items-center gap-[var(--spacing-unit)]">
						{/* Use standard HTML label */}
						<label htmlFor="color-theme-select" className="col-span-1">
							{t("settings:appearance.theme.label")}
						</label>
						<Select value={colorTheme} onValueChange={handleThemeChange}>
							<SelectTrigger id="color-theme-select" className="col-span-2">
								<SelectValue placeholder={t("settings:appearance.theme.placeholder")} />
							</SelectTrigger>
							<SelectContent>
								{colorThemes.map((theme) => (
									<SelectItem key={theme.value} value={theme.value}>
										{t(theme.labelKey)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Density Setting */}
					{/* Use spacing variable for gap */}
					<div className="grid grid-cols-3 items-center gap-[var(--spacing-unit)]">
						{/* Use standard HTML label */}
						<label className="col-span-1">{t("settings:appearance.density.label")}</label>
						{/* Use standard HTML radio buttons */}
						<div className="col-span-2 flex gap-[var(--spacing-unit)]">
							{densityModes.map((mode) => (
								<label
									key={mode.value}
									htmlFor={`density-${mode.value}`}
									className="flex items-center space-x-[var(--spacing-unit-sm)] cursor-pointer">
									<input
										type="radio"
										id={`density-${mode.value}`}
										name="densityMode" // Group radio buttons
										value={mode.value}
										checked={densityMode === mode.value}
										onChange={(e) => handleDensityChange(e.target.value)}
										className="cursor-pointer" // Add basic styling if needed
									/>
									<span className="font-normal">{t(mode.labelKey)}</span>
								</label>
							))}
						</div>
					</div>
				</div>
			</Section>
		</>
	)
}

export const AppearanceSettings = memo(AppearanceSettingsComponent)
