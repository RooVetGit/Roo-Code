import React from "react"
import styles from "./ChatTextArea.module.css"

interface ChatTextAreaLayoutProps {
	children: {
		input: React.ReactNode
		selections: React.ReactNode
		actions: React.ReactNode
	}
}

const ChatTextAreaLayout: React.FC<ChatTextAreaLayoutProps> = ({ children: { input, selections, actions } }) => {
	return (
		<div
			className="chat-text-area"
			style={{
				position: "relative",
				display: "flex",
				flexDirection: "column",
				backgroundColor: "var(--vscode-input-background)",
				margin: "8px 12px 10px 12px",
				padding: "3px",
				outline: "none",
				border: `1px solid`,
				borderColor: "var(--vscode-input-background)",
				borderRadius: "5px",
				maxWidth: "1200px",
				width: "calc(100% - 22px)",
				marginLeft: "auto",
				marginRight: "auto",
				boxSizing: "border-box",
			}}>
			<div style={{ position: "relative" }}>{input}</div>
			<div className={styles.footer}>
				<div className={styles.selections}>{selections}</div>
				<div className={styles.actions}>{actions}</div>
			</div>
		</div>
	)
}

export default ChatTextAreaLayout
