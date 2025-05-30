import { useCallback } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings, OrganizationAllowList } from "@roo-code/types"

import { RouterModels, nebiusDefaultModelId } from "@roo/api"

import { useAppTranslation } from "@src/i18n/TranslationContext"

import { inputEventTransform } from "../transforms"
import { ModelPicker } from "../ModelPicker"

type NebiusProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	routerModels?: RouterModels
	organizationAllowList: OrganizationAllowList
}

export const Nebius = ({
	apiConfiguration,
	setApiConfigurationField,
	routerModels,
	organizationAllowList,
}: NebiusProps) => {
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
			<VSCodeTextField
				value={apiConfiguration?.nebiusBaseUrl || "https://api.studio.nebius.ai/v1"}
				onInput={handleInputChange("nebiusBaseUrl")}
				placeholder="https://api.studio.nebius.ai/v1"
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.nebiusBaseUrl")}</label>
			</VSCodeTextField>

			<VSCodeTextField
				value={apiConfiguration?.nebiusApiKey || ""}
				type="password"
				onInput={handleInputChange("nebiusApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.nebiusApiKey")}</label>
			</VSCodeTextField>

			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>

			<ModelPicker
				apiConfiguration={apiConfiguration}
				defaultModelId={nebiusDefaultModelId}
				models={routerModels?.nebius ?? {}}
				modelIdKey="nebiusModelId"
				serviceName="Nebius"
				serviceUrl="https://docs.nebius.ai/"
				setApiConfigurationField={setApiConfigurationField}
				organizationAllowList={organizationAllowList}
			/>
		</>
	)
}
