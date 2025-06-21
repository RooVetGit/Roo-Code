import { useCallback, useState } from "react"
import { Checkbox } from "vscrui"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { Slider } from "@src/components/ui"

import type { ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"

import { inputEventTransform } from "../transforms"

type GeminiProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const Gemini = ({ apiConfiguration, setApiConfigurationField }: GeminiProps) => {
	const { t } = useAppTranslation()

	const [googleGeminiBaseUrlSelected, setGoogleGeminiBaseUrlSelected] = useState(
		!!apiConfiguration?.googleGeminiBaseUrl,
	)

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
			<div className="mt-4">
				<label className="block font-medium mb-1">{t("settings:providers.topP")}</label>
				<div className="flex items-center space-x-2">
					<Slider
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
					{t("settings:providers.topPDescription")}
				</div>
			</div>
			<div className="mt-4">
				<label className="block font-medium mb-1">{t("settings:providers.topK")}</label>
				<div className="flex items-center space-x-2">
					<Slider
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
					{t("settings:providers.topKDescription")}
				</div>
			</div>
			<div className="mt-4">
				<label className="block font-medium mb-1">{t("settings:providers.maxOutputTokens")}</label>
				<div className="flex items-center space-x-2">
					<Slider
						min={0}
						max={2048}
						step={1}
						value={[apiConfiguration.maxOutputTokens ?? 0]}
						onValueChange={(values: number[]) => setApiConfigurationField("maxOutputTokens", values[0])}
						className="flex-grow"
					/>
					<VSCodeTextField
						value={(apiConfiguration.maxOutputTokens ?? 0).toString()}
						type="text"
						inputMode="numeric"
						onInput={handleInputChange("maxOutputTokens", (e) => parseInt((e as any).target.value, 10))}
						className="w-16"
					/>
				</div>
				<div className="text-sm text-vscode-descriptionForeground">
					{t("settings:providers.maxOutputTokensDescription")}
				</div>
			</div>
			<Checkbox
				checked={!!apiConfiguration.enableUrlContext}
				onChange={(checked: boolean) => setApiConfigurationField("enableUrlContext", checked)}>
				{t("settings:providers.enableUrlContext")}
			</Checkbox>
			<div className="text-sm text-vscode-descriptionForeground mb-2">
				{t("settings:providers.enableUrlContextDescription")}
			</div>
			<Checkbox
				checked={!!apiConfiguration.enableGrounding}
				onChange={(checked: boolean) => setApiConfigurationField("enableGrounding", checked)}>
				{t("settings:providers.enableGrounding")}
			</Checkbox>
			<div className="text-sm text-vscode-descriptionForeground mb-2">
				{t("settings:providers.enableGroundingDescription")}
			</div>
			<div className="mt-4">
				<label className="block font-medium mb-1">{t("settings:providers.contextLimit")}</label>
				<div className="flex items-center space-x-2">
					<Slider
						min={0}
						max={2048}
						step={1}
						value={[apiConfiguration.contextLimit ?? 0]}
						onValueChange={(values: number[]) => setApiConfigurationField("contextLimit", values[0])}
						className="flex-grow"
					/>
					<VSCodeTextField
						value={(apiConfiguration.contextLimit ?? 0).toString()}
						type="text"
						inputMode="numeric"
						onInput={handleInputChange("contextLimit", (e) => parseInt((e as any).target.value, 10))}
						className="w-16"
					/>
				</div>
				<div className="text-sm text-vscode-descriptionForeground">
					{t("settings:providers.contextLimitDescription")}
				</div>
			</div>
		</>
	)
}
