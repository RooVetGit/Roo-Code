import { cn } from "../../utils/tailwind"

interface NumberInputProps {
	id: string
	label: string
	description?: string
	value: number
	onChange: (value: number) => void
	min?: number
	max?: number
	step?: number
	disabled?: boolean
}

export const NumberInput = ({
	id,
	label,
	description,
	value,
	onChange,
	min,
	max,
	step = 1,
	disabled = false,
}: NumberInputProps) => {
	return (
		<div className="flex flex-col mb-4">
			<label htmlFor={id} className="font-semibold mb-1">
				{label}
			</label>
			{description && <p className="text-vscode-description-fg text-sm mb-2">{description}</p>}
			<div className="flex">
				<input
					id={id}
					type="number"
					value={value}
					onChange={(e) => {
						const newValue = Number(e.target.value)
						if (!isNaN(newValue)) {
							onChange(newValue)
						}
					}}
					min={min}
					max={max}
					step={step}
					disabled={disabled}
					className={cn(
						"w-full px-3 py-2 bg-vscode-input-bg text-vscode-input-fg border border-vscode-input-border rounded",
						"focus:outline-none focus:ring-1 focus:ring-vscode-focus-border",
						disabled && "opacity-50 cursor-not-allowed",
					)}
				/>
				<div className="flex flex-col ml-1">
					<button
						type="button"
						onClick={() => onChange(value + step)}
						disabled={disabled || (max !== undefined && value >= max)}
						className={cn(
							"flex items-center justify-center w-6 h-6 bg-vscode-button-bg text-vscode-button-fg rounded-t",
							"hover:bg-vscode-button-hover-bg focus:outline-none focus:ring-1 focus:ring-vscode-focus-border",
							disabled && "opacity-50 cursor-not-allowed",
						)}>
						<span className="text-xs">▲</span>
					</button>
					<button
						type="button"
						onClick={() => onChange(value - step)}
						disabled={disabled || (min !== undefined && value <= min)}
						className={cn(
							"flex items-center justify-center w-6 h-6 bg-vscode-button-bg text-vscode-button-fg rounded-b",
							"hover:bg-vscode-button-hover-bg focus:outline-none focus:ring-1 focus:ring-vscode-focus-border",
							disabled && "opacity-50 cursor-not-allowed",
						)}>
						<span className="text-xs">▼</span>
					</button>
				</div>
			</div>
		</div>
	)
}
