import React from "react"

import { type ProviderSettings, type ModelInfo } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Slider } from "@src/components/ui"

interface MaxOutputTokensControlProps {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: <K extends keyof ProviderSettings>(field: K, value: ProviderSettings[K]) => void
	modelInfo?: ModelInfo
}

const MIN_OUTPUT_TOKENS = 2048
const STEP_OUTPUT_TOKENS = 1024

export const MaxOutputTokensControl: React.FC<MaxOutputTokensControlProps> = ({
	apiConfiguration,
	setApiConfigurationField,
	modelInfo,
}) => {
	const { t } = useAppTranslation()
	const shouldRender = modelInfo && typeof modelInfo.maxTokens === "number" && modelInfo.maxTokens > 0

	if (!shouldRender) {
		return null
	}

	const currentMaxOutputTokens = apiConfiguration.modelMaxTokens ?? modelInfo.maxTokens!

	return (
		<div className="flex flex-col gap-1" data-testid="max-output-tokens-control">
			<div className="font-medium">{t("settings:thinkingBudget.maxTokens")}</div>
			<div className="flex items-center gap-1">
				<Slider
					min={MIN_OUTPUT_TOKENS}
					max={modelInfo.maxTokens!}
					step={STEP_OUTPUT_TOKENS}
					value={[currentMaxOutputTokens]}
					onValueChange={([value]) => setApiConfigurationField("modelMaxTokens", value)}
				/>
				<div className="w-12 text-sm text-center">{currentMaxOutputTokens}</div>
			</div>
		</div>
	)
}
