import { useCallback } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { type ProviderSettings, type OrganizationAllowList, glamaDefaultModelId } from "@roo-code/types"

import type { RouterModels } from "@roo/api"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { getGlamaAuthUrl } from "@src/oauth/urls"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"
import { ApiKeyInput } from "@src/components/common/ApiKeyInput"

import { inputEventTransform } from "../transforms"
import { ModelPicker } from "../ModelPicker"

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
			<ApiKeyInput
				value={apiConfiguration?.glamaApiKey || ""}
				onInput={handleInputChange("glamaApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				label={t("settings:providers.glamaApiKey")}
			/>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			{!apiConfiguration?.glamaApiKey && (
				<VSCodeButtonLink href={getGlamaAuthUrl(uriScheme)} style={{ width: "100%" }} appearance="primary">
					{t("settings:providers.getGlamaApiKey")}
				</VSCodeButtonLink>
			)}
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
