import React from "react"
import { useTranslation } from "react-i18next"

interface FileNotFoundErrorProps {
	filePaths: string | string[]
}

export const FileNotFoundError: React.FC<FileNotFoundErrorProps> = ({ filePaths }) => {
	const { t } = useTranslation()
	const paths = Array.isArray(filePaths) ? filePaths : [filePaths]
	const isMultiple = paths.length > 1

	return (
		<div
			style={{
				marginTop: "8px",
				marginBottom: "8px",
			}}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "10px",
					marginBottom: "8px",
					fontSize: "var(--vscode-font-size)",
					color: "var(--vscode-editor-foreground)",
				}}>
				<span
					className="codicon codicon-warning"
					style={{
						color: "var(--vscode-editorWarning-foreground)",
						opacity: 0.8,
						fontSize: 16,
						marginBottom: "-1.5px",
					}}
				/>
				<span style={{ fontWeight: "bold" }}>
					{isMultiple ? t("chat:fileOperations.filesNotFound") : t("chat:fileOperations.fileNotFound")}
				</span>
			</div>
			<div
				style={{
					paddingLeft: "26px", // Align with text after icon (16px icon + 10px gap)
				}}>
				{paths.map((path, index) => (
					<div
						key={index}
						style={{
							fontFamily: "var(--vscode-editor-font-family)",
							fontSize: "var(--vscode-editor-font-size)",
							marginBottom: index === paths.length - 1 ? "8px" : "4px",
							wordBreak: "break-all",
							color: "var(--vscode-foreground)",
						}}>
						<code>{path}</code>
					</div>
				))}
				<div
					style={{
						color: "var(--vscode-descriptionForeground)",
						fontSize: "var(--vscode-font-size)",
					}}>
					{isMultiple
						? t("chat:fileOperations.filesNotFoundMessage")
						: t("chat:fileOperations.fileNotFoundMessage")}
				</div>
			</div>
		</div>
	)
}
