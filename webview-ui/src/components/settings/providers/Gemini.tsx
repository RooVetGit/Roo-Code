import { useCallback, useState, useMemo } from "react"
import { Checkbox } from "vscrui"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { Slider } from "@src/components/ui"

import type { ProviderSettings } from "@roo-code/types"
import { geminiModels, geminiDefaultModelId, type GeminiModelId } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"
import { vscode } from "@src/utils/vscode"

import { inputEventTransform } from "../transforms"

type GeminiProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	currentModelId?: string
	currentProfileId?: string
	profileThresholds?: Record<string, number>
	autoCondenseContextPercent?: number
	setProfileThreshold?: (profileId: string, threshold: number) => void
}

export const Gemini = ({
	apiConfiguration,
	setApiConfigurationField,
	currentModelId,
	currentProfileId,
	profileThresholds = {},
	autoCondenseContextPercent = 75,
	setProfileThreshold,
}: GeminiProps) => {
	const { t } = useAppTranslation()

	const [googleGeminiBaseUrlSelected, setGoogleGeminiBaseUrlSelected] = useState(
		!!apiConfiguration?.googleGeminiBaseUrl,
	)

	const [isCustomContextLimit, setIsCustomContextLimit] = useState(
		apiConfiguration?.contextLimit !== undefined && apiConfiguration?.contextLimit !== null,
	)

	const modelInfo = useMemo(() => {
		const modelId = (
			currentModelId && currentModelId in geminiModels ? currentModelId : geminiDefaultModelId
		) as GeminiModelId
		return geminiModels[modelId]
	}, [currentModelId])

	const getCurrentThreshold = useCallback(() => {
		if (!currentProfileId) return autoCondenseContextPercent

		const profileThreshold = profileThresholds[currentProfileId]
		if (profileThreshold === undefined || profileThreshold === -1) {
			return autoCondenseContextPercent
		}
		return profileThreshold
	}, [currentProfileId, profileThresholds, autoCondenseContextPercent])

	const handleThresholdChange = useCallback(
		(newThreshold: number) => {
			if (!currentProfileId || !setProfileThreshold) return

			setProfileThreshold(currentProfileId, newThreshold)

			vscode.postMessage({
				type: "profileThresholds",
				values: {
					...profileThresholds,
					[currentProfileId]: newThreshold,
				},
			})
		},
		[currentProfileId, profileThresholds, setProfileThreshold],
	)

	const getTriggerDetails = useCallback(() => {
		const contextWindow = apiConfiguration?.contextLimit || modelInfo?.contextWindow || 1048576
		const threshold = getCurrentThreshold()

		const TOKEN_BUFFER_PERCENTAGE = 0.1
		const maxTokens = modelInfo?.maxTokens
		const reservedTokens = maxTokens || contextWindow * 0.2
		const allowedTokens = Math.floor(contextWindow * (1 - TOKEN_BUFFER_PERCENTAGE) - reservedTokens)

		const percentageBasedTrigger = Math.floor(contextWindow * (threshold / 100))

		return {
			percentageBasedTrigger,
			allowedTokens,
			actualTrigger: Math.min(percentageBasedTrigger, allowedTokens),
			triggerReason: allowedTokens < percentageBasedTrigger ? "token-limit" : "percentage-threshold",
			maxTokens,
			reservedTokens,
		}
	}, [apiConfiguration?.contextLimit, modelInfo, getCurrentThreshold])

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
			</div>

			<div className="mt-6 border-t border-vscode-widget-border pt-4">
				<h3 className="font-semibold text-lg mb-4">{t("settings:providers.geminiSections.modelParameters")}</h3>

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
							value={[apiConfiguration.topP ?? 0]}
							onValueChange={(values: number[]) => setApiConfigurationField("topP", values[0])}
							className="flex-grow"
						/>
						<span className="w-10 text-right">{(apiConfiguration.topP ?? 0).toFixed(2)}</span>
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
							value={[apiConfiguration.topK ?? 0]}
							onValueChange={(values: number[]) => setApiConfigurationField("topK", values[0])}
							className="flex-grow"
						/>
						<span className="w-10 text-right">{apiConfiguration.topK ?? 0}</span>
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
							value={[apiConfiguration.maxOutputTokens ?? 0]}
							onValueChange={(values: number[]) => setApiConfigurationField("maxOutputTokens", values[0])}
							className="flex-grow"
						/>
						<VSCodeTextField
							value={(apiConfiguration.maxOutputTokens ?? 0).toString()}
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
						{t("settings:providers.geminiParameters.maxOutputTokens.description")}
					</div>
				</div>
			</div>

			<div className="mt-6 border-t border-vscode-widget-border pt-4">
				<h3 className="font-semibold text-lg mb-4">
					{t("settings:providers.geminiSections.geminiTokentManagement")}
				</h3>
				<div>
					<Checkbox
						data-testid="checkbox-custom-context-limit"
						checked={isCustomContextLimit}
						onChange={(checked: boolean) => {
							setIsCustomContextLimit(checked)
							if (!checked) {
								setApiConfigurationField("contextLimit", null)
							} else {
								setApiConfigurationField(
									"contextLimit",
									apiConfiguration.contextLimit ?? modelInfo?.contextWindow ?? 1048576,
								)
							}
						}}>
						<label className="block font-medium mb-1">
							{t("settings:providers.geminiContextManagement.useCustomContextWindow")}
						</label>
					</Checkbox>
					<div className="text-sm text-vscode-descriptionForeground mt-1 mb-3">
						{t("settings:providers.geminiContextManagement.description")}
					</div>

					<div className="text-sm text-vscode-descriptionForeground mb-3">
						<strong>{t("settings:providers.geminiContextManagement.modelDefault")}:</strong>{" "}
						{(modelInfo?.contextWindow || 1048576).toLocaleString()}{" "}
						{t("settings:providers.geminiContextManagement.condensingThreshold.tokens")}
					</div>

					{isCustomContextLimit && (
						<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
							<div>
								<div className="flex items-center gap-2">
									<Slider
										data-testid="slider-context-limit"
										min={32000}
										max={modelInfo?.contextWindow || 1048576}
										step={1000}
										value={[apiConfiguration.contextLimit ?? modelInfo?.contextWindow ?? 1048576]}
										onValueChange={([value]) => setApiConfigurationField("contextLimit", value)}
									/>
									<VSCodeTextField
										value={(() => {
											const val =
												apiConfiguration.contextLimit ?? modelInfo?.contextWindow ?? 1048576
											return Number.isNaN(val) ? "" : val.toString()
										})()}
										type="text"
										inputMode="numeric"
										onInput={handleInputChange("contextLimit", (e) => {
											const val = parseInt((e as any).target.value, 10)
											return Number.isNaN(val) ? undefined : val
										})}
										className="w-24"
									/>
								</div>
							</div>
						</div>
					)}
				</div>

				{currentProfileId && (
					<div className="mt-6">
						<label className="block font-medium mb-1">
							{t("settings:providers.geminiContextManagement.condensingThreshold.title")}
						</label>
						<div className="text-sm text-vscode-descriptionForeground mb-3">
							{t("settings:providers.geminiContextManagement.condensingThreshold.description")}
						</div>

						<div className="flex items-center gap-2 mb-2">
							<Slider
								min={5}
								max={100}
								step={1}
								value={[getCurrentThreshold()]}
								onValueChange={([value]) => handleThresholdChange(value)}
								className="flex-grow"
							/>
							<VSCodeTextField
								value={getCurrentThreshold().toString()}
								type="text"
								inputMode="numeric"
								onChange={(e) => {
									const value = parseInt((e.target as HTMLInputElement).value, 10)
									if (!isNaN(value) && value >= 5 && value <= 100) {
										handleThresholdChange(value)
									}
								}}
								className="w-16"
							/>
							<span className="text-sm">%</span>
						</div>

						<div className="text-sm text-vscode-descriptionForeground space-y-1">
							{(() => {
								const details = getTriggerDetails()
								return (
									<>
										<div>
											<strong>
												{t(
													"settings:providers.geminiContextManagement.condensingThreshold.condensingtriggerAt",
												)}
												:
											</strong>{" "}
											{details.actualTrigger.toLocaleString()}{" "}
											{t("settings:providers.geminiContextManagement.condensingThreshold.tokens")}
											{details.triggerReason === "token-limit" && (
												<span className="text-yellow-600 ml-2">
													(
													{t(
														"settings:providers.geminiContextManagement.condensingThreshold.tokenLimitTriggered",
													)}
													)
												</span>
											)}
										</div>
										<div>
											<strong>
												{t(
													"settings:providers.geminiContextManagement.condensingThreshold.availableContext",
												)}
												:
											</strong>{" "}
											{(
												apiConfiguration?.contextLimit ||
												modelInfo?.contextWindow ||
												1048576
											).toLocaleString()}{" "}
											{t("settings:providers.geminiContextManagement.condensingThreshold.tokens")}
										</div>
										<div className="text-vscode-descriptionForeground">
											<div>
												<strong>
													{t(
														"settings:providers.geminiContextManagement.condensingThreshold.tokenLimitTrigger",
													)}
													:
												</strong>{" "}
												{details.allowedTokens.toLocaleString()}{" "}
												{t(
													"settings:providers.geminiContextManagement.condensingThreshold.tokens",
												)}
											</div>
											<div>
												<strong>
													{t(
														"settings:providers.geminiContextManagement.condensingThreshold.actualTrigger",
													)}
													:
												</strong>{" "}
												{details.actualTrigger.toLocaleString()}{" "}
												{t(
													"settings:providers.geminiContextManagement.condensingThreshold.tokens",
												)}
											</div>
										</div>
									</>
								)
							})()}
						</div>
					</div>
				)}
			</div>

			<div className="mt-6 border-t border-vscode-widget-border pt-4">
				<h3 className="font-semibold text-lg mb-4">
					{t("settings:providers.geminiSections.advancedFeatures")}
				</h3>

				<Checkbox
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
			</div>
		</>
	)
}
