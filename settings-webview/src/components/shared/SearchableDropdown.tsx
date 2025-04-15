import { useState, useEffect, useRef } from "react"
import { cn } from "../../utils/tailwind"

export interface SearchableDropdownOption {
	key: string
	text: string
}

interface SearchableDropdownProps {
	id: string
	label: string
	description?: string
	options: SearchableDropdownOption[]
	selectedKey: string
	onChange: (key: string) => void
	placeholder?: string
	disabled?: boolean
}

export const SearchableDropdown = ({
	id,
	label,
	description,
	options,
	selectedKey,
	onChange,
	placeholder = "Search...",
	disabled = false,
}: SearchableDropdownProps) => {
	const [searchText, setSearchText] = useState("")
	const [filteredOptions, setFilteredOptions] = useState(options)
	const [isOpen, setIsOpen] = useState(false)
	const dropdownRef = useRef<HTMLDivElement>(null)

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsOpen(false)
			}
		}

		document.addEventListener("mousedown", handleClickOutside)
		return () => {
			document.removeEventListener("mousedown", handleClickOutside)
		}
	}, [])

	// Filter options when search text changes
	useEffect(() => {
		if (searchText) {
			const filtered = options.filter((option) => option.text.toLowerCase().includes(searchText.toLowerCase()))
			setFilteredOptions(filtered)
		} else {
			setFilteredOptions(options)
		}
	}, [searchText, options])

	// Get the selected option text
	const selectedOption = options.find((option) => option.key === selectedKey)
	const selectedText = selectedOption ? selectedOption.text : placeholder

	return (
		<div className="flex flex-col mb-4 relative" ref={dropdownRef}>
			<label htmlFor={id} className="font-semibold mb-1">
				{label}
			</label>
			{description && <p className="text-vscode-description-fg text-sm mb-2">{description}</p>}

			<button
				type="button"
				className={cn(
					"flex items-center justify-between w-full px-3 py-2 text-left bg-vscode-dropdown-bg text-vscode-dropdown-fg border border-vscode-dropdown-border rounded",
					"focus:outline-none focus:ring-1 focus:ring-vscode-focus-border",
					disabled && "opacity-50 cursor-not-allowed",
				)}
				onClick={() => !disabled && setIsOpen(!isOpen)}
				disabled={disabled}>
				<span className="truncate">{selectedText}</span>
				<span className="ml-2">▼</span>
			</button>

			{isOpen && (
				<div className="absolute z-20 w-full mt-1 bg-vscode-dropdown-bg border border-vscode-dropdown-border rounded shadow-lg">
					<div className="p-2">
						<div className="relative mb-2">
							<span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-vscode-description-fg">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round">
									<circle cx="11" cy="11" r="8"></circle>
									<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
								</svg>
							</span>
							<input
								type="text"
								className="w-full pl-10 pr-3 py-2 bg-vscode-input-bg text-vscode-input-fg border border-vscode-input-border rounded"
								value={searchText}
								onChange={(e) => setSearchText(e.target.value)}
								placeholder={placeholder}
								disabled={disabled}
							/>
						</div>

						<ul className="max-h-60 overflow-auto">
							{filteredOptions.length > 0 ? (
								filteredOptions.map((option) => (
									<li
										key={option.key}
										className={cn(
											"px-3 py-2 cursor-pointer hover:bg-vscode-button-hover-bg",
											option.key === selectedKey && "bg-vscode-button-bg text-vscode-button-fg",
										)}
										onClick={() => {
											onChange(option.key)
											setIsOpen(false)
											setSearchText("")
										}}>
										{option.text}
									</li>
								))
							) : (
								<li className="px-3 py-2 text-vscode-description-fg">No results found</li>
							)}
						</ul>
					</div>
				</div>
			)}
		</div>
	)
}
