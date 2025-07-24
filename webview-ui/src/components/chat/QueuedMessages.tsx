import React from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import Thumbnails from "../common/Thumbnails"

interface QueuedMessage {
	text: string
	images: string[]
}

interface QueuedMessagesProps {
	queue: QueuedMessage[]
	onRemove: (index: number) => void
}

const QueuedMessages: React.FC<QueuedMessagesProps> = ({ queue, onRemove }) => {
	if (queue.length === 0) {
		return null
	}

	return (
		<div className="p-2 border-t border-vscode-panel-border">
			<div className="text-vscode-descriptionForeground mb-2">Queued Messages:</div>
			<div className="flex flex-col gap-2">
				{queue.map((message, index) => (
					<div key={index} className="flex items-center gap-2 p-2 rounded-md bg-vscode-input-background">
						<div className="flex-grow">
							<p className="text-vscode-input-foreground">{message.text}</p>
							{message.images.length > 0 && (
								<Thumbnails images={message.images} style={{ marginTop: "8px" }} />
							)}
						</div>
						<VSCodeButton appearance="icon" aria-label="Remove message" onClick={() => onRemove(index)}>
							<span className="codicon codicon-close"></span>
						</VSCodeButton>
					</div>
				))}
			</div>
		</div>
	)
}

export default QueuedMessages
