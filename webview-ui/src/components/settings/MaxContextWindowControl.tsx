import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { useEffect, useState } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useDebounce } from "react-use"

import { Slider } from "@/components/ui"

interface MaxContextWindowControlProps {
	value: number | undefined | null
	onChange: (value: number | undefined | null) => void
	maxValue?: number
}

export const MaxContextWindowControl = ({ value, onChange, maxValue = 1000000 }: MaxContextWindowControlProps) => {
	const { t } = useAppTranslation()
	const [isCustomMaxContextWindow, setIsCustomMaxContextWindow] = useState(value !== undefined)
	const [inputValue, setInputValue] = useState(value)

	useDebounce(() => onChange(inputValue), 50, [onChange, inputValue])

	// Sync internal state with prop changes when switching profiles.
	useEffect(() => {
		const hasCustomTemperature = value !== undefined && value !== null
		setIsCustomMaxContextWindow(hasCustomTemperature)
		setInputValue(value)
	}, [value])

	return (
		<>
			<div>
				<VSCodeCheckbox
					checked={isCustomMaxContextWindow}
					onChange={(e: any) => {
						const isChecked = e.target.checked
						setIsCustomMaxContextWindow(isChecked)

						if (!isChecked) {
							setInputValue(null) // Unset the temperature, note that undefined is unserializable.
						} else {
							setInputValue(value ?? 0) // Use the value from apiConfiguration, if set.
						}
					}}>
					<label className="block font-medium mb-1">{t("settings:maxContextWindow.useCustom")}</label>
				</VSCodeCheckbox>
				<div className="text-sm text-vscode-descriptionForeground mt-1">
					{t("settings:maxContextWindow.description")}
				</div>
			</div>

			{isCustomMaxContextWindow && (
				<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
					<div>
						<div className="flex items-center gap-2">
							<Slider
								min={200000}
								max={maxValue}
								step={1}
								value={[inputValue ?? 1048576]}
								onValueChange={([value]) => setInputValue(value)}
							/>
							<span className="w-10">{inputValue}</span>
						</div>
						<div className="text-vscode-descriptionForeground text-sm mt-1">
							{t("settings:maxContextWindow.rangeDescription")}
						</div>
					</div>
				</div>
			)}
		</>
	)
}
