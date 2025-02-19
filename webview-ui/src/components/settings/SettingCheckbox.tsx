import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"

interface SettingCheckboxProps {
	name: string
	description: React.ReactNode
	checked?: boolean
	onChange: (value: boolean) => void
	experimental?: boolean
	children?: React.ReactNode
}

const SettingCheckbox = ({
	name,
	description,
	checked: enabled,
	onChange,
	experimental,
	children,
}: SettingCheckboxProps) => {
	return (
		<div
			style={{
				marginTop: 10,
				marginBottom: 15,
				paddingLeft: 10,
				borderLeft: "2px solid",
				borderColor: experimental ? "var(--vscode-errorForeground)" : "var(--vscode-button-background)",
			}}>
			<div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
				{experimental && <span style={{ color: "var(--vscode-errorForeground)" }}>⚠️</span>}
				<VSCodeCheckbox checked={enabled} onChange={(e: any) => onChange(e.target.checked)}>
					<span style={{ fontWeight: "700" }}>{name}</span>
				</VSCodeCheckbox>
			</div>
			<p style={{ fontSize: "12px", marginTop: "5px", color: "var(--vscode-descriptionForeground)" }}>
				{description}
			</p>
			{enabled && children}
		</div>
	)
}

export default SettingCheckbox
