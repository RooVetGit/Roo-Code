import { makeStyles, shorthands, tokens } from "@fluentui/react-components"
import { ReactNode } from "react"

const useStyles = makeStyles({
	section: {
		display: "flex",
		flexDirection: "column",
		...shorthands.gap("16px"),
		...shorthands.padding("16px"),
		backgroundColor: tokens.colorNeutralBackground1,
		...shorthands.borderRadius("4px"),
		...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
		marginBottom: "24px",
	},
})

interface SectionProps {
	children: ReactNode
	className?: string
}

export const Section = ({ children, className }: SectionProps) => {
	const styles = useStyles()

	return <div className={`${styles.section} ${className || ""}`}>{children}</div>
}
