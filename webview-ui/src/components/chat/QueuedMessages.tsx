import React from "react"
import { useTranslation } from "react-i18next"
import Thumbnails from "../common/Thumbnails"
import { QueuedMessage } from "@roo-code/types"
import { Mention } from "./Mention"
import { Button } from "@src/components/ui"

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
		<div className="px-[15px] py-[10px] pr-[6px]" data-testid="queued-messages">
			<div className="text-vscode-descriptionForeground text-md mb-2">{t("queuedMessages.title")}</div>
			<div className="flex flex-col gap-2">
				{queue.map((message, index) => (
					<div
						key={message.id}
						className="bg-vscode-editor-background border rounded-xs p-1 overflow-hidden whitespace-pre-wrap">
						<div className="flex justify-between">
							<div className="flex-grow px-2 py-1 wrap-anywhere">
								<Mention text={message.text} withShadow />
							</div>
							<div className="flex">
								<Button
									variant="ghost"
									size="icon"
									className="shrink-0"
									onClick={(e) => {
										e.stopPropagation()
										onRemove(index)
									}}>
									<span className="codicon codicon-trash" />
								</Button>
							</div>
						</div>
						{message.images && message.images.length > 0 && (
							<Thumbnails images={message.images} style={{ marginTop: "8px" }} />
						)}
					</div>
				))}
			</div>
		</div>
	)
}

export default QueuedMessages
