import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { useEffect, useState } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useDebounce } from "react-use"

interface TopKControlProps {
	value: number | undefined | null
	onChange: (value: number | undefined | null) => void
}

export const TopKControl = ({ value, onChange }: TopKControlProps) => {
	const { t } = useAppTranslation()
	const [isCustomTopK, setIsCustomTopK] = useState(value !== undefined)
	const [inputValue, setInputValue] = useState(value)
	useDebounce(() => onChange(inputValue), 50, [onChange, inputValue])

	// Sync internal state with prop changes when switching profiles
	useEffect(() => {
		const hasCustomTopK = value !== undefined && value !== null
		setIsCustomTopK(hasCustomTopK)
		setInputValue(value)
	}, [value])

	return (
		<>
			<div>
				<VSCodeCheckbox
					checked={isCustomTopK}
					onChange={(e: any) => {
						const isChecked = e.target.checked
						setIsCustomTopK(isChecked)
						if (!isChecked) {
							setInputValue(null) // Unset the top_k, note that undefined is unserializable
						} else {
							setInputValue(value ?? 40) // Use the value from apiConfiguration, if set, or default to 40
						}
					}}>
					<span className="font-medium">{t("settings:topK.useCustom")}</span>
				</VSCodeCheckbox>
				<div className="text-sm text-vscode-descriptionForeground">{t("settings:topK.description")}</div>
			</div>

			{isCustomTopK && (
				<div
					style={{
						marginLeft: 0,
						paddingLeft: 10,
						borderLeft: "2px solid var(--vscode-button-background)",
					}}>
					<div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
						<input
							type="range"
							min="1"
							max="100"
							step="1"
							value={inputValue ?? 40}
							className="h-2 focus:outline-0 w-4/5 accent-vscode-button-background"
							onChange={(e) => setInputValue(parseInt(e.target.value))}
						/>
						<span>{inputValue}</span>
					</div>
					<p className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:topK.rangeDescription")}
					</p>
				</div>
			)}
		</>
	)
}
