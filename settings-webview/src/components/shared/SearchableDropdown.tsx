import { useState, useEffect } from "react"
import {
	makeStyles,
	Label,
	Text,
	tokens,
	Input,
	MenuList,
	MenuItem,
	Popover,
	PopoverTrigger,
	PopoverSurface,
} from "@fluentui/react-components"
import { Search24Regular, ChevronDown24Regular } from "@fluentui/react-icons"

const useStyles = makeStyles({
	container: {
		display: "flex",
		flexDirection: "column",
		marginBottom: "16px",
		position: "relative",
	},
	label: {
		fontWeight: tokens.fontWeightSemibold,
		color: tokens.colorNeutralForeground1,
		marginBottom: "4px",
	},
	description: {
		color: tokens.colorNeutralForeground2,
		fontSize: tokens.fontSizeBase200,
		marginBottom: "8px",
	},
	inputContainer: {
		display: "flex",
		position: "relative",
	},
	searchIcon: {
		position: "absolute",
		left: "8px",
		top: "50%",
		transform: "translateY(-50%)",
		color: tokens.colorNeutralForeground3,
	},
	input: {
		paddingLeft: "32px",
	},
	dropdownButton: {
		marginLeft: "8px",
	},
	menuItem: {
		cursor: "pointer",
	},
	selectedValue: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		padding: "5px 12px",
		border: `1px solid ${tokens.colorNeutralStroke1}`,
		borderRadius: tokens.borderRadiusMedium,
		backgroundColor: tokens.colorNeutralBackground1,
		cursor: "pointer",
		"&:hover": {
			backgroundColor: tokens.colorNeutralBackground1Hover,
		},
	},
	selectedText: {
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	},
})

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
	const styles = useStyles()
	const [searchText, setSearchText] = useState("")
	const [filteredOptions, setFilteredOptions] = useState(options)
	const [isOpen, setIsOpen] = useState(false)

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
		<div className={styles.container}>
			<Label htmlFor={id} className={styles.label}>
				{label}
			</Label>
			{description && <Text className={styles.description}>{description}</Text>}

			<Popover open={isOpen} onOpenChange={(_e, data) => setIsOpen(data.open)}>
				<PopoverTrigger disableButtonEnhancement>
					<div className={styles.selectedValue} onClick={() => !disabled && setIsOpen(true)}>
						<Text className={styles.selectedText}>{selectedText}</Text>
						<ChevronDown24Regular />
					</div>
				</PopoverTrigger>

				<PopoverSurface>
					<div style={{ padding: "8px", minWidth: "250px" }}>
						<div className={styles.inputContainer}>
							<Search24Regular className={styles.searchIcon} />
							<Input
								className={styles.input}
								value={searchText}
								onChange={(_e, data) => setSearchText(data.value)}
								placeholder={placeholder}
								disabled={disabled}
							/>
						</div>

						<MenuList>
							{filteredOptions.length > 0 ? (
								filteredOptions.map((option) => (
									<MenuItem
										key={option.key}
										onClick={() => {
											onChange(option.key)
											setIsOpen(false)
											setSearchText("")
										}}
										className={styles.menuItem}>
										{option.text}
									</MenuItem>
								))
							) : (
								<MenuItem disabled>No results found</MenuItem>
							)}
						</MenuList>
					</div>
				</PopoverSurface>
			</Popover>
		</div>
	)
}
