import { useEffect, useMemo } from "react"
import { VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import type { ProviderSettings, ModelInfo } from "@roo-code/types"

type Props = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: any) => void
	modelInfo?: ModelInfo
	modelId?: string
}

// Models that currently (14th Aug 2025) have flex pricing
const FLEX_COMPATIBLE_MODELS = [
	"gpt-5-2025-08-07",
	"gpt-5-mini-2025-08-07",
	"gpt-5-nano-2025-08-07",
	"o3-2025-04-16",
	"o4-mini-2025-04-16",
	"o3",
	"o3-high",
	"o3-low",
	"o4-mini",
	"o4-mini-high",
	"o4-mini-low",
]
const SERVICE_TIERS: Array<"auto" | "default" | "flex"> = ["auto", "default", "flex"]

export const ServiceTier = ({ apiConfiguration, setApiConfigurationField, modelId }: Props) => {
	const { t } = useAppTranslation()
	const effectiveModelId = modelId || apiConfiguration.openAiModelId || ""

	const isSupported = useMemo(() => {
		const supported = !!effectiveModelId && FLEX_COMPATIBLE_MODELS.some((m) => effectiveModelId === m) //include only exact match e.g. o3-mini is not supported while o3 is supported
		return supported
	}, [effectiveModelId])

	// Initialize to auto when supported and unset; clear when unsupported
	useEffect(() => {
		if (isSupported && !apiConfiguration.serviceTier) {
			setApiConfigurationField("serviceTier", "auto")
		} else if (!isSupported && apiConfiguration.serviceTier) {
			setApiConfigurationField("serviceTier", undefined)
		}
	}, [isSupported, apiConfiguration.serviceTier, setApiConfigurationField])

	if (!isSupported) return null

	return (
		<div className="flex flex-col gap-1">
			<label className="block font-medium mb-1">{t("settings:providers.serviceTier.label")}</label>
			<VSCodeDropdown
				value={apiConfiguration.serviceTier || "auto"}
				onChange={(e: any) => setApiConfigurationField("serviceTier", e.target.value)}
				className="w-48">
				{SERVICE_TIERS.map((tier) => (
					<VSCodeOption key={tier} value={tier}>
						{t(`settings:providers.serviceTier.${tier}` as any)}
					</VSCodeOption>
				))}
			</VSCodeDropdown>
			<div className="text-sm text-vscode-descriptionForeground">
				{t("settings:providers.serviceTier.description", {
					defaultValue: "Select pricing tier. Flex uses discounted rates when available.",
				})}
			</div>
		</div>
	)
}

export default ServiceTier
