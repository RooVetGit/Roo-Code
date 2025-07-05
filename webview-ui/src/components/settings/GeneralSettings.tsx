import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@src/i18n/TranslationContext"

import { ExtensionStateContextType } from "@/context/ExtensionStateContext"
import { SetCachedStateField } from "./types"

type GeneralProps = {
	showAllWorkspacesTasks: boolean
	setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType>
}

export const GeneralSettings = ({ showAllWorkspacesTasks, setCachedStateField }: GeneralProps) => {
	const { t } = useAppTranslation()

	return (
		<div className="flex flex-col gap-y-2">
			<div className="flex items-center justify-between p-2">
				<div className="flex flex-col">
					<span className="text-vscode-settings-headerForeground text-lg">
						{t("settings:general.showAllWorkspacesTasks.label")}
					</span>
					<span className="text-vscode-descriptionForeground text-sm">
						{t("settings:general.showAllWorkspacesTasks.description")}
					</span>
				</div>
				<VSCodeCheckbox
					checked={showAllWorkspacesTasks}
					onChange={(e) => {
						const checked = (e.target as HTMLInputElement).checked
						setCachedStateField("showAllWorkspacesTasks", checked)
					}}
				/>
			</div>
		</div>
	)
}
