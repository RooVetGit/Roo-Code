import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { useEffect, useState } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useDebounce } from "react-use"

interface MinPControlProps {
	value: number | undefined | null
	onChange: (value: number | undefined | null) => void
}

export const MinPControl = ({ value, onChange }: MinPControlProps) => {
	const { t } = useAppTranslation()
	const [isCustomMinP, setIsCustomMinP] = useState(value !== undefined)
	const [inputValue, setInputValue] = useState(value)
	useDebounce(() => onChange(inputValue), 50, [onChange, inputValue])

	// Sync internal state with prop changes when switching profiles
	useEffect(() => {
		const hasCustomMinP = value !== undefined && value !== null
		setIsCustomMinP(hasCustomMinP)
		setInputValue(value)
	}, [value])

	return (
		<>
			<div>
				<VSCodeCheckbox
					checked={isCustomMinP}
					onChange={(e: any) => {
						const isChecked = e.target.checked
						setIsCustomMinP(isChecked)
						if (!isChecked) {
							setInputValue(null) // Unset the min_p, note that undefined is unserializable
						} else {
							setInputValue(value ?? 0) // Use the value from apiConfiguration, if set
						}
					}}>
					<span className="font-medium">{t("settings:minP.useCustom")}</span>
				</VSCodeCheckbox>
				<div className="text-sm text-vscode-descriptionForeground">{t("settings:minP.description")}</div>
			</div>

			{isCustomMinP && (
				<div
					style={{
						marginLeft: 0,
						paddingLeft: 10,
						borderLeft: "2px solid var(--vscode-button-background)",
					}}>
					<div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
						<input
							type="range"
							min="0"
							max="1"
							step="0.01"
							value={inputValue ?? 0}
							className="h-2 focus:outline-0 w-4/5 accent-vscode-button-background"
							onChange={(e) => setInputValue(parseFloat(e.target.value))}
						/>
						<span>{inputValue}</span>
					</div>
					<p className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:minP.rangeDescription")}
					</p>
				</div>
			)}
		</>
	)
}
