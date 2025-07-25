import type { ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"

import { ApiKey } from "../ApiKey"

type DeepSeekProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const DeepSeek = ({ apiConfiguration, setApiConfigurationField }: DeepSeekProps) => {
	const { t } = useAppTranslation()

	return (
		<>
			<ApiKey
				apiKey={apiConfiguration?.deepSeekApiKey || ""}
				apiKeyEnvVar="DEEP_SEEK_API_KEY"
				apiKeyUseEnvVar={!!apiConfiguration?.deepSeekApiKeyUseEnvVar}
				setApiKey={(value: string) => setApiConfigurationField("deepSeekApiKey", value)}
				setApiKeyUseEnvVar={(value: boolean) => setApiConfigurationField("deepSeekApiKeyUseEnvVar", value)}
				apiKeyLabel={t("settings:providers.deepSeekApiKey")}
				getApiKeyUrl="https://platform.deepseek.com/"
				getApiKeyLabel={t("settings:providers.getDeepSeekApiKey")}
			/>
		</>
	)
}
