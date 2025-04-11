import { makeStyles, tokens, shorthands } from "@fluentui/react-components"
import { ReactNode } from "react"

const useStyles = makeStyles({
	card: {
		backgroundColor: tokens.colorNeutralBackground1,
		...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
		...shorthands.borderRadius("4px"),
		...shorthands.padding("16px"),
		marginBottom: "16px",
	},
	header: {
		fontWeight: tokens.fontWeightSemibold,
		fontSize: tokens.fontSizeBase500,
		marginTop: 0,
		marginBottom: "12px",
		color: tokens.colorNeutralForeground1,
	},
})

interface CardProps {
	title?: string
	children: ReactNode
	className?: string
}

export const Card = ({ title, children, className }: CardProps) => {
	const styles = useStyles()

	return (
		<div className={`${styles.card} ${className || ""}`}>
			{title && <h3 className={styles.header}>{title}</h3>}
			{children}
		</div>
	)
}
