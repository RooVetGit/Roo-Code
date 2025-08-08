import type { ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"

import { ApiKey } from "../ApiKey"

type GroqProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const Groq = ({ apiConfiguration, setApiConfigurationField }: GroqProps) => {
	const { t } = useAppTranslation()

	return (
		<>
			<ApiKey
				apiKey={apiConfiguration?.groqApiKey || ""}
				apiKeyEnvVar="GROQ_API_KEY"
				configUseEnvVars={!!apiConfiguration?.groqConfigUseEnvVars}
				setApiKey={(value: string) => setApiConfigurationField("groqApiKey", value)}
				setConfigUseEnvVars={(value: boolean) => setApiConfigurationField("groqConfigUseEnvVars", value)}
				apiKeyLabel={t("settings:providers.groqApiKey")}
				getApiKeyUrl="https://console.groq.com/keys"
				getApiKeyLabel={t("settings:providers.getGroqApiKey")}
			/>
		</>
	)
}
