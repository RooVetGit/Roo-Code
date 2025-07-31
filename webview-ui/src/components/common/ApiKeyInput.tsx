import { useState } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

type ApiKeyInputProps = {
	value: string
	onInput: (event: Event | React.FormEvent<HTMLElement>) => void
	placeholder: string
	label: string
	className?: string
	name?: string
	children?: React.ReactNode
}

export const ApiKeyInput = ({ value, onInput, placeholder, label, className, name, children }: ApiKeyInputProps) => {
	const [showApiKey, setShowApiKey] = useState(false)

	return (
		<div className={`relative w-full ${className || ""}`}>
			<VSCodeTextField
				name={name}
				value={value}
				type={showApiKey ? "text" : "password"}
				onInput={onInput}
				placeholder={placeholder}
				className="w-full pr-10">
				<label className="block font-medium mb-1">{label}</label>
				{children}
			</VSCodeTextField>
			<div
				className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer"
				style={{ top: "1.5rem" }}
				onClick={() => setShowApiKey(!showApiKey)}>
				{showApiKey ? (
					<span className="codicon codicon-eye"></span>
				) : (
					<span className="codicon codicon-eye-closed"></span>
				)}
			</div>
		</div>
	)
}
