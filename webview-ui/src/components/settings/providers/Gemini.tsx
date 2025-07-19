import { useCallback, useState, useMemo } from "react"
import { Checkbox } from "vscrui"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@src/components/ui/collapsible"
import { Slider } from "@src/components/ui"
import { ChevronRight } from "lucide-react"

import type { ProviderSettings } from "@roo-code/types"
import { geminiModels, geminiDefaultModelId, type GeminiModelId } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"

import { inputEventTransform } from "../transforms"

type GeminiProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	currentModelId?: string
}

export const Gemini = ({ apiConfiguration, setApiConfigurationField, currentModelId }: GeminiProps) => {
	const { t } = useAppTranslation()

	const [googleGeminiBaseUrlSelected, setGoogleGeminiBaseUrlSelected] = useState(
		!!apiConfiguration?.googleGeminiBaseUrl,
	)
	const [isModelParametersOpen, setIsModelParametersOpen] = useState(false)

	const modelInfo = useMemo(() => {
		const modelId = (
			currentModelId && currentModelId in geminiModels ? currentModelId : geminiDefaultModelId
		) as GeminiModelId
		return geminiModels[modelId]
	}, [currentModelId])

	const handleInputChange = useCallback(
		<K extends keyof ProviderSettings, E>(
			field: K,
			transform: (event: E) => ProviderSettings[K] = inputEventTransform,
		) =>
			(event: E | Event) => {
				setApiConfigurationField(field, transform(event as E))
			},
		[setApiConfigurationField],
	)

	return (
		<>
			<VSCodeTextField
				value={apiConfiguration?.geminiApiKey || ""}
				type="password"
				onInput={handleInputChange("geminiApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.geminiApiKey")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			{!apiConfiguration?.geminiApiKey && (
				<VSCodeButtonLink href="https://ai.google.dev/" appearance="secondary">
					{t("settings:providers.getGeminiApiKey")}
				</VSCodeButtonLink>
			)}

			<div>
				<Checkbox
					data-testid="checkbox-custom-base-url"
					checked={googleGeminiBaseUrlSelected}
					onChange={(checked: boolean) => {
						setGoogleGeminiBaseUrlSelected(checked)
						if (!checked) {
							setApiConfigurationField("googleGeminiBaseUrl", "")
						}
					}}>
					{t("settings:providers.useCustomBaseUrl")}
				</Checkbox>
				{googleGeminiBaseUrlSelected && (
					<VSCodeTextField
						value={apiConfiguration?.googleGeminiBaseUrl || ""}
						type="url"
						onInput={handleInputChange("googleGeminiBaseUrl")}
						placeholder={t("settings:defaults.geminiUrl")}
						className="w-full mt-1"
					/>
				)}

				<Checkbox
					className="mt-6"
					data-testid="checkbox-url-context"
					checked={!!apiConfiguration.enableUrlContext}
					onChange={(checked: boolean) => setApiConfigurationField("enableUrlContext", checked)}>
					{t("settings:providers.geminiParameters.urlContext.title")}
				</Checkbox>
				<div className="text-sm text-vscode-descriptionForeground mb-3">
					{t("settings:providers.geminiParameters.urlContext.description")}
				</div>

				<Checkbox
					data-testid="checkbox-grounding-search"
					checked={!!apiConfiguration.enableGrounding}
					onChange={(checked: boolean) => setApiConfigurationField("enableGrounding", checked)}>
					{t("settings:providers.geminiParameters.groundingSearch.title")}
				</Checkbox>
				<div className="text-sm text-vscode-descriptionForeground mb-3">
					{t("settings:providers.geminiParameters.groundingSearch.description")}
				</div>

				<div className="mb-2">
					<Collapsible onOpenChange={setIsModelParametersOpen}>
						<CollapsibleTrigger className="w-full text-left">
							<div className="flex items-center justify-between">
								<div className="flex flex-col">
									<h3 className="font-semibold text-base">
										{t("settings:providers.geminiSections.modelParameters.title")}
									</h3>
									<p className="text-sm text-vscode-descriptionForeground -mt-3">
										{t("settings:providers.geminiSections.modelParameters.description")}
									</p>
								</div>
								<ChevronRight
									className={`transform transition-transform duration-200 mr-2 ${
										isModelParametersOpen ? "rotate-90" : ""
									}`}
									size={20}
								/>
							</div>
						</CollapsibleTrigger>
						<CollapsibleContent>
							<div className="mt-4">
								<label className="block font-medium mb-1">
									{t("settings:providers.geminiParameters.topP.title")}
								</label>
								<div className="flex items-center space-x-2">
									<Slider
										data-testid="slider-top-p"
										min={0}
										max={1}
										step={0.01}
										value={[apiConfiguration.topP ?? 0.95]}
										onValueChange={(values: number[]) =>
											setApiConfigurationField("topP", values[0])
										}
										className="flex-grow"
									/>
									<span className="w-10 text-right">
										{(apiConfiguration.topP ?? 0.95).toFixed(2)}
									</span>
								</div>
								<div className="text-sm text-vscode-descriptionForeground">
									{t("settings:providers.geminiParameters.topP.description")}
								</div>
							</div>

							<div className="mt-4">
								<label className="block font-medium mb-1">
									{t("settings:providers.geminiParameters.topK.title")}
								</label>
								<div className="flex items-center space-x-2">
									<Slider
										data-testid="slider-top-k"
										min={0}
										max={100}
										step={1}
										value={[apiConfiguration.topK ?? 64]}
										onValueChange={(values: number[]) =>
											setApiConfigurationField("topK", values[0])
										}
										className="flex-grow"
									/>
									<span className="w-10 text-right">{apiConfiguration.topK ?? 64}</span>
								</div>
								<div className="text-sm text-vscode-descriptionForeground">
									{t("settings:providers.geminiParameters.topK.description")}
								</div>
							</div>

							<div className="mt-4">
								<label className="block font-medium mb-1">
									{t("settings:providers.geminiParameters.maxOutputTokens.title")}
								</label>
								<div className="flex items-center space-x-2">
									<Slider
										data-testid="slider-max-output-tokens"
										min={3000}
										max={modelInfo.maxTokens}
										step={1}
										value={[apiConfiguration.maxOutputTokens ?? modelInfo.maxTokens]}
										onValueChange={(values: number[]) =>
											setApiConfigurationField("maxOutputTokens", values[0])
										}
										className="flex-grow"
									/>
									<VSCodeTextField
										value={(apiConfiguration.maxOutputTokens ?? modelInfo.maxTokens).toString()}
										type="text"
										inputMode="numeric"
										onInput={handleInputChange("maxOutputTokens", (e) => {
											const val = parseInt((e as any).target.value, 10)
											return Number.isNaN(val) ? 0 : Math.min(val, modelInfo.maxTokens)
										})}
										className="w-16"
									/>
								</div>
								<div className="text-sm text-vscode-descriptionForeground">
									{t("settings:providers.geminiParameters.maxOutputTokens.description")}_{" "}
								</div>
							</div>
						</CollapsibleContent>
					</Collapsible>
				</div>
			</div>
		</>
	)
}
