import { HTMLAttributes } from "react"
import type { Language } from "@roo-code/types"
import { LANGUAGES } from "@roo/language"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@src/components/ui"
import { cn } from "@src/lib/utils"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { SetCachedStateField } from "./types"

type CommitLanguageSettingsProps = HTMLAttributes<HTMLDivElement> & {
	commitLanguage: string
	setCachedStateField: SetCachedStateField<"commitLanguage">
	aiCommitMessagesEnabled?: boolean // Dodano prop
}

export const CommitLanguageSettings = ({
	commitLanguage,
	setCachedStateField,
	aiCommitMessagesEnabled, // Dodano do destrukturyzacji
	className,
	...props
}: CommitLanguageSettingsProps) => {
	const { t } = useAppTranslation()

	return (
		<>
			{aiCommitMessagesEnabled && ( // Warunkowe renderowanie z wcięciem i paskiem
				<div
					className={cn("flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background", className)}
					{...props}>
					<div className="text-sm text-vscode-descriptionForeground">
						{t("settings:sections.commitLanguage")}
					</div>
					<Select
						value={commitLanguage}
						onValueChange={(value) => setCachedStateField("commitLanguage", value as Language)}>
						<SelectTrigger className="w-full">
							<SelectValue placeholder={t("settings:common.select")} />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								{Object.entries(LANGUAGES).map(([code, name]) => (
									<SelectItem key={code} value={code}>
										{name}
										<span className="text-muted-foreground">({code})</span>
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</div>
			)}
		</>
	)
}
