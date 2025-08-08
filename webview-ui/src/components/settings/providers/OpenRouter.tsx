import { useCallback, useState } from "react"
import { Trans } from "react-i18next"
import { Checkbox } from "vscrui"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { type ProviderSettings, type OrganizationAllowList, openRouterDefaultModelId } from "@roo-code/types"

import type { RouterModels } from "@roo/api"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { getOpenRouterAuthUrl } from "@src/oauth/urls"

import { inputEventTransform, noTransform } from "../transforms"

import { ModelPicker } from "../ModelPicker"
import { OpenRouterBalanceDisplay } from "./OpenRouterBalanceDisplay"
import { ApiKey } from "../ApiKey"

type OpenRouterProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	routerModels?: RouterModels
	selectedModelId: string
	uriScheme: string | undefined
	fromWelcomeView?: boolean
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
}

export const OpenRouter = ({
	apiConfiguration,
	setApiConfigurationField,
	routerModels,
	uriScheme,
	fromWelcomeView,
	organizationAllowList,
	modelValidationError,
}: OpenRouterProps) => {
	const { t } = useAppTranslation()

	const [openRouterBaseUrlSelected, setOpenRouterBaseUrlSelected] = useState(!!apiConfiguration?.openRouterBaseUrl)

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
				apiKey={apiConfiguration?.openRouterApiKey || ""}
				apiKeyEnvVar="OPEN_ROUTER_API_KEY"
				configUseEnvVars={!!apiConfiguration?.openRouterConfigUseEnvVars}
				setApiKey={(value: string) => setApiConfigurationField("openRouterApiKey", value)}
				setConfigUseEnvVars={(value: boolean) => setApiConfigurationField("openRouterConfigUseEnvVars", value)}
				apiKeyLabel={t("settings:providers.openRouterApiKey")}
				getApiKeyUrl={getOpenRouterAuthUrl(uriScheme)}
				getApiKeyLabel={t("settings:providers.getOpenRouterApiKey")}
				balanceDisplay={apiConfiguration?.openRouterApiKey && (
					<OpenRouterBalanceDisplay
						apiKey={apiConfiguration.openRouterApiKey}
						baseUrl={apiConfiguration.openRouterBaseUrl}
					/>
				)}
			/>
			{!fromWelcomeView && (
				<>
					<div>
						<Checkbox
							checked={openRouterBaseUrlSelected}
							onChange={(checked: boolean) => {
								setOpenRouterBaseUrlSelected(checked)

								if (!checked) {
									setApiConfigurationField("openRouterBaseUrl", "")
								}
							}}>
							{t("settings:providers.useCustomBaseUrl")}
						</Checkbox>
						{openRouterBaseUrlSelected && (
							<VSCodeTextField
								value={apiConfiguration?.openRouterBaseUrl || ""}
								type="url"
								onInput={handleInputChange("openRouterBaseUrl")}
								placeholder="Default: https://openrouter.ai/api/v1"
								className="w-full mt-1"
							/>
						)}
					</div>
					<Checkbox
						checked={apiConfiguration?.openRouterUseMiddleOutTransform ?? true}
						onChange={handleInputChange("openRouterUseMiddleOutTransform", noTransform)}>
						<Trans
							i18nKey="settings:providers.openRouterTransformsText"
							components={{
								a: <a href="https://openrouter.ai/docs/transforms" />,
							}}
						/>
					</Checkbox>
				</>
			)}
			<ModelPicker
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				defaultModelId={openRouterDefaultModelId}
				models={routerModels?.openrouter ?? {}}
				modelIdKey="openRouterModelId"
				serviceName="OpenRouter"
				serviceUrl="https://openrouter.ai/models"
				organizationAllowList={organizationAllowList}
				errorMessage={modelValidationError}
			/>
		</>
	)
}
