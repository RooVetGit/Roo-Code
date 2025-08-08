import { useState } from "react"

import { type ProviderSettings, type OrganizationAllowList, requestyDefaultModelId } from "@roo-code/types"

import type { RouterModels } from "@roo/api"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/components/ui"

import { ModelPicker } from "../ModelPicker"
import { RequestyBalanceDisplay } from "./RequestyBalanceDisplay"
import { ApiKey } from "../ApiKey"

type RequestyProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	routerModels?: RouterModels
	refetchRouterModels: () => void
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
}

export const Requesty = ({
	apiConfiguration,
	setApiConfigurationField,
	routerModels,
	refetchRouterModels,
	organizationAllowList,
	modelValidationError,
}: RequestyProps) => {
	const { t } = useAppTranslation()

	const [didRefetch, setDidRefetch] = useState<boolean>()

	return (
		<>
			<ApiKey
				apiKey={apiConfiguration?.requestyApiKey || ""}
				apiKeyEnvVar="REQUESTY_API_KEY"
				configUseEnvVars={!!apiConfiguration?.requestyConfigUseEnvVars}
				setApiKey={(value: string) => setApiConfigurationField("requestyApiKey", value)}
				setConfigUseEnvVars={(value: boolean) => setApiConfigurationField("requestyConfigUseEnvVars", value)}
				apiKeyLabel={t("settings:providers.requestyApiKey")}
				getApiKeyUrl="https://app.requesty.ai/api-keys"
				getApiKeyLabel={t("settings:providers.getRequestyApiKey")}
				balanceDisplay={
					apiConfiguration?.requestyApiKey && (
						<RequestyBalanceDisplay apiKey={apiConfiguration.requestyApiKey} />
					)
				}
			/>
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
