import React, { memo } from "react"
import { VSCodeTextField, VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings, OrganizationAllowList } from "@roo-code/types"
import { modelHarborDefaultModelId, modelHarborModels } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { inputEventTransform } from "../transforms"
import { ModelPicker } from "../ModelPicker"
import { useRouterModels } from "@src/components/ui/hooks/useRouterModels"

export interface ModelHarborProps {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: <K extends keyof ProviderSettings>(field: K, value: ProviderSettings[K]) => void
	organizationAllowList?: OrganizationAllowList
}

export const ModelHarbor = memo(
	({ apiConfiguration, setApiConfigurationField, organizationAllowList }: ModelHarborProps) => {
		const { t } = useAppTranslation()
		const { data: routerModels, isLoading, isError } = useRouterModels()

		// Use models from router models hook (fetched by extension host) or fallback to hardcoded models
		const models =
			routerModels?.modelharbor && Object.keys(routerModels.modelharbor).length > 0
				? routerModels.modelharbor
				: modelHarborModels

		const modelCount = Object.keys(models).length
		const isUsingFallback = models === modelHarborModels

		const handleInputChange =
			<K extends keyof ProviderSettings>(field: K) =>
			(event: any) => {
				setApiConfigurationField(field, inputEventTransform(event))
			}

		return (
			<div className="flex flex-col gap-3">
				<VSCodeTextField
					value={apiConfiguration?.modelharborApiKey || ""}
					onInput={handleInputChange("modelharborApiKey")}
					placeholder={t("settings:providers.modelharborApiKey")}
					className="w-full">
					<label className="block font-medium mb-1">{t("settings:providers.modelharborApiKey")}</label>
				</VSCodeTextField>
				<div className="text-sm text-vscode-descriptionForeground -mt-2">
					{t("settings:providers.apiKeyStorageNotice")}
				</div>

				<VSCodeLink href="https://www.modelharbor.com">
					{t("settings:providers.getModelHarborApiKey")}
				</VSCodeLink>

				{/* Model status */}
				<div className="text-sm text-vscode-descriptionForeground">
					{modelCount} models available
					{isLoading && (
						<div className="text-xs text-vscode-descriptionForeground mt-1">
							⏳ Loading models from ModelHarbor API...
						</div>
					)}
					{isError && (
						<div className="text-xs text-vscode-descriptionForeground mt-1">
							⚠️ Failed to load models from API, using fallback models
						</div>
					)}
					{!isLoading && !isError && isUsingFallback && (
						<div className="text-xs text-vscode-descriptionForeground mt-1">
							💡 Using fallback models. More models will be available once the extension host loads them
							from the API.
						</div>
					)}
					{!isLoading && !isError && !isUsingFallback && (
						<div className="text-xs text-vscode-descriptionForeground mt-1">
							✅ Models loaded from ModelHarbor API via extension host
						</div>
					)}
				</div>

				<ModelPicker
					apiConfiguration={apiConfiguration}
					setApiConfigurationField={setApiConfigurationField}
					defaultModelId={modelHarborDefaultModelId}
					models={models}
					modelIdKey="modelharborModelId"
					serviceName="ModelHarbor"
					serviceUrl="https://www.modelharbor.com"
					organizationAllowList={organizationAllowList || { allowAll: true, providers: {} }}
				/>
			</div>
		)
	},
)

ModelHarbor.displayName = "ModelHarbor"
