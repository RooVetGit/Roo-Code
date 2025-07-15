import React, { useCallback } from "react"
import { Slider } from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { DEFAULT_CONSECUTIVE_MISTAKE_LIMIT } from "@roo-code/types"

interface ConsecutiveMistakeLimitControlProps {
	value: number
	onChange: (value: number) => void
}

export const ConsecutiveMistakeLimitControl: React.FC<ConsecutiveMistakeLimitControlProps> = ({ value, onChange }) => {
	const { t } = useAppTranslation()

	const handleValueChange = useCallback(
		(newValue: number) => {
			onChange(newValue)
		},
		[onChange],
	)

	return (
		<div className="flex flex-col gap-1">
			<label className="block font-medium mb-1">{t("settings:providers.consecutiveMistakeLimit.label")}</label>
			<div className="flex items-center gap-2">
				<Slider
					value={[value ?? DEFAULT_CONSECUTIVE_MISTAKE_LIMIT]}
					min={0}
					max={10}
					step={1}
					onValueChange={(newValue) => handleValueChange(newValue[0])}
				/>
				<span className="w-10">{value ?? DEFAULT_CONSECUTIVE_MISTAKE_LIMIT}</span>
			</div>
			<div className="text-sm text-vscode-descriptionForeground">
				{value === 0
					? t("settings:providers.consecutiveMistakeLimit.unlimitedDescription")
					: t("settings:providers.consecutiveMistakeLimit.description", {
							value: value ?? DEFAULT_CONSECUTIVE_MISTAKE_LIMIT,
						})}
			</div>
			{value === 0 && (
				<div className="text-sm text-vscode-errorForeground mt-1">
					{t("settings:providers.consecutiveMistakeLimit.warning")}
				</div>
			)}
		</div>
	)
}
