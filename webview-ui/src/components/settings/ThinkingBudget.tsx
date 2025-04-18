import { useAppTranslation } from "@/i18n/TranslationContext"

import { Slider } from "@/components/ui"

import { ApiConfiguration, ModelInfo } from "../../../../src/shared/api"

const DEFAULT_MAX_OUTPUT_TOKENS = 16_384
const DEFAULT_MAX_THINKING_TOKENS = 8_192

interface ThinkingBudgetProps {
	apiConfiguration: ApiConfiguration
	setApiConfigurationField: <K extends keyof ApiConfiguration>(field: K, value: ApiConfiguration[K]) => void
	modelInfo?: ModelInfo
}

export const ThinkingBudget = ({ apiConfiguration, setApiConfigurationField, modelInfo }: ThinkingBudgetProps) => {
	const { t } = useAppTranslation()

	if (!modelInfo || !modelInfo.thinking || !modelInfo.maxTokens) {
		return null
	}

	const customMaxOutputTokens = apiConfiguration.modelMaxTokens || DEFAULT_MAX_OUTPUT_TOKENS

	// Dynamically expand or shrink the max thinking budget based on the custom
	// max output tokens so that there's always a 20% buffer.
	const modelMaxThinkingTokens = modelInfo.maxThinkingTokens
		? Math.min(modelInfo.maxThinkingTokens, Math.floor(0.8 * customMaxOutputTokens))
		: Math.floor(0.8 * customMaxOutputTokens)

	let customMaxThinkingTokens = apiConfiguration.modelMaxThinkingTokens || DEFAULT_MAX_THINKING_TOKENS

	if (customMaxThinkingTokens > modelMaxThinkingTokens) {
		customMaxThinkingTokens = modelMaxThinkingTokens
	}

	return (
		<>
			<div className="flex flex-col gap-1">
				<div className="font-medium">{t("settings:thinkingBudget.maxTokens")}</div>
				<div className="flex items-center gap-1">
					<Slider
						min={8192}
						max={modelInfo.maxTokens!}
						step={1024}
						value={[customMaxOutputTokens]}
						onValueChange={([value]) => setApiConfigurationField("modelMaxTokens", value)}
					/>
					<div className="w-12 text-sm text-center">{customMaxOutputTokens}</div>
				</div>
			</div>
			<div className="flex flex-col gap-1">
				<div className="font-medium">{t("settings:thinkingBudget.maxThinkingTokens")}</div>
				<div className="flex items-center gap-1">
					<Slider
						min={1024}
						max={modelMaxThinkingTokens}
						step={1024}
						value={[customMaxThinkingTokens]}
						onValueChange={([value]) => setApiConfigurationField("modelMaxThinkingTokens", value)}
					/>
					<div className="w-12 text-sm text-center">{customMaxThinkingTokens}</div>
				</div>
			</div>
		</>
	)
}
