import { useCallback, useEffect, useState } from "react"
import { VSCodeCheckbox, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { type ProviderSettings, requestyDefaultModelId, API_KEYS } from "@roo-code/types"

import type { OrganizationAllowList } from "@roo/cloud"
import type { RouterModels } from "@roo/api"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/components/ui"

import { ModelPicker } from "../ModelPicker"
import { RequestyBalanceDisplay } from "./RequestyBalanceDisplay"
import { ApiKey } from "../ApiKey"
import { getCallbackUrl } from "@/oauth/urls"
import { toRequestyServiceUrl } from "@roo/utils/requesty"
import { inputEventTransform } from "../transforms"

type RequestyProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	routerModels?: RouterModels
	refetchRouterModels: () => void
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
	uriScheme?: string
}

export const Requesty = ({
	apiConfiguration,
	setApiConfigurationField,
	routerModels,
	refetchRouterModels,
	organizationAllowList,
	modelValidationError,
	uriScheme,
}: RequestyProps) => {
	const { t } = useAppTranslation()

	const [didRefetch, setDidRefetch] = useState<boolean>()
	const [requestyEndpointSelected, setRequestyEndpointSelected] = useState(!!apiConfiguration.requestyBaseUrl)

	// This ensures that the "Use custom URL" checkbox is hidden when the user deletes the URL.
	useEffect(() => {
		setRequestyEndpointSelected(!!apiConfiguration?.requestyBaseUrl)
	}, [apiConfiguration?.requestyBaseUrl])

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

	const getApiKeyUrl = () => {
		const callbackUrl = getCallbackUrl("requesty", uriScheme)
		const baseUrl = toRequestyServiceUrl(apiConfiguration.requestyBaseUrl, "app")

		const authUrl = new URL(`oauth/authorize?callback_url=${callbackUrl}`, baseUrl)

		return authUrl.toString()
	}

	return (
		<>
			<ApiKey
				apiKey={apiConfiguration?.requestyApiKey || ""}
				apiKeyEnvVar={API_KEYS.REQUESTY}
				configUseEnvVars={!!apiConfiguration?.requestyConfigUseEnvVars}
				setApiKey={(value: string) => setApiConfigurationField("requestyApiKey", value)}
				setConfigUseEnvVars={(value: boolean) => setApiConfigurationField("requestyConfigUseEnvVars", value)}
				apiKeyLabel={t("settings:providers.requestyApiKey")}
				getApiKeyUrl={getApiKeyUrl()}
				getApiKeyLabel={t("settings:providers.getRequestyApiKey")}
				balanceDisplay={
					apiConfiguration?.requestyApiKey && (
						<RequestyBalanceDisplay apiKey={apiConfiguration.requestyApiKey}
 									baseUrl={apiConfiguration.requestyBaseUrl}
						/>
					)
				}
			/>
			<VSCodeCheckbox
				checked={requestyEndpointSelected}
				onChange={(e: any) => {
					const isChecked = e.target.checked === true
					if (!isChecked) {
						setApiConfigurationField("requestyBaseUrl", undefined)
					}

					setRequestyEndpointSelected(isChecked)
				}}>
				{t("settings:providers.requestyUseCustomBaseUrl")}
			</VSCodeCheckbox>
			{requestyEndpointSelected && (
				<VSCodeTextField
					value={apiConfiguration?.requestyBaseUrl || ""}
					type="text"
					onInput={handleInputChange("requestyBaseUrl")}
					placeholder={t("settings:providers.getRequestyBaseUrl")}
					className="w-full">
					<div className="flex justify-between items-center mb-1">
						<label className="block font-medium">{t("settings:providers.getRequestyBaseUrl")}</label>
					</div>
				</VSCodeTextField>
			)}
			<Button
				variant="outline"
				onClick={() => {
					vscode.postMessage({ type: "flushRouterModels", text: "requesty" })
					refetchRouterModels()
					setDidRefetch(true)
				}}>
				<div className="flex items-center gap-2">
					<span className="codicon codicon-refresh" />
					{t("settings:providers.refreshModels.label")}
				</div>
			</Button>
			{didRefetch && (
				<div className="flex items-center text-vscode-errorForeground">
					{t("settings:providers.refreshModels.hint")}
				</div>
			)}
			<ModelPicker
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				defaultModelId={requestyDefaultModelId}
				models={routerModels?.requesty ?? {}}
				modelIdKey="requestyModelId"
				serviceName="Requesty"
				serviceUrl="https://requesty.ai"
				organizationAllowList={organizationAllowList}
				errorMessage={modelValidationError}
			/>
		</>
	)
}
