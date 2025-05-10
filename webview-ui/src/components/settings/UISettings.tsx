import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Database } from "lucide-react"

import { cn } from "@/lib/utils"
import { Slider } from "@/components/ui"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"

type UISettingsProps = HTMLAttributes<HTMLDivElement> & {
	markdownBlockLineheight: number
	setCachedStateField: SetCachedStateField<"markdownBlockLineheight">
}

export const UISettings = ({ markdownBlockLineheight, setCachedStateField, className, ...props }: UISettingsProps) => {
	const { t } = useAppTranslation()
	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader description={t("settings:uiSettings.description")}>
				<div className="flex items-center gap-2">
					<Database className="w-4" />
					<div>{t("settings:sections.uiSettings")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div>
					<span className="block font-medium mb-1">
						{t("settings:uiSettings.markdownBlockLineheight.label")}
					</span>
					<div className="flex items-center gap-2">
						<Slider
							min={1.25}
							max={2}
							step={0.01}
							value={[markdownBlockLineheight ?? 1.25]}
							onValueChange={([value]) => setCachedStateField("markdownBlockLineheight", value)}
							data-testid="open-tabs-limit-slider"
						/>
						<span className="w-10">{markdownBlockLineheight ?? 1.25}</span>
					</div>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:uiSettings.markdownBlockLineheight.description")}
					</div>
				</div>
			</Section>
		</div>
	)
}
