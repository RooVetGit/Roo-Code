import { type ProviderSettings, type OrganizationAllowList, glamaDefaultModelId } from "@roo-code/types"

import type { RouterModels } from "@roo/api"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { getGlamaAuthUrl } from "@src/oauth/urls"

import { ModelPicker } from "../ModelPicker"
import { ApiKey } from "../ApiKey"

type GlamaProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	routerModels?: RouterModels
	uriScheme?: string
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
}

export const Glama = ({
	apiConfiguration,
	setApiConfigurationField,
	routerModels,
	uriScheme,
	organizationAllowList,
	modelValidationError,
}: GlamaProps) => {
	const { t } = useAppTranslation()

	return (
		<>
			<ApiKey
				apiKey={apiConfiguration?.glamaApiKey || ""}
				apiKeyEnvVar="GLAMA_API_KEY"
				apiKeyUseEnvVar={!!apiConfiguration?.glamaApiKeyUseEnvVar}
				setApiKey={(value: string) => setApiConfigurationField("glamaApiKey", value)}
				setApiKeyUseEnvVar={(value: boolean) => setApiConfigurationField("glamaApiKeyUseEnvVar", value)}
				apiKeyLabel={t("settings:providers.glamaApiKey")}
				getApiKeyUrl={getGlamaAuthUrl(uriScheme)}
				getApiKeyLabel={t("settings:providers.getGlamaApiKey")}
			/>
			<ModelPicker
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				defaultModelId={glamaDefaultModelId}
				models={routerModels?.glama ?? {}}
				modelIdKey="glamaModelId"
				serviceName="Glama"
				serviceUrl="https://glama.ai/models"
				organizationAllowList={organizationAllowList}
				errorMessage={modelValidationError}
			/>
		</>
	)
}
