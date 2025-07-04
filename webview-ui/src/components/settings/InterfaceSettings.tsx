import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { Monitor } from "lucide-react"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { vscode } from "@/utils/vscode"

type InterfaceSettingsProps = HTMLAttributes<HTMLDivElement> & {
	filesChangedEnabled?: boolean
	setCachedStateField: SetCachedStateField<"filesChangedEnabled">
}

export const InterfaceSettings = ({ filesChangedEnabled, setCachedStateField, ...props }: InterfaceSettingsProps) => {
	const { t } = useAppTranslation()

	return (
		<div {...props}>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<Monitor className="w-4" />
					<div>{t("settings:sections.interface")}</div>
				</div>
			</SectionHeader>

			<Section>
				{/* Files Changed Settings Section */}
				<div>
					<div className="flex items-center gap-2 font-bold mb-3">
						<span className="codicon codicon-file-diff" />
						<div>{t("settings:interface.filesChanged.title")}</div>
					</div>

					<div>
						<VSCodeCheckbox
							checked={filesChangedEnabled ?? true}
							onChange={(e: any) => {
								setCachedStateField("filesChangedEnabled", e.target.checked)
								vscode.postMessage({
									type: "filesChangedEnabled",
									bool: e.target.checked,
								})
							}}
							data-testid="files-changed-enabled-checkbox">
							{t("settings:interface.filesChanged.enabled.label")}
						</VSCodeCheckbox>
						<div className="text-vscode-descriptionForeground text-sm mt-1 mb-3">
							{t("settings:interface.filesChanged.enabled.description")}
						</div>
					</div>
				</div>
			</Section>
		</div>
	)
}
