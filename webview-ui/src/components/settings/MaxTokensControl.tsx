import React from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { ModelInfo } from "@roo-code/types"
import { Input } from "@/components/ui"

interface MaxTokensControlProps {
	value?: number
	onChange: (value: number | undefined) => void
	modelInfo?: ModelInfo
	minValue?: number
	maxValue?: number
	className?: string
}

export const MaxTokensControl: React.FC<MaxTokensControlProps> = ({
	value,
	onChange,
	modelInfo,
	minValue = 1000,
	maxValue = 200000,
	className,
}) => {
	const { t } = useAppTranslation()

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const inputValue = e.target.value
		if (inputValue === "") {
			onChange(undefined)
			return
		}

		const numValue = parseInt(inputValue, 10)
		if (!isNaN(numValue)) {
			onChange(numValue)
		}
	}

	const effectiveMaxValue = modelInfo?.maxTokens || maxValue
	const displayValue = value ?? 8192

	const isValueTooHigh = displayValue > effectiveMaxValue
	const isValueTooLow = displayValue < minValue
	const hasError = isValueTooHigh || isValueTooLow

	return (
		<div className={`flex flex-col gap-1 ${className || ""}`}>
			<label htmlFor="max-output-tokens" className="block font-medium mb-1">
				{t("settings:providers.maxOutputTokens.label")}
			</label>
			<Input
				id="max-output-tokens"
				type="number"
				value={displayValue}
				onChange={handleChange}
				min={minValue}
				max={effectiveMaxValue}
				className={`w-full ${hasError ? "border-red-500 focus:border-red-500" : ""}`}
			/>
			<div className="text-sm text-vscode-descriptionForeground">
				{t("settings:providers.maxOutputTokens.description")}
			</div>
			{isValueTooHigh && (
				<div className="text-sm text-red-500">
					{t("settings:providers.maxOutputTokens.validation.tooHigh", { max: effectiveMaxValue })}
				</div>
			)}
			{isValueTooLow && (
				<div className="text-sm text-red-500">
					{t("settings:providers.maxOutputTokens.validation.tooLow", { min: minValue })}
				</div>
			)}
			{modelInfo && !hasError && (
				<div className="text-sm text-vscode-descriptionForeground">
					{t("settings:providers.maxOutputTokens.modelSupports", { max: modelInfo.maxTokens })}
				</div>
			)}
		</div>
	)
}
