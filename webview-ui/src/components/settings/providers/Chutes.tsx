import type { ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"

import { ApiKey } from "../ApiKey"

type ChutesProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const Chutes = ({ apiConfiguration, setApiConfigurationField }: ChutesProps) => {
	const { t } = useAppTranslation()

	return (
		<>
			<ApiKey
				apiKey={apiConfiguration?.chutesApiKey || ""}
				apiKeyEnvVar="CHUTES_API_KEY"
				configUseEnvVars={!!apiConfiguration?.chutesConfigUseEnvVars}
				setApiKey={(value: string) => setApiConfigurationField("apiKey", value)}
				setConfigUseEnvVars={(value: boolean) => setApiConfigurationField("chutesConfigUseEnvVars", value)}
				apiKeyLabel={t("settings:providers.chutesApiKey")}
				getApiKeyUrl="https://chutes.ai/app/api"
				getApiKeyLabel={t("settings:providers.getchutesApiKey")}
			/>
		</>
	)
}
