import { useCallback, useState, useEffect } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { ProviderSettings, RouterModels, requestyDefaultModelId } from "@roo/shared/api"
import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"
import { Button } from "@src/components/ui"

import { inputEventTransform } from "../transforms"
import { ModelPicker } from "../ModelPicker"
import { RequestyBalanceDisplay } from "./RequestyBalanceDisplay"
import { WebviewMessage } from "@roo/shared/WebviewMessage"
import { ExtensionMessage, ProviderModelsResponsePayload } from "@roo/shared/ExtensionMessage"

type RequestyProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	routerModels?: RouterModels
}

export const Requesty = ({ apiConfiguration, setApiConfigurationField, routerModels }: RequestyProps) => {
	const { t } = useAppTranslation()
	const [refreshStatus, setRefreshStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
	const [refreshError, setRefreshError] = useState<string | undefined>()

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

	const handleRefreshModels = () => {
		setRefreshStatus("loading")
		setRefreshError(undefined)
		const message: WebviewMessage = {
			type: "requestProviderModels",
			payload: {
				provider: "requesty",
				apiKey: apiConfiguration.requestyApiKey,
			},
		}
		vscode.postMessage(message)
	}

	useEffect(() => {
		const handler = (event: MessageEvent<ExtensionMessage>) => {
			const message = event.data
			if (
				message.type === "providerModelsResponse" &&
				message.payload &&
				message.payload.provider === "requesty"
			) {
				const payload = message.payload as ProviderModelsResponsePayload
				if (payload.error) {
					setRefreshStatus("error")
					setRefreshError(payload.error)
				} else {
					setRefreshStatus("success")
				}
			}
		}
		window.addEventListener("message", handler)
		return () => window.removeEventListener("message", handler)
	}, [])

	return (
		<>
			<VSCodeTextField
				value={apiConfiguration?.requestyApiKey || ""}
				type="password"
				onInput={handleInputChange("requestyApiKey")}
				placeholder={t("settings:providers.getRequestyApiKey")}
				className="w-full">
				<div className="flex justify-between items-center mb-1">
					<label className="block font-medium">{t("settings:providers.requestyApiKey")}</label>
					{apiConfiguration?.requestyApiKey && (
						<RequestyBalanceDisplay apiKey={apiConfiguration.requestyApiKey} />
					)}
				</div>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			{!apiConfiguration?.requestyApiKey && (
				<VSCodeButtonLink
					href="https://app.requesty.ai/api-keys"
					style={{ width: "100%" }}
					appearance="primary">
					{t("settings:providers.getRequestyApiKey")}
				</VSCodeButtonLink>
			)}
			<Button
				variant="outline"
				onClick={handleRefreshModels}
				disabled={refreshStatus === "loading"}
				className="w-full">
				<div className="flex items-center gap-2">
					{refreshStatus === "loading" ? (
						<span className="codicon codicon-loading codicon-modifier-spin" />
					) : (
						<span className="codicon codicon-refresh" />
					)}
					{t("settings:providers.refreshModels.label")}
				</div>
			</Button>
			{refreshStatus === "loading" && (
				<div className="text-sm text-vscode-descriptionForeground">
					{t("settings:providers.refreshModels.loading")}
				</div>
			)}
			{refreshStatus === "success" && (
				<div className="text-sm text-vscode-foreground">{t("settings:providers.refreshModels.success")}</div>
			)}
			{refreshStatus === "error" && (
				<div className="text-sm text-vscode-errorForeground">
					{refreshError || t("settings:providers.refreshModels.error")}
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
			/>
		</>
	)
}
