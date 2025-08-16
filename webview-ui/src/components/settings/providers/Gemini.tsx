import { useCallback, useState } from "react"
import { Checkbox } from "vscrui"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@roo-code/types"
import { API_KEYS } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"

import { inputEventTransform } from "../transforms"
import { ApiKey } from "../ApiKey"

type GeminiProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	fromWelcomeView?: boolean
}

export const Gemini = ({ apiConfiguration, setApiConfigurationField, fromWelcomeView }: GeminiProps) => {
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
			<ApiKey
				apiKey={apiConfiguration?.geminiApiKey || ""}
				apiKeyEnvVar={API_KEYS.GEMINI}
				configUseEnvVars={!!apiConfiguration?.geminiConfigUseEnvVars}
				setApiKey={(value: string) => setApiConfigurationField("geminiApiKey", value)}
				setConfigUseEnvVars={(value: boolean) => setApiConfigurationField("geminiConfigUseEnvVars", value)}
				apiKeyLabel={t("settings:providers.geminiApiKey")}
				getApiKeyUrl="https://ai.google.dev/"
				getApiKeyLabel={t("settings:providers.getGeminiApiKey")}
			/>
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

				{!fromWelcomeView && (
					<>
						<Checkbox
							className="mt-6"
							data-testid="checkbox-url-context"
							checked={!!apiConfiguration.enableUrlContext}
							onChange={(checked: boolean) => setApiConfigurationField("enableUrlContext", checked)}>
							{t("settings:providers.geminiParameters.urlContext.title")}
						</Checkbox>
						<div className="text-sm text-vscode-descriptionForeground mb-3 mt-1.5">
							{t("settings:providers.geminiParameters.urlContext.description")}
						</div>

						<Checkbox
							data-testid="checkbox-grounding-search"
							checked={!!apiConfiguration.enableGrounding}
							onChange={(checked: boolean) => setApiConfigurationField("enableGrounding", checked)}>
							{t("settings:providers.geminiParameters.groundingSearch.title")}
						</Checkbox>
						<div className="text-sm text-vscode-descriptionForeground mb-3 mt-1.5">
							{t("settings:providers.geminiParameters.groundingSearch.description")}
						</div>
					</>
				)}
			</div>
		</>
	)
}
