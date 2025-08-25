import { useCallback, useState } from "react"
import { Checkbox } from "vscrui"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@roo-code/types"
import { API_KEYS } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useSelectedModel } from "@src/components/ui/hooks/useSelectedModel"

import { inputEventTransform, noTransform } from "../transforms"
import { ApiKey } from "../ApiKey"

type AnthropicProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const Anthropic = ({ apiConfiguration, setApiConfigurationField }: AnthropicProps) => {
	const { t } = useAppTranslation()
	const selectedModel = useSelectedModel(apiConfiguration)

	const [anthropicBaseUrlSelected, setAnthropicBaseUrlSelected] = useState(!!apiConfiguration?.anthropicBaseUrl)

	// Check if the current model supports 1M context beta
	const supports1MContextBeta = selectedModel?.id === "claude-sonnet-4-20250514"

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
				apiKey={apiConfiguration?.apiKey || ""}
				apiKeyEnvVar={API_KEYS.ANTHROPIC}
				configUseEnvVars={!!apiConfiguration?.anthropicConfigUseEnvVars}
				setApiKey={(value: string) => setApiConfigurationField("apiKey", value)}
				setConfigUseEnvVars={(value: boolean) => setApiConfigurationField("anthropicConfigUseEnvVars", value)}
				apiKeyLabel={t("settings:providers.anthropicApiKey")}
				getApiKeyUrl="https://console.anthropic.com/settings/keys"
				getApiKeyLabel={t("settings:providers.getAnthropicApiKey")}
			/>
			<div>
				<Checkbox
					checked={anthropicBaseUrlSelected}
					onChange={(checked: boolean) => {
						setAnthropicBaseUrlSelected(checked)

						if (!checked) {
							setApiConfigurationField("anthropicBaseUrl", "")
							setApiConfigurationField("anthropicUseAuthToken", false)
						}
					}}>
					{t("settings:providers.useCustomBaseUrl")}
				</Checkbox>
				{anthropicBaseUrlSelected && (
					<>
						<VSCodeTextField
							value={apiConfiguration?.anthropicBaseUrl || ""}
							type="url"
							onInput={handleInputChange("anthropicBaseUrl")}
							placeholder="https://api.anthropic.com"
							className="w-full mt-1"
						/>
						<Checkbox
							checked={apiConfiguration?.anthropicUseAuthToken ?? false}
							onChange={handleInputChange("anthropicUseAuthToken", noTransform)}
							className="w-full mt-1">
							{t("settings:providers.anthropicUseAuthToken")}
						</Checkbox>
					</>
				)}
			</div>
			{supports1MContextBeta && (
				<div>
					<Checkbox
						checked={apiConfiguration?.anthropicBeta1MContext ?? false}
						onChange={(checked: boolean) => {
							setApiConfigurationField("anthropicBeta1MContext", checked)
						}}>
						{t("settings:providers.anthropic1MContextBetaLabel")}
					</Checkbox>
					<div className="text-sm text-vscode-descriptionForeground mt-1 ml-6">
						{t("settings:providers.anthropic1MContextBetaDescription")}
					</div>
				</div>
			)}
		</>
	)
}
