import React from "react"
import { vscode } from "../../../utils/vscode"
import styles from "./ChatTextArea.module.css"

interface ChatTextAreaActionsProps {
	textAreaDisabled: boolean
	shouldDisableImages: boolean
	isEnhancingPrompt: boolean
	inputValue: string
	setInputValue: (value: string) => void
	onSelectImages: () => void
	onSend: () => void
	setIsEnhancingPrompt: (value: boolean) => void
}

const ChatTextAreaActions: React.FC<ChatTextAreaActionsProps> = ({
	textAreaDisabled,
	shouldDisableImages,
	isEnhancingPrompt,
	inputValue,
	setInputValue,
	onSelectImages,
	onSend,
	setIsEnhancingPrompt,
}) => {
	const handleEnhancePrompt = () => {
		if (!textAreaDisabled) {
			const trimmedInput = inputValue.trim()
			if (trimmedInput) {
				setIsEnhancingPrompt(true)
				const message = {
					type: "enhancePrompt" as const,
					text: trimmedInput,
				}
				vscode.postMessage(message)
			} else {
				const promptDescription =
					"The 'Enhance Prompt' button helps improve your prompt by providing additional context, clarification, or rephrasing. Try typing a prompt in here and clicking the button again to see how it works."
				setInputValue(promptDescription)
			}
		}
	}

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: "2px",
				flexWrap: "wrap",
				justifyContent: "flex-end",
				minWidth: 0,
			}}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "2px",
					flexShrink: 0,
				}}>
				<span
					role="button"
					aria-label="Enhance prompt with additional context"
					title="Enhance prompt with additional context"
					data-testid="enhance-prompt-button"
					onClick={() => !textAreaDisabled && !isEnhancingPrompt && handleEnhancePrompt()}
					style={{ fontSize: 16 }}
					className={`codicon codicon-sparkle ${styles["action-button"]} ${styles["codicon-sparkle"]} ${textAreaDisabled ? styles.disabled : ""} ${isEnhancingPrompt ? styles.enhancing : ""}`}
				/>
			</div>
			<span
				role="button"
				aria-label="Add images to message"
				title="Add images to message"
				className={`codicon codicon-device-camera ${styles["action-button"]} ${shouldDisableImages ? styles.disabled : ""}`}
				onClick={() => !shouldDisableImages && onSelectImages()}
				style={{ fontSize: 16 }}
			/>
			<span
				role="button"
				aria-label="Send message"
				title="Send message"
				className={`codicon codicon-send ${styles["action-button"]} ${textAreaDisabled ? styles.disabled : ""}`}
				onClick={() => !textAreaDisabled && onSend()}
				style={{ fontSize: 16 }}
			/>
		</div>
	)
}

export default ChatTextAreaActions
