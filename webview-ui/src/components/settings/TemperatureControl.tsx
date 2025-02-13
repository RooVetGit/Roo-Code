import { useEffect, useState } from "react"
import SettingCheckbox from "./SettingCheckbox"

interface TemperatureControlProps {
	value: number | undefined
	onChange: (value: number | undefined) => void
	maxValue?: number // Some providers like OpenAI use 0-2 range
}

export const TemperatureControl = ({ value, onChange, maxValue = 1 }: TemperatureControlProps) => {
	const [isCustomTemperature, setIsCustomTemperature] = useState(value !== undefined)
	const [inputValue, setInputValue] = useState(value?.toString() ?? "0")

	// Sync internal state with prop changes when switching profiles
	useEffect(() => {
		const hasCustomTemperature = value !== undefined
		setIsCustomTemperature(hasCustomTemperature)
		setInputValue(value?.toString() ?? "0")
	}, [value])

	return (
		<SettingCheckbox
			name="Use custom temperature"
			description="Controls randomness in the model's responses."
			checked={isCustomTemperature}
			onChange={(isChecked) => {
				setIsCustomTemperature(isChecked)
				if (!isChecked) {
					onChange(undefined) // Unset the temperature
				} else if (value !== undefined) {
					onChange(value) // Use the value from apiConfiguration, if set
				}
			}}>
			<div
				style={{
					marginTop: 5,
					marginBottom: 10,
					paddingLeft: 10,
					borderLeft: "2px solid var(--vscode-button-background)",
				}}>
				<div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
					<input
						aria-label="Temperature control text input"
						type="text"
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
						onBlur={(e) => {
							const newValue = parseFloat(e.target.value)
							if (!isNaN(newValue) && newValue >= 0 && newValue <= maxValue) {
								onChange(newValue)
								setInputValue(newValue.toString())
							} else {
								setInputValue(value?.toString() ?? "0") // Reset to last valid value
							}
						}}
						style={{
							width: "60px",
							padding: "4px 8px",
							border: "1px solid var(--vscode-input-border)",
							background: "var(--vscode-input-background)",
							color: "var(--vscode-input-foreground)",
						}}
					/>
				</div>
				<p style={{ fontSize: "12px", marginTop: "8px", color: "var(--vscode-descriptionForeground)" }}>
					Higher values make output more random, lower values make it more deterministic.
				</p>
			</div>
		</SettingCheckbox>
	)
}
