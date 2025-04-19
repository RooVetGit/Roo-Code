import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Monitor, ExternalLink } from "lucide-react"

import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { vscode } from "@/utils/vscode"

import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"

type InterfaceSettingsProps = HTMLAttributes<HTMLDivElement> & {
	onChangeDetected: () => void
}

export const InterfaceSettings = ({ onChangeDetected, ...props }: InterfaceSettingsProps) => {
	const { t } = useAppTranslation()
	const handleEditCustomCSS = () => {
		vscode.postMessage({ type: "openCustomCssFile" })
		onChangeDetected()
	}

	return (
		<div {...props}>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<Monitor className="w-4" />
					<div>{t("settings:sections.interface")}</div>
				</div>
			</SectionHeader>

			<Section>
				<fieldset className="border rounded-md border-black-200 p-2">
					<legend className="flex items-center gap-1 px-1">
						<span className="text-vscode-errorForeground">{t("settings:experimental.warning")}</span>
						{t("settings:interface.poweruser.warning")}
					</legend>
					<VSCodeButton appearance="secondary" onClick={handleEditCustomCSS}>
						{t("settings:interface.cssOverlay.label")}
						<span slot="start" className="flex items-center">
							<ExternalLink className="w-4 h-4 mr-1" />
						</span>
					</VSCodeButton>
					{t("settings:interface.cssOverlay.description")}
				</fieldset>
			</Section>
		</div>
	)
}
