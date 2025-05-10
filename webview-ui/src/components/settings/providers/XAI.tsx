import { useCallback } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { ProviderSettings } from "@roo/shared/api"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"

import { inputEventTransform } from "../transforms"

type XAIProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const XAI = ({ apiConfiguration, setApiConfigurationField }: XAIProps) => {
	const { t } = useAppTranslation()

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
				value={apiConfiguration?.xaiApiKey || ""}
				type="password"
				onInput={handleInputChange("xaiApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.xaiApiKey")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			<VSCodeTextField
				value={apiConfiguration?.xaiApiKeyEnvVar || ""}
				type="text"
				onInput={handleInputChange("xaiApiKeyEnvVar")}
				placeholder={t("settings:placeholders.xaiApiKeyEnvVar")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.xaiApiKeyEnvVar")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyEnvVarNotice")}
			</div>
			{(!(apiConfiguration?.xaiApiKey || apiConfiguration?.xaiApiKeyEnvVar)) && (
				<VSCodeButtonLink href="https://api.x.ai/docs" appearance="secondary">
					{t("settings:providers.getXaiApiKey")}
				</VSCodeButtonLink>
			)}
		</>
	)
}
