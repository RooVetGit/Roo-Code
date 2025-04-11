import { makeStyles, Input, Label, Text, tokens } from "@fluentui/react-components"

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
	const styles = useStyles()

	return (
		<div className={styles.container}>
			<Label htmlFor={id} className={styles.label}>
				{label}
			</Label>
			{description && <Text className={styles.description}>{description}</Text>}
			<Input
				id={id}
				value={value}
				onChange={(_e, data) => onChange(data.value)}
				placeholder={placeholder}
				disabled={disabled}
				type={type}
			/>
		</div>
	)
}
