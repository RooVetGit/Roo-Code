import { useCallback } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { ApiConfiguration } from "@roo/shared/api"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"

import { inputEventTransform } from "../transforms"

type CerebrasProps = {
	apiConfiguration: ApiConfiguration
	setApiConfigurationField: (field: keyof ApiConfiguration, value: ApiConfiguration[keyof ApiConfiguration]) => void
}

export const Cerebras = ({ apiConfiguration, setApiConfigurationField }: CerebrasProps) => {
	const { t } = useAppTranslation()

	const handleInputChange = useCallback(
		<K extends keyof ApiConfiguration, E>(
			field: K,
			transform: (event: E) => ApiConfiguration[K] = inputEventTransform,
		) =>
			(event: E | Event) => {
				setApiConfigurationField(field, transform(event as E))
			},
		[setApiConfigurationField],
	)

	return (
		<>
			<VSCodeTextField
				value={apiConfiguration?.cerebrasApiKey || ""}
				type="password"
				onInput={handleInputChange("cerebrasApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium mb-1">Cerebras API Key</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			{!apiConfiguration?.cerebrasApiKey && (
				<VSCodeButtonLink href="https://inference.cerebras.ai/" appearance="secondary">
					Get Cerebras API Key
				</VSCodeButtonLink>
			)}
			<VSCodeTextField
				value={apiConfiguration?.cerebrasBaseUrl || ""}
				type="url"
				onInput={handleInputChange("cerebrasBaseUrl")}
				placeholder="https://api.cerebras.ai/v1"
				className="w-full">
				<label className="block font-medium mb-1">Cerebras Base URL</label>
			</VSCodeTextField>
		</>
	)
}
