import React from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { ModelInfo } from "@roo-code/types"
import { Slider } from "@/components/ui"
import { DEFAULT_HYBRID_REASONING_MODEL_MAX_TOKENS } from "@roo/api"

interface MaxTokensSliderProps {
	value?: number
	onChange: (value: number | undefined) => void
	modelInfo?: ModelInfo
	className?: string
}

export const MaxTokensSlider: React.FC<MaxTokensSliderProps> = ({ value, onChange, modelInfo, className }) => {
	const { t } = useAppTranslation()

	// Use the same logic as the original ThinkingBudget component
	const customMaxOutputTokens = value || DEFAULT_HYBRID_REASONING_MODEL_MAX_TOKENS
	const maxValue = modelInfo?.maxTokens
		? Math.max(modelInfo.maxTokens, customMaxOutputTokens, DEFAULT_HYBRID_REASONING_MODEL_MAX_TOKENS)
		: Math.max(customMaxOutputTokens, DEFAULT_HYBRID_REASONING_MODEL_MAX_TOKENS)

	return (
		<div className={`flex flex-col gap-1 ${className || ""}`}>
			<div className="font-medium">{t("settings:providers.maxOutputTokens.label")}</div>
			<div className="flex items-center gap-1">
				<Slider
					min={8192}
					max={maxValue}
					step={1024}
					value={[customMaxOutputTokens]}
					onValueChange={([value]) => onChange(value)}
				/>
				<div className="w-12 text-sm text-center">{customMaxOutputTokens}</div>
			</div>
			<div className="text-sm text-vscode-descriptionForeground">
				{t("settings:providers.maxOutputTokens.description")}
			</div>
			{modelInfo && (
				<div className="text-sm text-vscode-descriptionForeground">
					{t("settings:providers.maxOutputTokens.modelSupports", { max: modelInfo.maxTokens })}
				</div>
			)}
		</div>
	)
}
