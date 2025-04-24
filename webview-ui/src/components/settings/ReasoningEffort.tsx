import { useAppTranslation } from "@/i18n/TranslationContext"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui"

import { ApiConfiguration } from "@roo/shared/api"
import { reasoningEfforts, ReasoningEffort as ReasoningEffortType } from "@roo/schemas"

interface ReasoningEffortProps {
	apiConfiguration: ApiConfiguration
	setApiConfigurationField: <K extends keyof ApiConfiguration>(field: K, value: ApiConfiguration[K]) => void
	value?: ReasoningEffortType | undefined
}

export const ReasoningEffort = ({ apiConfiguration, setApiConfigurationField, value }: ReasoningEffortProps) => {
	const { t } = useAppTranslation()
	return (
		<div className="flex flex-col gap-1 mt-1">
			<div className="flex justify-between items-center">
				<label className="block font-medium mb-1">{t("settings:providers.reasoningEffort.label")}</label>
			</div>
			<Select
				value={value ?? apiConfiguration.reasoningEffort}
				onValueChange={(newValue) => {
					setApiConfigurationField("reasoningEffort", newValue as ReasoningEffortType)
				}}>
				<SelectTrigger className="w-full">
					<SelectValue placeholder={t("settings:common.select")} />
				</SelectTrigger>
				<SelectContent>
					{reasoningEfforts.map((value) => (
						<SelectItem key={value} value={value}>
							{t(`settings:providers.reasoningEffort.${value}`)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	)
}
