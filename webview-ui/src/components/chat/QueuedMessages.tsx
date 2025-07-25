import React from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { useTranslation } from "react-i18next"
import Thumbnails from "../common/Thumbnails"
import { QueuedMessage } from "./types"

interface QueuedMessagesProps {
	queue: QueuedMessage[]
	onRemove: (index: number) => void
}

const QueuedMessages: React.FC<QueuedMessagesProps> = ({ queue, onRemove }) => {
	const { t } = useTranslation("chat")

	if (queue.length === 0) {
		return null
	}

	return (
		<div className="p-2 border-t border-vscode-panel-border" data-testid="queued-messages">
			<div className="text-vscode-descriptionForeground mb-2">{t("queuedMessages.title")}</div>
			<div className="flex flex-col gap-2">
				{queue.map((message, index) => (
					<div key={index} className="flex items-center gap-2 p-2 rounded-md bg-vscode-input-background">
						<div className="flex-grow">
							<p className="text-vscode-input-foreground">{message.text}</p>
							{message.images.length > 0 && (
								<div className="mt-2">
									<Thumbnails images={message.images} />
								</div>
							)}
						</div>
						<VSCodeButton
							appearance="icon"
							aria-label={t("queuedMessages.removeMessage")}
							onClick={() => onRemove(index)}
							onKeyDown={(e: React.KeyboardEvent) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault()
									onRemove(index)
								}
							}}
							tabIndex={0}>
							<span className="codicon codicon-close"></span>
						</VSCodeButton>
					</div>
				))}
			</div>
		</div>
	)
}

export default QueuedMessages
