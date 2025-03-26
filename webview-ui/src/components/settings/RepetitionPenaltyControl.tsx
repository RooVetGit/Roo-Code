import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { useEffect, useState } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useDebounce } from "react-use"

interface RepetitionPenaltyControlProps {
	value: number | undefined | null
	onChange: (value: number | undefined | null) => void
}

export const RepetitionPenaltyControl = ({ value, onChange }: RepetitionPenaltyControlProps) => {
	const { t } = useAppTranslation()
	const [isCustomRepetitionPenalty, setIsCustomRepetitionPenalty] = useState(value !== undefined)
	const [inputValue, setInputValue] = useState(value)
	useDebounce(() => onChange(inputValue), 50, [onChange, inputValue])

	// Sync internal state with prop changes when switching profiles
	useEffect(() => {
		const hasCustomRepetitionPenalty = value !== undefined && value !== null
		setIsCustomRepetitionPenalty(hasCustomRepetitionPenalty)
		setInputValue(value)
	}, [value])

	return (
		<>
			<div>
				<VSCodeCheckbox
					checked={isCustomRepetitionPenalty}
					onChange={(e: any) => {
						const isChecked = e.target.checked
						setIsCustomRepetitionPenalty(isChecked)
						if (!isChecked) {
							setInputValue(null) // Unset the repetition_penalty, note that undefined is unserializable
						} else {
							setInputValue(value ?? 1.0) // Use the value from apiConfiguration, if set, or default to 1.0
						}
					}}>
					<span className="font-medium">{t("settings:repetitionPenalty.useCustom")}</span>
				</VSCodeCheckbox>
				<div className="text-sm text-vscode-descriptionForeground">
					{t("settings:repetitionPenalty.description")}
				</div>
			</div>

			{isCustomRepetitionPenalty && (
				<div
					style={{
						marginLeft: 0,
						paddingLeft: 10,
						borderLeft: "2px solid var(--vscode-button-background)",
					}}>
					<div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
						<input
							type="range"
							min="1.0"
							max="2.0"
							step="0.01"
							value={inputValue ?? 1.0}
							className="h-2 focus:outline-0 w-4/5 accent-vscode-button-background"
							onChange={(e) => setInputValue(parseFloat(e.target.value))}
						/>
						<span>{inputValue}</span>
					</div>
					<p className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:repetitionPenalty.rangeDescription")}
					</p>
				</div>
			)}
		</>
	)
}
