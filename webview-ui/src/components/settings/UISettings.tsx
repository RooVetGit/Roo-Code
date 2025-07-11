import { HTMLAttributes } from "react"
import React from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { Monitor } from "lucide-react"

import { cn } from "@/lib/utils"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"

type UISettingsProps = HTMLAttributes<HTMLDivElement> & {
	filesChangedEnabled?: boolean
	setCachedStateField: SetCachedStateField<"filesChangedEnabled">
}

export const UISettings = ({ filesChangedEnabled, setCachedStateField, className, ...props }: UISettingsProps) => {
	const { t } = useAppTranslation()

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader description={t("settings:ui.description")}>
				<div className="flex items-center gap-2">
					<Monitor className="w-4" />
					<div>{t("settings:sections.ui")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div>
					<VSCodeCheckbox
						checked={filesChangedEnabled}
						onChange={(e: any) => setCachedStateField("filesChangedEnabled", e.target.checked)}
						data-testid="files-changed-enabled-checkbox">
						<label className="block font-medium mb-1">{t("settings:ui.filesChanged.label")}</label>
					</VSCodeCheckbox>
					<div className="text-vscode-descriptionForeground text-sm mt-1 mb-3">
						{t("settings:ui.filesChanged.description")}
					</div>
				</div>
			</Section>
		</div>
	)
}
