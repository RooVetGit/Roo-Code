import { formatRelative } from "date-fns"
import { McpErrorEntry } from "../../../../src/shared/mcp"

type McpErrorRowProps = {
	error: McpErrorEntry
}

const McpErrorRow = ({ error }: McpErrorRowProps) => {
	const getErrorColor = (level: string) => {
		switch (level) {
			case "error":
				return "var(--vscode-testing-iconFailed)"
			case "warn":
				return "var(--vscode-charts-yellow)"
			case "info":
				return "var(--vscode-testing-iconPassed)"
			default:
				return "var(--vscode-testing-iconFailed)"
		}
	}

	return (
		<div
			style={{
				padding: "8px",
				borderLeft: `3px solid ${getErrorColor(error.level)}`,
				background: "var(--vscode-textCodeBlock-background)",
				borderRadius: "4px",
				fontSize: "13px",
			}}>
			<div style={{ marginBottom: "4px", color: getErrorColor(error.level) }}>{error.message}</div>
			<div
				style={{
					fontSize: "11px",
					color: "var(--vscode-descriptionForeground)",
				}}>
				{formatRelative(error.timestamp, new Date())}
			</div>
		</div>
	)
}

export default McpErrorRow
