import React, { useCallback } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { WarningThreshold } from "@roo/schemas"
import { Switch } from "@/components/ui/switch"

type DefaultValues = {
	context: number
	tokens: number
	cost: number
}

const defaultValues: DefaultValues = {
	context: 75,
	tokens: 5_500_000,
	cost: 2,
}

interface WarningThresholdControlProps {
	value: WarningThreshold
	onChange: (value: WarningThreshold) => void
}

export const WarningThresholdControl: React.FC<WarningThresholdControlProps> = ({ value, onChange }) => {
	const { t } = useAppTranslation()

	const handleChange = useCallback(
		(field: keyof WarningThreshold, newValue: number) => {
			onChange({ ...value, [field]: newValue })
		},
		[onChange, value],
	)

	const handleSwitchChange = useCallback(
		(field: keyof WarningThreshold, checked: boolean) => {
			handleChange(field, checked ? defaultValues[field] : -1)
		},
		[handleChange],
	)

	return (
		<div className="space-y-6">
			<span className="text-lg font-medium">{t("settings:providers.warningThreshold.label")}</span>

			<div className="space-y-6">
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							<div className="flex items-center gap-2">
								<input
									type="number"
									pattern="-?[0-9]*"
									className="w-16 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border px-2.5 py-1.5 rounded text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-vscode-focusBorder"
									value={value.context === -1 ? "" : (value.context ?? 75)}
									min={-1}
									max={100}
									step={1}
									onChange={(e) => {
										const newValue = e.target.value === "" ? -1 : parseFloat(e.target.value)
										if (!isNaN(newValue)) {
											handleChange("context", newValue)
										}
									}}
									onClick={(e) => e.currentTarget.select()}
									data-testid="context-warning-threshold-input"
									placeholder="-1"
								/>
								<span className="ml-2 mr-1">%</span>
							</div>
							<span>{t("settings:providers.warningThreshold.context")}</span>
						</div>
						<Switch
							checked={value.context !== -1}
							onCheckedChange={(checked: boolean) => handleSwitchChange("context", checked)}
							className="data-[state=checked]:bg-vscode-button-background"
						/>
					</div>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:providers.warningThreshold.contextDescription")}
					</div>
				</div>

				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							<input
								type="number"
								pattern="-?[0-9]*"
								className="w-24 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border px-2.5 py-1.5 rounded text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-vscode-focusBorder"
								value={value.tokens === -1 ? "" : (value.tokens ?? 5_500_000)}
								min={-1}
								onChange={(e) => {
									const newValue = e.target.value === "" ? -1 : parseInt(e.target.value, 10)
									if (!isNaN(newValue)) {
										handleChange("tokens", newValue === -1 ? -1 : Math.max(150_000, newValue))
									}
								}}
								onClick={(e) => e.currentTarget.select()}
								data-testid="tokens-warning-threshold-input"
								placeholder="-1"
							/>
							<span>{t("settings:providers.warningThreshold.tokens")}</span>
						</div>
						<Switch
							checked={value.tokens !== -1}
							onCheckedChange={(checked: boolean) => handleSwitchChange("tokens", checked)}
							className="data-[state=checked]:bg-vscode-button-background"
						/>
					</div>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:providers.warningThreshold.tokensDescription")}
					</div>
				</div>

				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							<input
								type="number"
								pattern="-?[0-9]*"
								className="w-24 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border px-2.5 py-1.5 rounded text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-vscode-focusBorder"
								value={value.cost === -1 ? "" : (value.cost ?? 2)}
								min={-1}
								step={0.1}
								onChange={(e) => {
									const newValue = e.target.value === "" ? -1 : parseFloat(e.target.value)
									if (!isNaN(newValue)) {
										handleChange("cost", newValue === -1 ? -1 : Math.max(0.1, newValue))
									}
								}}
								onClick={(e) => e.currentTarget.select()}
								data-testid="cost-warning-threshold-input"
								placeholder="-1"
							/>
							<span>{t("settings:providers.warningThreshold.cost")}</span>
						</div>
						<Switch
							checked={value.cost !== -1}
							onCheckedChange={(checked: boolean) => handleSwitchChange("cost", checked)}
							className="data-[state=checked]:bg-vscode-button-background"
						/>
					</div>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:providers.warningThreshold.costDescription")}
					</div>
				</div>
			</div>
		</div>
	)
}
