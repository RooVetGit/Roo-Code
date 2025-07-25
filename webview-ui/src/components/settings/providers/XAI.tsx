import type { ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"

import { ApiKey } from "../ApiKey"

type XAIProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const XAI = ({ apiConfiguration, setApiConfigurationField }: XAIProps) => {
	const { t } = useAppTranslation()

	return (
		<>
			<ApiKey
				apiKey={apiConfiguration?.xaiApiKey || ""}
				apiKeyEnvVar="XAI_API_KEY"
				apiKeyUseEnvVar={!!apiConfiguration?.xaiApiKeyUseEnvVar}
				setApiKey={(value: string) => setApiConfigurationField("xaiApiKey", value)}
				setApiKeyUseEnvVar={(value: boolean) => setApiConfigurationField("xaiApiKeyUseEnvVar", value)}
				apiKeyLabel={t("settings:providers.xaiApiKey")}
				getApiKeyUrl="https://api.x.ai/docs"
				getApiKeyLabel={t("settings:providers.getXaiApiKey")}
			/>
		</>
	)
}
