import { makeStyles, Dropdown as FluentDropdown, Option, Label, Text, tokens } from "@fluentui/react-components"

const useStyles = makeStyles({
	container: {
		display: "flex",
		flexDirection: "column",
		marginBottom: "16px",
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
})

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
	const styles = useStyles()

	return (
		<div className={styles.container}>
			<Label htmlFor={id} className={styles.label}>
				{label}
			</Label>
			{description && <Text className={styles.description}>{description}</Text>}
			<FluentDropdown
				id={id}
				selectedOptions={[selectedKey]}
				onOptionSelect={(_e, data) => onChange(data.selectedOptions[0])}
				placeholder={placeholder}
				disabled={disabled}>
				{options.map((option) => (
					<Option key={option.key} value={option.key}>
						{option.text}
					</Option>
				))}
			</FluentDropdown>
		</div>
	)
}
