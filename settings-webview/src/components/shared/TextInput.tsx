import { cn } from "../../utils/tailwind"

interface TextInputProps {
	id: string
	label: string
	description?: string
	value: string
	onChange: (value: string) => void
	placeholder?: string
	disabled?: boolean
	type?: "text" | "password" | "number" | "email"
}

export const TextInput = ({
	id,
	label,
	description,
	value,
	onChange,
	placeholder,
	disabled = false,
	type = "text",
}: TextInputProps) => {
	return (
		<div className="flex flex-col mb-4">
			<label htmlFor={id} className="font-semibold mb-1">
				{label}
			</label>
			{description && <p className="text-vscode-description-fg text-sm mb-2">{description}</p>}
			<input
				id={id}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				disabled={disabled}
				type={type}
				className={cn(
					"w-full px-3 py-2 bg-vscode-input-bg text-vscode-input-fg border border-vscode-input-border rounded",
					"focus:outline-none focus:ring-1 focus:ring-vscode-focus-border",
					disabled && "opacity-50 cursor-not-allowed",
				)}
			/>
		</div>
	)
}
