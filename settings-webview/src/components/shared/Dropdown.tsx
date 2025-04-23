import { useState } from "react"
import { cn } from "../../utils/tailwind"

export interface DropdownOption {
	key: string
	text: string
}

interface DropdownProps {
	id: string
	label: string
	description?: string
	options: DropdownOption[]
	selectedKey: string
	onChange: (key: string) => void
	placeholder?: string
	disabled?: boolean
}

export const Dropdown = ({
	id,
	label,
	description,
	options,
	selectedKey,
	onChange,
	placeholder,
	disabled = false,
}: DropdownProps) => {
	const [isOpen, setIsOpen] = useState(false)
	const selectedOption = options.find((option) => option.key === selectedKey)

	return (
		<div className="flex flex-col mb-4">
			<label htmlFor={id} className="font-semibold mb-1">
				{label}
			</label>
			{description && <p className="text-vscode-description-fg text-sm mb-2">{description}</p>}
			<div className="relative">
				<button
					id={id}
					type="button"
					onClick={() => !disabled && setIsOpen(!isOpen)}
					className={cn(
						"flex items-center justify-between w-full px-3 py-2 text-left bg-vscode-dropdown-bg text-vscode-dropdown-fg border border-vscode-dropdown-border rounded",
						"focus:outline-none focus:ring-1 focus:ring-vscode-focus-border",
						disabled && "opacity-50 cursor-not-allowed",
					)}
					aria-haspopup="listbox"
					aria-expanded={isOpen}
					disabled={disabled}>
					<span>{selectedOption ? selectedOption.text : placeholder}</span>
					<span className="ml-2">▼</span>
				</button>

				{isOpen && (
					<ul
						className="absolute z-10 w-full mt-1 max-h-60 overflow-auto bg-vscode-dropdown-bg border border-vscode-dropdown-border rounded shadow-lg"
						role="listbox">
						{options.map((option) => (
							<li
								key={option.key}
								className={cn(
									"px-3 py-2 cursor-pointer hover:bg-vscode-button-hover-bg",
									option.key === selectedKey && "bg-vscode-button-bg text-vscode-button-fg",
								)}
								onClick={() => {
									onChange(option.key)
									setIsOpen(false)
								}}
								role="option"
								aria-selected={option.key === selectedKey}>
								{option.text}
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	)
}
