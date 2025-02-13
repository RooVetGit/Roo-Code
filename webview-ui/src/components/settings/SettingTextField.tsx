import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

interface SettingTextFieldProps {
	name: string
	description: React.ReactNode
	value?: string
	placeholder?: string
	type?: "text" | "password" | "url" // Limited to types actually used in ApiOptions.tsx
	onBlur: (value: string) => void
	children?: React.ReactNode
}

const SettingTextField = ({
	name,
	description,
	value,
	placeholder,
	type = "text",
	onBlur,
	children,
}: SettingTextFieldProps) => {
	return (
		<div
			style={{
				marginTop: 10,
				marginBottom: 15,
				paddingLeft: 10,
				borderLeft: "2px solid",
				borderColor: "var(--vscode-button-background)",
			}}>
			<VSCodeTextField
				value={value || ""}
				style={{ width: "100%" }}
				type={type}
				onBlur={(e: any) => onBlur(e.target.value)}
				placeholder={placeholder}>
				<span style={{ fontWeight: "700" }}>{name}</span>
			</VSCodeTextField>
			<p style={{ fontSize: "12px", marginTop: "5px", color: "var(--vscode-descriptionForeground)" }}>
				{description}
			</p>
			{children}
		</div>
	)
}

export default SettingTextField
