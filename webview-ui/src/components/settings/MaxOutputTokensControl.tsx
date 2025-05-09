import React from "react"
import { ApiConfiguration, ModelInfo } from "@roo/shared/api"
import { Slider } from "../ui/slider"
import { useTranslation } from "react-i18next"

interface MaxOutputTokensControlProps {
	apiConfiguration: ApiConfiguration
	setApiConfigurationField: <K extends keyof ApiConfiguration>(field: K, value: ApiConfiguration[K]) => void
	modelInfo?: ModelInfo
}

const MIN_OUTPUT_TOKENS = 8192
const STEP_OUTPUT_TOKENS = 1024

export const MaxOutputTokensControl: React.FC<MaxOutputTokensControlProps> = ({
	apiConfiguration,
	setApiConfigurationField,
	modelInfo,
}) => {
	const { t } = useTranslation()
	const shouldRender = modelInfo && typeof modelInfo.maxTokens === "number" && modelInfo.maxTokens > 0

	if (!shouldRender) {
		return null
	}

	const currentMaxOutputTokens = apiConfiguration.modelMaxTokens ?? modelInfo.maxTokens!

	// Basic structure for now, will be expanded in later tasks.
	return (
		<div data-testid="max-output-tokens-control">
			<label className="block mb-2">{t("providers.customModel.maxTokens.label")}</label>
			<div className="flex items-center space-x-2">
				<Slider
					className="flex-grow"
					min={MIN_OUTPUT_TOKENS}
					max={modelInfo.maxTokens!}
					step={STEP_OUTPUT_TOKENS}
					value={[currentMaxOutputTokens]}
					onValueChange={([value]) => setApiConfigurationField("modelMaxTokens", value)}
				/>
				<div className="w-12 text-sm text-right">{currentMaxOutputTokens}</div>
			</div>
		</div>
	)
}
