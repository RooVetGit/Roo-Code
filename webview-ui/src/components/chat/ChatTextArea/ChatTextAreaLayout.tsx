import React from "react"
import { cn } from "@/lib/utils"

interface ChatTextAreaLayoutProps {
	children: {
		input: React.ReactNode
		selections: React.ReactNode
		actions: React.ReactNode
	}
}

const ChatTextAreaLayout: React.FC<ChatTextAreaLayoutProps> = ({ children: { input, selections, actions } }) => {
	const containerClasses = cn(
		"relative flex flex-col",
		"bg-vscode-input-background",
		"m-[8px_12px_10px] p-[3px]",
		"outline-none",
		"border border-solid border-vscode-input-background rounded-md",
		"max-w-[1200px] w-[calc(100%-22px)] mx-auto",
		"box-border",
	)

	const footerClasses = cn(
		"flex pt-2 pl-[2px]",
		"gap-[10px]",
		"[&>*]:flex-wrap",
		"min-[480px]:flex-row min-[480px]:justify-between min-[480px]:items-center",
	)

	const selectionsClasses = cn("flex gap-[6px] items-center", "flex-1 min-w-0 flex-wrap")

	const actionsClasses = cn("flex gap-[6px] items-center", "justify-end flex-wrap")

	return (
		<div className={containerClasses}>
			<div className="relative">{input}</div>
			<div className={footerClasses}>
				<div className={selectionsClasses}>{selections}</div>
				<div className={actionsClasses}>{actions}</div>
			</div>
		</div>
	)
}

export default ChatTextAreaLayout
