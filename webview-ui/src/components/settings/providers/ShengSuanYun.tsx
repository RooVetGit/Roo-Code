import { useCallback, useState } from "react"

import { ProviderSettings, RouterModels, shengSuanYunDefaultModelId } from "@roo/shared/api"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"
import { Button } from "@src/components/ui"
import { ModelPicker } from "../ModelPicker"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { inputEventTransform } from "../transforms"

type ShengSuanYunProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	routerModels?: RouterModels
	refetchRouterModels: () => void
}

export const ShengSuanYun = ({
	apiConfiguration,
	setApiConfigurationField,
	routerModels,
	refetchRouterModels,
}: ShengSuanYunProps) => {
	const { t } = useAppTranslation()

	const [didRefetch, setDidRefetch] = useState<boolean>()

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
				value={apiConfiguration?.shengSuanYunApiKey || ""}
				type="password"
				onInput={handleInputChange("shengSuanYunApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.getShengSuanYunApiKey")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>
			{!apiConfiguration?.shengSuanYunApiKey && (
				<VSCodeButtonLink
					href="https://router.shengsuanyun.com/user/keys"
					style={{ width: "100%" }}
					appearance="primary">
					{t("settings:providers.getShengSuanYunApiKey")}
				</VSCodeButtonLink>
			)}
			<Button
				variant="outline"
				onClick={() => {
					vscode.postMessage({ type: "flushRouterModels", text: "shengsuanyun" })
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
				defaultModelId={shengSuanYunDefaultModelId}
				models={routerModels?.shengsuanyun ?? {}}
				modelIdKey="shengSuanYunModelId"
				serviceName="ShengSuanYun"
				serviceUrl="https://router.shengsuanyun.com"
			/>
		</>
	)
}
