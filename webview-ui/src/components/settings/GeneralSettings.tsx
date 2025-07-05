import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@src/i18n/TranslationContext"

import { ExtensionStateContextType } from "@/context/ExtensionStateContext"
import { SetCachedStateField } from "./types"
import { Section } from "./Section"

type GeneralProps = {
	showAllWorkspacesTasks: boolean
	setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType>
}

export const GeneralSettings = ({ showAllWorkspacesTasks, setCachedStateField }: GeneralProps) => {
	const { t } = useAppTranslation()

	return (
		<Section>
			<div>
				<VSCodeCheckbox
					checked={showAllWorkspacesTasks}
					onChange={(e) => {
						const checked = (e.target as HTMLInputElement).checked
						setCachedStateField("showAllWorkspacesTasks", checked)
					}}>
					<span className="font-medium">{t("settings:general.showAllWorkspacesTasks.label")}</span>
				</VSCodeCheckbox>
				<div className="text-vscode-descriptionForeground text-sm mt-1">
					{t("settings:general.showAllWorkspacesTasks.description")}
				</div>
			</div>
		</Section>
	)
}
