import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Monitor } from "lucide-react"

import { cn } from "@/lib/utils"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"

type InterfaceSettingsProps = HTMLAttributes<HTMLDivElement> & {
	showGreeting?: boolean
    setCachedStateField: SetCachedStateField<"showGreeting">
}

export const InterfaceSettings = ({ showGreeting, setCachedStateField, ...props }: InterfaceSettingsProps) => {
	const { t } = useAppTranslation()

	return (
		<div className={cn("flex flex-col gap-2")} {...props}>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<Monitor className="w-4" />
					<div>{t("settings:sections.interface")}</div>
				</div>
			</SectionHeader>
            
            <Section>
                <VSCodeCheckbox checked={showGreeting} onChange={(e: any) => setCachedStateField("showGreeting", e.target.checked)}>
					<span className="font-medium">{t("settings:sections.interface:showGreeting")}</span>
				</VSCodeCheckbox>
			</Section>
		</div>
	)
}
