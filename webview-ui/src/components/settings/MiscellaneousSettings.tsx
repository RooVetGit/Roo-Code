import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { Settings } from "lucide-react"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"

type MiscellaneousSettingsProps = HTMLAttributes<HTMLDivElement> & {
	stickyModesEnabled?: boolean
	setCachedStateField: SetCachedStateField<"stickyModesEnabled">
}

export const MiscellaneousSettings = ({
	stickyModesEnabled,
	setCachedStateField,
	className,
	...props
}: MiscellaneousSettingsProps) => {
	const { t } = useAppTranslation()

	return (
		<div {...props}>
			<SectionHeader description={t("settings:miscellaneous.description")}>
				<div className="flex items-center gap-2">
					<Settings className="w-4" />
					<div>{t("settings:sections.miscellaneous")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div>
					<VSCodeCheckbox
						checked={stickyModesEnabled}
						onChange={(e: any) => setCachedStateField("stickyModesEnabled", e.target.checked)}
						data-testid="sticky-modes-enabled-checkbox">
						<span className="font-medium">{t("settings:miscellaneous.stickyModes.label")}</span>
					</VSCodeCheckbox>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:miscellaneous.stickyModes.description")}
					</div>
				</div>
			</Section>
		</div>
	)
}
