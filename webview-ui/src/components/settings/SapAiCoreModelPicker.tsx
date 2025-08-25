import React, { useMemo } from "react"

import { sapAiCoreModels } from "@roo-code/types"
import { useAppTranslation } from "@src/i18n/TranslationContext"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/components/ui/select"

export interface SapAiCoreModelPickerProps {
	selectedModelId: string
	onModelChange: (modelId: string) => void
	placeholder?: string
	deployedModels?: string[] // Optional: for future deployment status support
}

interface CategorizedModel {
	id: string
	isDeployed: boolean
	section: "deployed" | "supported"
}

const SapAiCoreModelPicker: React.FC<SapAiCoreModelPickerProps> = ({
	selectedModelId,
	onModelChange,
	placeholder,
	deployedModels = [], // Default to empty array when no deployment info is available
}) => {
	const { t } = useAppTranslation()
	const placeholderText = placeholder ?? t("settings:common.select")
	const categorizedModels = useMemo(() => {
		const allSupportedModels = Object.keys(sapAiCoreModels)

		// Models that are both deployed AND supported in Roo-Code
		const deployedAndSupported = deployedModels.filter((deployedModel: string) =>
			allSupportedModels.includes(deployedModel),
		)

		// Models that are supported in Roo-Code but NOT deployed (or no deployment status available)
		const supportedButNotDeployed = allSupportedModels.filter(
			(supportedModel: string) => !deployedModels.includes(supportedModel),
		)

		const deployed: CategorizedModel[] = deployedAndSupported.map((id: string) => ({
			id,
			isDeployed: true,
			section: "deployed" as const,
		}))

		const supported: CategorizedModel[] = supportedButNotDeployed.map((id: string) => ({
			id,
			isDeployed: false,
			section: "supported" as const,
		}))

		return { deployed, supported }
	}, [deployedModels])

	return (
		<div className="space-y-1">
			<label className="block font-medium text-sm">{t("settings:modelPicker.label")}</label>
			<Select value={selectedModelId} onValueChange={onModelChange}>
				<SelectTrigger className="w-full">
					<SelectValue placeholder={placeholderText} />
				</SelectTrigger>
				<SelectContent>
					{/* Show deployed models first if any exist */}
					{categorizedModels.deployed.length > 0 && (
						<>
							{/* Section header for deployed models */}
							<SelectItem
								value="deployed-header"
								disabled
								className="font-semibold text-center opacity-60"
								aria-hidden="true"
								role="presentation"
								tabIndex={-1}
								data-noninteractive>
								{t("settings:providers.sapAiCoreDeployedModelsHeader")}
							</SelectItem>
							{categorizedModels.deployed.map((model) => (
								<SelectItem key={model.id} value={model.id}>
									{model.id}
								</SelectItem>
							))}
						</>
					)}

					{/* Show not deployed models */}
					{categorizedModels.supported.length > 0 && (
						<>
							{/* Only show section header if there are deployed models above */}
							{categorizedModels.deployed.length > 0 && (
								<SelectItem
									value="not-deployed-header"
									disabled
									className="font-semibold text-center opacity-60"
									aria-hidden="true"
									role="presentation"
									tabIndex={-1}
									data-noninteractive>
									{t("settings:providers.sapAiCoreSupportedModelsHeader")}
								</SelectItem>
							)}
							{categorizedModels.supported.map((model) => (
								<SelectItem
									key={model.id}
									value={model.id}
									className={categorizedModels.deployed.length > 0 ? "opacity-60" : ""}>
									{model.id}
								</SelectItem>
							))}
						</>
					)}
				</SelectContent>
			</Select>
		</div>
	)
}

export default SapAiCoreModelPicker
