import { cn } from "../../utils/tailwind"

interface ToggleProps {
	id: string
	label: string
	description?: string
	checked: boolean
	onChange: (checked: boolean) => void
	disabled?: boolean
}

export const Toggle = ({ id, label, description, checked, onChange, disabled = false }: ToggleProps) => {
	return (
		<div className="flex flex-col mb-4">
			<div className="flex items-center justify-between">
				<div className="flex flex-col">
					<label htmlFor={id} className="font-semibold">
						{label}
					</label>
					{description && <p className="text-vscode-description-fg text-sm">{description}</p>}
				</div>
				<div className="relative inline-flex items-center">
					<input
						type="checkbox"
						id={id}
						checked={checked}
						onChange={(e) => onChange(e.target.checked)}
						disabled={disabled}
						className={cn("sr-only peer", disabled && "cursor-not-allowed opacity-50")}
					/>
					<div
						className={cn(
							"w-11 h-6 bg-vscode-panel-border rounded-full peer peer-checked:bg-vscode-button-bg peer-focus:ring-1 peer-focus:ring-vscode-focus-border",
							"after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all",
							"peer-checked:after:translate-x-full",
							disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
						)}></div>
				</div>
			</div>
		</div>
	)
}
