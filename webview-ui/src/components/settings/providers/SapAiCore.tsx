import { useCallback, useMemo } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"
import { useSapAiCoreModels } from "@src/components/ui/hooks/useSapAiCoreModels"
import SapAiCoreModelPicker from "../SapAiCoreModelPicker"

import { inputEventTransform } from "../transforms"

type SapAiCoreProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const SapAiCore = ({ apiConfiguration, setApiConfigurationField }: SapAiCoreProps) => {
	const { t } = useAppTranslation()

	// Check if all required fields are provided to enable model fetching
	const hasRequiredConfig = useMemo(() => {
		return !!(
			apiConfiguration?.sapAiCoreClientId &&
			apiConfiguration?.sapAiCoreClientSecret &&
			apiConfiguration?.sapAiCoreBaseUrl &&
			apiConfiguration?.sapAiCoreTokenUrl
		)
	}, [
		apiConfiguration?.sapAiCoreClientId,
		apiConfiguration?.sapAiCoreClientSecret,
		apiConfiguration?.sapAiCoreBaseUrl,
		apiConfiguration?.sapAiCoreTokenUrl,
	])

	// Fetch deployed models when configuration is complete
	const { data: deployedModelsResponse, isLoading, error } = useSapAiCoreModels(hasRequiredConfig)

	// Extract deployed models array
	const deployedModels = useMemo(() => {
		return deployedModelsResponse?.success ? deployedModelsResponse.models : []
	}, [deployedModelsResponse])

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
				value={apiConfiguration?.sapAiCoreBaseUrl || ""}
				onInput={handleInputChange("sapAiCoreBaseUrl")}
				placeholder="https://ai-api.ai.your-domain.com"
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.sapAiCoreBaseUrl")}</label>
			</VSCodeTextField>

			<VSCodeTextField
				value={apiConfiguration?.sapAiCoreClientId || ""}
				onInput={handleInputChange("sapAiCoreClientId")}
				placeholder={t("settings:placeholders.clientId")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.sapAiCoreClientId")}</label>
			</VSCodeTextField>

			<VSCodeTextField
				value={apiConfiguration?.sapAiCoreClientSecret || ""}
				type="password"
				onInput={handleInputChange("sapAiCoreClientSecret")}
				placeholder={t("settings:placeholders.clientSecret")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.sapAiCoreClientSecret")}</label>
			</VSCodeTextField>

			<VSCodeTextField
				value={apiConfiguration?.sapAiCoreTokenUrl || ""}
				onInput={handleInputChange("sapAiCoreTokenUrl")}
				placeholder="https://auth.ai.your-domain.com/oauth/token"
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.sapAiCoreTokenUrl")}</label>
			</VSCodeTextField>

			<VSCodeTextField
				value={apiConfiguration?.sapAiResourceGroup || ""}
				onInput={handleInputChange("sapAiResourceGroup")}
				placeholder="default"
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.sapAiResourceGroup")}</label>
			</VSCodeTextField>

			<SapAiCoreModelPicker
				selectedModelId={apiConfiguration?.apiModelId || ""}
				onModelChange={(value) => {
					setApiConfigurationField("apiModelId", value)
				}}
				placeholder={t("settings:common.select")}
				deployedModels={deployedModels}
			/>

			{/* Show loading/error states for model fetching */}
			{hasRequiredConfig && isLoading && (
				<div className="text-sm text-vscode-descriptionForeground">
					Fetching deployed models from SAP AI Core...
				</div>
			)}
			{hasRequiredConfig && error && (
				<div className="text-sm text-vscode-errorForeground">
					Failed to fetch deployed models: {error.message}
				</div>
			)}
			{hasRequiredConfig && deployedModelsResponse && !deployedModelsResponse.success && (
				<div className="text-sm text-vscode-errorForeground">
					{deployedModelsResponse.error || "Failed to fetch deployed models"}
				</div>
			)}

			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>

			<VSCodeButtonLink href="https://docs.sap.com/docs/sap-ai-core" className="inline-flex items-center gap-1">
				Learn More
			</VSCodeButtonLink>
		</>
	)
}
