import { useCallback, useState, useRef } from "react"
import { Trans } from "react-i18next"
import { Checkbox } from "vscrui"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { ExternalLinkIcon } from "@radix-ui/react-icons"
import { useQueryClient } from "@tanstack/react-query"

import { ProviderSettings, RouterModels, openRouterDefaultModelId } from "@roo/shared/api"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { getOpenRouterAuthUrl } from "@src/oauth/urls"
import {
	useOpenRouterModelProviders,
	OPENROUTER_DEFAULT_PROVIDER_NAME,
} from "@src/components/ui/hooks/useOpenRouterModelProviders"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Button } from "@src/components/ui"
import { vscode } from "@src/utils/vscode"

import { inputEventTransform, noTransform } from "../transforms"

import { ModelPicker } from "../ModelPicker"
import { OpenRouterBalanceDisplay } from "./OpenRouterBalanceDisplay"

type OpenRouterProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	routerModels?: RouterModels
	selectedModelId: string
	uriScheme: string | undefined
	fromWelcomeView?: boolean
}

export const OpenRouter = ({
	apiConfiguration,
	setApiConfigurationField,
	routerModels,
	selectedModelId,
	uriScheme,
	fromWelcomeView,
}: OpenRouterProps) => {
	const { t } = useAppTranslation()
	const queryClient = useQueryClient()
	const [openRouterBaseUrlSelected, setOpenRouterBaseUrlSelected] = useState(!!apiConfiguration?.openRouterBaseUrl)
	const [didRefetch, setDidRefetch] = useState<boolean>()
	const [isInvalidKey, setIsInvalidKey] = useState<boolean>(false)

	// Add refs to store timer IDs
	const didRefetchTimerRef = useRef<NodeJS.Timeout>()
	const invalidKeyTimerRef = useRef<NodeJS.Timeout>()

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

	const { data: openRouterModelProviders } = useOpenRouterModelProviders(apiConfiguration?.openRouterModelId, {
		enabled:
			!!apiConfiguration?.openRouterModelId &&
			routerModels?.openrouter &&
			Object.keys(routerModels.openrouter).length > 1 &&
			apiConfiguration.openRouterModelId in routerModels.openrouter,
	})

	const saveConfiguration = useCallback(async () => {
		vscode.postMessage({
			type: "upsertApiConfiguration",
			text: "default",
			apiConfiguration: apiConfiguration,
		})

		const waitForStateUpdate = new Promise<void>((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				window.removeEventListener("message", messageHandler)
				reject(new Error("Timeout waiting for state update"))
			}, 10000) // 10 second timeout

			const messageHandler = (event: MessageEvent) => {
				const message = event.data
				if (message.type === "state") {
					clearTimeout(timeoutId)
					window.removeEventListener("message", messageHandler)
					resolve()
				}
			}
			window.addEventListener("message", messageHandler)
		})

		try {
			await waitForStateUpdate
		} catch (error) {
			console.error("Failed to save configuration:", error)
		}
	}, [apiConfiguration])

	const requestModels = useCallback(async () => {
		vscode.postMessage({ type: "flushRouterModels", text: "openrouter" })

		const modelsPromise = new Promise<void>((resolve) => {
			const messageHandler = (event: MessageEvent) => {
				const message = event.data
				if (message.type === "routerModels") {
					window.removeEventListener("message", messageHandler)
					resolve()
				}
			}
			window.addEventListener("message", messageHandler)
		})

		vscode.postMessage({ type: "requestRouterModels" })

		await modelsPromise

		await queryClient.invalidateQueries({ queryKey: ["routerModels"] })

		// After refreshing models, check if current model is in the updated list
		// If not, select the first available model
		const updatedModels = queryClient.getQueryData<{ openrouter: RouterModels }>(["routerModels"])?.openrouter
		if (updatedModels && Object.keys(updatedModels).length > 0) {
			const currentModelId = apiConfiguration?.openRouterModelId
			const modelExists = currentModelId && Object.prototype.hasOwnProperty.call(updatedModels, currentModelId)

			if (!currentModelId || !modelExists) {
				const firstAvailableModelId = Object.keys(updatedModels)[0]
				setApiConfigurationField("openRouterModelId", firstAvailableModelId)
			}
		}

		if (!updatedModels || Object.keys(updatedModels).includes("error")) {
			return false
		} else {
			return true
		}
	}, [queryClient, apiConfiguration, setApiConfigurationField])

	const handleRefresh = useCallback(async () => {
		await saveConfiguration()
		const requestModelsResult = await requestModels()

		if (requestModelsResult) {
			setDidRefetch(true)
			// Clear any existing timer
			if (didRefetchTimerRef.current) {
				clearTimeout(didRefetchTimerRef.current)
			}
			didRefetchTimerRef.current = setTimeout(() => setDidRefetch(false), 3000)
		} else {
			setIsInvalidKey(true)
			// Clear any existing timer
			if (invalidKeyTimerRef.current) {
				clearTimeout(invalidKeyTimerRef.current)
			}
			invalidKeyTimerRef.current = setTimeout(() => setIsInvalidKey(false), 3000)
		}
	}, [saveConfiguration, requestModels])

	return (
		<>
			<VSCodeTextField
				value={apiConfiguration?.openRouterApiKey || ""}
				type="password"
				onInput={handleInputChange("openRouterApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<div className="flex justify-between items-center mb-1">
					<label className="block font-medium">{t("settings:providers.openRouterApiKey")}</label>
					{apiConfiguration?.openRouterApiKey && (
						<OpenRouterBalanceDisplay
							apiKey={apiConfiguration.openRouterApiKey}
							baseUrl={apiConfiguration.openRouterBaseUrl}
						/>
					)}
				</div>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			{!apiConfiguration?.openRouterApiKey && (
				<VSCodeButtonLink href={getOpenRouterAuthUrl(uriScheme)} style={{ width: "100%" }} appearance="primary">
					{t("settings:providers.getOpenRouterApiKey")}
				</VSCodeButtonLink>
			)}
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
			<div className="flex justify-end">
				<Button variant="outline" onClick={handleRefresh} className="w-1/2 max-w-xs">
					<div className="flex items-center gap-2 justify-center">
						<span className="codicon codicon-refresh" />
						{t("settings:providers.refreshModels.label")}
					</div>
				</Button>
			</div>
			{didRefetch && (
				<div className="flex items-center text-vscode-charts-green">
					{t("settings:providers.openRouterRefreshModelsSuccess") || "Models refreshed successfully!"}
				</div>
			)}
			{isInvalidKey && (
				<div className="flex items-center text-vscode-errorForeground">
					{t("settings:providers.openRouterInvalidApiKey") || "Invalid API key or error refreshing models."}
				</div>
			)}
			<ModelPicker
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				defaultModelId={openRouterDefaultModelId}
				models={routerModels?.openrouter ?? {}}
				modelIdKey="openRouterModelId"
				serviceName="OpenRouter"
				serviceUrl="https://openrouter.ai/models"
			/>
			{openRouterModelProviders && Object.keys(openRouterModelProviders).length > 0 && (
				<div>
					<div className="flex items-center gap-1">
						<label className="block font-medium mb-1">
							{t("settings:providers.openRouter.providerRouting.title")}
						</label>
						<a href={`https://openrouter.ai/${selectedModelId}/providers`}>
							<ExternalLinkIcon className="w-4 h-4" />
						</a>
					</div>
					<Select
						value={apiConfiguration?.openRouterSpecificProvider || OPENROUTER_DEFAULT_PROVIDER_NAME}
						onValueChange={(value) => setApiConfigurationField("openRouterSpecificProvider", value)}>
						<SelectTrigger className="w-full">
							<SelectValue placeholder={t("settings:common.select")} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={OPENROUTER_DEFAULT_PROVIDER_NAME}>
								{OPENROUTER_DEFAULT_PROVIDER_NAME}
							</SelectItem>
							{Object.entries(openRouterModelProviders).map(([value, { label }]) => (
								<SelectItem key={value} value={value}>
									{label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<div className="text-sm text-vscode-descriptionForeground mt-1">
						{t("settings:providers.openRouter.providerRouting.description")}{" "}
						<a href="https://openrouter.ai/docs/features/provider-routing">
							{t("settings:providers.openRouter.providerRouting.learnMore")}.
						</a>
					</div>
				</div>
			)}
		</>
	)
}
