import { makeStyles, SpinButton, Label, Text, tokens } from "@fluentui/react-components"

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
	const styles = useStyles()

	return (
		<div className={styles.container}>
			<Label htmlFor={id} className={styles.label}>
				{label}
			</Label>
			{description && <Text className={styles.description}>{description}</Text>}
			<SpinButton
				id={id}
				value={value}
				onChange={(_e, data) => {
					const newValue = Number(data.value)
					if (!isNaN(newValue)) {
						onChange(newValue)
					}
				}}
				min={min}
				max={max}
				step={step}
				disabled={disabled}
			/>
		</div>
	)
}
