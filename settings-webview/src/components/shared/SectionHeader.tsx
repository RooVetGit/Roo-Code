import { makeStyles, Title3, Text, tokens } from "@fluentui/react-components"
import { ReactNode } from "react"

const useStyles = makeStyles({
	header: {
		position: "sticky",
		top: 0,
		zIndex: 10,
		backgroundColor: tokens.colorNeutralBackground1,
		marginBottom: "8px",
	},
	title: {
		margin: 0,
		color: tokens.colorNeutralForeground1,
	},
	description: {
		color: tokens.colorNeutralForeground2,
		fontSize: tokens.fontSizeBase200,
		marginTop: "4px",
		marginBottom: 0,
	},
})

interface SectionHeaderProps {
	children: ReactNode
	description?: string
	className?: string
}

export const SectionHeader = ({ children, description, className }: SectionHeaderProps) => {
	const styles = useStyles()

	return (
		<div className={`${styles.header} ${className || ""}`}>
			<Title3 as="h4" className={styles.title}>
				{children}
			</Title3>
			{description && <Text className={styles.description}>{description}</Text>}
		</div>
	)
}
