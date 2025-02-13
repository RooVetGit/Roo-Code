import { Dropdown } from "vscrui"
import type { DropdownOption } from "vscrui"

interface SettingComboProps {
	id?: string
	name: string
	description?: string
	value?: string
	onChange: (value: string) => void
	options: DropdownOption[]
	children?: React.ReactNode
	inline?: boolean
}

const SettingCombo = ({ id, name, description, value, onChange, options, children, inline }: SettingComboProps) => {
	const defaultValue = options.length > 0 ? options[0].value : undefined
	return (
		<div
			style={{
				marginBottom: 15,
				marginTop: 10,
				paddingLeft: 10,
				borderLeft: "2px solid",
				borderColor: "var(--vscode-button-background)",
			}}>
			<div style={{ display: inline ? "flex" : "block", alignItems: "end" }}>
				<label style={{ fontWeight: "700", display: "block", marginBottom: 5, paddingRight: 10 }}>{name}</label>
				<div className="dropdown-container">
					<Dropdown
						id={id}
						value={value ?? defaultValue}
						onChange={(value: unknown) => {
							onChange((value as DropdownOption).value)
						}}
						style={{ width: "100%" }}
						options={options}
					/>
				</div>
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
			{children}
		</div>
	)
}

export default SettingCombo
