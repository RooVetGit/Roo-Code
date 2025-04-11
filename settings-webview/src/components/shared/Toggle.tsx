import { makeStyles, Switch, Label, Text, tokens } from "@fluentui/react-components"

const useStyles = makeStyles({
	container: {
		display: "flex",
		flexDirection: "column",
		marginBottom: "16px",
	},
	toggleRow: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
	},
	labelContainer: {
		display: "flex",
		flexDirection: "column",
	},
	label: {
		fontWeight: tokens.fontWeightSemibold,
		color: tokens.colorNeutralForeground1,
	},
	description: {
		color: tokens.colorNeutralForeground2,
		fontSize: tokens.fontSizeBase200,
	},
})

interface ToggleProps {
	id: string
	label: string
	description?: string
	checked: boolean
	onChange: (checked: boolean) => void
	disabled?: boolean
}

export const Toggle = ({ id, label, description, checked, onChange, disabled = false }: ToggleProps) => {
	const styles = useStyles()

	return (
		<div className={styles.container}>
			<div className={styles.toggleRow}>
				<div className={styles.labelContainer}>
					<Label htmlFor={id} className={styles.label}>
						{label}
					</Label>
					{description && <Text className={styles.description}>{description}</Text>}
				</div>
				<Switch id={id} checked={checked} onChange={(_e, data) => onChange(data.checked)} disabled={disabled} />
			</div>
		</div>
	)
}
