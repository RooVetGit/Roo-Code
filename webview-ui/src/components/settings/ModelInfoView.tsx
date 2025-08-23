import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import type { ModelInfo } from "@roo-code/types"

import { formatPrice } from "@src/utils/formatPrice"
import { cn } from "@src/lib/utils"
import { useAppTranslation } from "@src/i18n/TranslationContext"

import { ModelDescriptionMarkdown } from "./ModelDescriptionMarkdown"

type ModelInfoViewProps = {
	apiProvider?: string
	selectedModelId: string
	modelInfo?: ModelInfo
	isDescriptionExpanded: boolean
	setIsDescriptionExpanded: (isExpanded: boolean) => void
	serviceTier?: "auto" | "default" | "flex"
}

export const ModelInfoView = ({
	apiProvider,
	selectedModelId,
	modelInfo,
	isDescriptionExpanded,
	setIsDescriptionExpanded,
	serviceTier,
}: ModelInfoViewProps) => {
	const { t } = useAppTranslation()

	// Calculate effective pricing based on flex service tier for new OpenAI models GPT-5 family ,o3, o4-mini, if used.
	const getEffectivePricing = (modelInfo: ModelInfo) => {
		// Only apply OpenAI flex tiers when the API provider is OpenAI and the model explicitly supports it
		if (
			(apiProvider === "openai" || apiProvider === "openai-native") &&
			serviceTier === "flex" &&
			modelInfo.tiers &&
			modelInfo.supportsOpenAiFlexTier
		) {
			// Only use an explicitly named 'flex' tier. Do not fall back to other tiers.
			const named = modelInfo.tiers.find((t) => t.name === "flex")
			if (named) {
				return {
					...modelInfo,
					inputPrice: named.inputPrice ?? modelInfo.inputPrice,
					outputPrice: named.outputPrice ?? modelInfo.outputPrice,
					cacheReadsPrice: named.cacheReadsPrice ?? modelInfo.cacheReadsPrice,
					cacheWritesPrice: named.cacheWritesPrice ?? modelInfo.cacheWritesPrice,
				}
			}
		}
		return modelInfo
	}

	const effectiveModelInfo = modelInfo ? getEffectivePricing(modelInfo) : modelInfo

	const infoItems = [
		typeof modelInfo?.contextWindow === "number" && modelInfo.contextWindow > 0 && (
			<>
				<span className="font-medium">{t("settings:modelInfo.contextWindow")}</span>{" "}
				{modelInfo.contextWindow?.toLocaleString()} tokens
			</>
		),
		typeof modelInfo?.maxTokens === "number" && modelInfo.maxTokens > 0 && (
			<>
				<span className="font-medium">{t("settings:modelInfo.maxOutput")}:</span>{" "}
				{modelInfo.maxTokens?.toLocaleString()} tokens
			</>
		),
		<ModelInfoSupportsItem
			isSupported={modelInfo?.supportsImages ?? false}
			supportsLabel={t("settings:modelInfo.supportsImages")}
			doesNotSupportLabel={t("settings:modelInfo.noImages")}
		/>,
		<ModelInfoSupportsItem
			isSupported={modelInfo?.supportsComputerUse ?? false}
			supportsLabel={t("settings:modelInfo.supportsComputerUse")}
			doesNotSupportLabel={t("settings:modelInfo.noComputerUse")}
		/>,
		<ModelInfoSupportsItem
			isSupported={modelInfo?.supportsPromptCache ?? false}
			supportsLabel={t("settings:modelInfo.supportsPromptCache")}
			doesNotSupportLabel={t("settings:modelInfo.noPromptCache")}
		/>,
		effectiveModelInfo?.inputPrice !== undefined && effectiveModelInfo.inputPrice > 0 && (
			<>
				<span className="font-medium">{t("settings:modelInfo.inputPrice")}:</span>{" "}
				{formatPrice(effectiveModelInfo.inputPrice)} / 1M tokens
			</>
		),
		effectiveModelInfo?.outputPrice !== undefined && effectiveModelInfo.outputPrice > 0 && (
			<>
				<span className="font-medium">{t("settings:modelInfo.outputPrice")}:</span>{" "}
				{formatPrice(effectiveModelInfo.outputPrice)} / 1M tokens
			</>
		),
		modelInfo?.supportsPromptCache && effectiveModelInfo?.cacheReadsPrice && (
			<>
				<span className="font-medium">{t("settings:modelInfo.cacheReadsPrice")}:</span>{" "}
				{formatPrice(effectiveModelInfo.cacheReadsPrice || 0, { minFractionDigits: 2, maxFractionDigits: 3 })} /
				1M tokens
			</>
		),
		modelInfo?.supportsPromptCache && effectiveModelInfo?.cacheWritesPrice && (
			<>
				<span className="font-medium">{t("settings:modelInfo.cacheWritesPrice")}:</span>{" "}
				{formatPrice(effectiveModelInfo.cacheWritesPrice || 0, { minFractionDigits: 2, maxFractionDigits: 3 })}{" "}
				/ 1M tokens
			</>
		),
		apiProvider === "gemini" && (
			<span className="italic">
				{selectedModelId.includes("pro-preview")
					? t("settings:modelInfo.gemini.billingEstimate")
					: t("settings:modelInfo.gemini.freeRequests", {
							count: selectedModelId && selectedModelId.includes("flash") ? 15 : 2,
						})}{" "}
				<VSCodeLink href="https://ai.google.dev/pricing" className="text-sm">
					{t("settings:modelInfo.gemini.pricingDetails")}
				</VSCodeLink>
			</span>
		),
	].filter(Boolean)

	return (
		<>
			{modelInfo?.description && (
				<ModelDescriptionMarkdown
					key="description"
					markdown={modelInfo.description}
					isExpanded={isDescriptionExpanded}
					setIsExpanded={setIsDescriptionExpanded}
				/>
			)}
			<div className="text-sm text-vscode-descriptionForeground">
				{infoItems.map((item, index) => (
					<div key={index}>{item}</div>
				))}
			</div>
		</>
	)
}

const ModelInfoSupportsItem = ({
	isSupported,
	supportsLabel,
	doesNotSupportLabel,
}: {
	isSupported: boolean
	supportsLabel: string
	doesNotSupportLabel: string
}) => (
	<div className="flex items-center gap-1 font-medium">
		<span className={cn("codicon", isSupported ? "codicon-check" : "codicon-x")} />
		{isSupported ? supportsLabel : doesNotSupportLabel}
	</div>
)
