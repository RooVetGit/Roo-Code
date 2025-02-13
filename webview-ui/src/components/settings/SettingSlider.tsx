import { memo } from "react"

interface SettingSliderProps {
	name: string
	description?: string
	value: number
	onChange: (value: number) => void
	min: number
	max: number
	step: number
	unit?: string
	style?: React.CSSProperties
}

const SettingSlider = ({
	name,
	description,
	value,
	onChange,
	min,
	max,
	step,
	unit = "",
	style,
}: SettingSliderProps) => {
	const sliderStyle = {
		flexGrow: 1,
		accentColor: "var(--vscode-button-background)",
		height: "2px",
	}

	const labelStyle = {
		minWidth: "45px",
		lineHeight: "20px",
		paddingBottom: "2px",
		paddingLeft: "5px",
	}

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: "5px",
				marginTop: 10,
				marginBottom: 15,
				paddingLeft: 10,
				borderLeft: "2px solid",
				borderColor: "var(--vscode-button-background)",
				...style,
			}}>
			<span style={{ fontWeight: "700" }}>{name}</span>
			<div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
				<input
					type="range"
					min={min}
					max={max}
					step={step}
					value={value}
					onChange={(e) => onChange(parseFloat(e.target.value))}
					style={sliderStyle}
					aria-label={name.toLowerCase()}
				/>
				<span style={labelStyle}>
					{value}
					{unit}
				</span>
			</div>
			{description && (
				<p
					style={{
						fontSize: "12px",
						marginTop: "5px",
						color: "var(--vscode-descriptionForeground)",
					}}>
					{description}
				</p>
			)}
		</div>
	)
}

export default memo(SettingSlider)
