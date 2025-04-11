import { useState } from "react"
import { makeStyles, shorthands } from "@fluentui/react-components"
import { Section, SectionHeader, Card, Toggle } from "../shared"

const useStyles = makeStyles({
	root: {
		display: "flex",
		flexDirection: "column",
		...shorthands.gap("16px"),
	},
})

const PermissionsSettings = () => {
	const styles = useStyles()

	// State for form values
	const [approveRead, setApproveRead] = useState(true)
	const [approveWrite, setApproveWrite] = useState(false)
	const [approveExecute, setApproveExecute] = useState(false)
	const [approveBrowser, setApproveBrowser] = useState(true)
	const [approveMCP, setApproveMCP] = useState(false)
	const [approveMode, setApproveMode] = useState(true)
	const [approveSubtask, setApproveSubtask] = useState(true)

	return (
		<div className={styles.root}>
			<Section>
				<SectionHeader description="Configure which operations are automatically approved">
					Auto Approve Settings
				</SectionHeader>

				<Card title="File Operations">
					<Toggle
						id="approve-read"
						label="Read Operations"
						description="Automatically approve file read operations"
						checked={approveRead}
						onChange={setApproveRead}
					/>

					<Toggle
						id="approve-write"
						label="Write Operations"
						description="Automatically approve file write operations"
						checked={approveWrite}
						onChange={setApproveWrite}
					/>
				</Card>

				<Card title="System Operations">
					<Toggle
						id="approve-execute"
						label="Execute Operations"
						description="Automatically approve command execution"
						checked={approveExecute}
						onChange={setApproveExecute}
					/>

					<Toggle
						id="approve-browser"
						label="Browser Operations"
						description="Automatically approve browser operations"
						checked={approveBrowser}
						onChange={setApproveBrowser}
					/>
				</Card>

				<Card title="Other Operations">
					<Toggle
						id="approve-mcp"
						label="MCP Operations"
						description="Automatically approve MCP operations"
						checked={approveMCP}
						onChange={setApproveMCP}
					/>

					<Toggle
						id="approve-mode"
						label="Mode Switch Operations"
						description="Automatically approve mode switching"
						checked={approveMode}
						onChange={setApproveMode}
					/>

					<Toggle
						id="approve-subtask"
						label="Subtask Operations"
						description="Automatically approve subtask operations"
						checked={approveSubtask}
						onChange={setApproveSubtask}
					/>
				</Card>
			</Section>
		</div>
	)
}

export default PermissionsSettings
