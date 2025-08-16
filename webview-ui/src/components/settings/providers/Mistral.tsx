import { useCallback } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { type ProviderSettings, mistralDefaultModelId, API_KEYS } from "@roo-code/types"

import type { RouterModels } from "@roo/api"

import { useAppTranslation } from "@src/i18n/TranslationContext"

import { inputEventTransform } from "../transforms"
import { ApiKey } from "../ApiKey"

type MistralProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	routerModels?: RouterModels
}

export const Mistral = ({ apiConfiguration, setApiConfigurationField }: MistralProps) => {
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
			<ApiKey
				apiKey={apiConfiguration?.mistralApiKey || ""}
				apiKeyEnvVar={API_KEYS.MISTRAL}
				configUseEnvVars={!!apiConfiguration?.mistralConfigUseEnvVars}
				setApiKey={(value: string) => setApiConfigurationField("mistralApiKey", value)}
				setConfigUseEnvVars={(value: boolean) => setApiConfigurationField("mistralConfigUseEnvVars", value)}
				apiKeyLabel={t("settings:providers.mistralApiKey")}
				getApiKeyUrl="https://console.mistral.ai/"
				getApiKeyLabel={t("settings:providers.getMistralApiKey")}
			/>
			{(apiConfiguration?.apiModelId?.startsWith("codestral-") ||
				(!apiConfiguration?.apiModelId && mistralDefaultModelId.startsWith("codestral-"))) && (
				<>
					<VSCodeTextField
						value={apiConfiguration?.mistralCodestralUrl || ""}
						type="url"
						onInput={handleInputChange("mistralCodestralUrl")}
						placeholder="https://codestral.mistral.ai"
						className="w-full">
						<label className="block font-medium mb-1">{t("settings:providers.codestralBaseUrl")}</label>
					</VSCodeTextField>
					<div className="text-sm text-vscode-descriptionForeground -mt-2">
						{t("settings:providers.codestralBaseUrlDesc")}
					</div>
				</>
			)}
		</>
	)
}
