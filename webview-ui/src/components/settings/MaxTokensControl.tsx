import React, { useState, useEffect } from "react"
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
	maxValue,
	className,
}) => {
	const { t } = useAppTranslation()

	// Track the input value separately to allow empty state
	const [inputValue, setInputValue] = useState<string>(() => {
		if (value !== undefined) {
			return value.toString()
		}
		return ""
	})

	// Update input value when prop changes
	useEffect(() => {
		if (value !== undefined) {
			setInputValue(value.toString())
		}
	}, [value])

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.value
		setInputValue(newValue)

		// Still update the parent immediately for live validation feedback
		if (newValue === "") {
			onChange(undefined)
		} else {
			const numValue = parseInt(newValue, 10)
			if (!isNaN(numValue)) {
				onChange(numValue)
			}
		}
	}

	const handleBlur = () => {
		// Apply default value only on blur if field is empty
		if (inputValue === "") {
			const defaultValue = modelInfo?.maxTokens ?? 8192
			setInputValue(defaultValue.toString())
			onChange(defaultValue)
		}
	}

	const effectiveMaxValue = modelInfo?.maxTokens || maxValue || 100000

	// For validation, use the actual value or 0 if empty (to show error)
	const validationValue = inputValue === "" ? 0 : parseInt(inputValue, 10) || 0
	const isValueTooHigh = validationValue > effectiveMaxValue
	const isValueTooLow = validationValue < minValue && inputValue !== ""
	const hasError = isValueTooHigh || isValueTooLow

	return (
		<div className={`flex flex-col gap-1 ${className || ""}`}>
			<label htmlFor="max-output-tokens" className="block font-medium mb-1">
				{t("settings:providers.maxOutputTokens.label")}
			</label>
			<Input
				id="max-output-tokens"
				type="number"
				value={inputValue}
				onChange={handleChange}
				onBlur={handleBlur}
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
			{modelInfo && !hasError && inputValue !== "" && (
				<div className="text-sm text-vscode-descriptionForeground">
					{t("settings:providers.maxOutputTokens.modelSupports", { max: modelInfo.maxTokens })}
				</div>
			)}
		</div>
	)
}
