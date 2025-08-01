import React from "react"
import { useTranslation } from "react-i18next"

interface FileNotFoundErrorProps {
	filePath: string
	isExpanded?: boolean
	onToggleExpand?: () => void
}

export const FileNotFoundError: React.FC<FileNotFoundErrorProps> = ({
	filePath,
	isExpanded = false,
	onToggleExpand,
}) => {
	const { t } = useTranslation()

	const headerStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		gap: "10px",
		marginBottom: "10px",
		wordBreak: "break-word",
		cursor: onToggleExpand ? "pointer" : "default",
		userSelect: "none",
	}

	const containerStyle: React.CSSProperties = {
		backgroundColor: "var(--vscode-inputValidation-warningBackground)",
		border: "1px solid var(--vscode-inputValidation-warningBorder)",
		borderRadius: "4px",
		padding: "12px",
		marginTop: "8px",
		marginBottom: "8px",
	}

	const iconStyle: React.CSSProperties = {
		color: "var(--vscode-editorWarning-foreground)",
		fontSize: "16px",
		marginBottom: "-1.5px",
	}

	const titleStyle: React.CSSProperties = {
		color: "var(--vscode-editorWarning-foreground)",
		fontWeight: "bold",
	}

	const pathStyle: React.CSSProperties = {
		fontFamily: "var(--vscode-editor-font-family)",
		fontSize: "var(--vscode-editor-font-size)",
		marginTop: "8px",
		marginBottom: "4px",
		wordBreak: "break-all",
	}

	const messageStyle: React.CSSProperties = {
		color: "var(--vscode-foreground)",
		opacity: 0.9,
		fontSize: "var(--vscode-font-size)",
	}

	return (
		<div style={containerStyle}>
			<div style={headerStyle} onClick={onToggleExpand}>
				<span className="codicon codicon-warning" style={iconStyle} />
				<span style={titleStyle}>{t("chat:fileOperations.fileNotFound")}</span>
				{onToggleExpand && (
					<div style={{ flexGrow: 1, display: "flex", justifyContent: "flex-end" }}>
						<span className={`codicon codicon-chevron-${isExpanded ? "up" : "down"}`} />
					</div>
				)}
			</div>
			{(isExpanded || !onToggleExpand) && (
				<>
					<div style={pathStyle}>
						<code>{filePath}</code>
					</div>
					<div style={messageStyle}>{t("chat:fileOperations.fileNotFoundMessage")}</div>
				</>
			)}
		</div>
	)
}
