import React from "react"
import { vscode } from "../../../utils/vscode"
import { cn } from "@/lib/utils"

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

const baseActionButton = [
	"text-base relative inline-flex items-center justify-center",
	"bg-transparent border-none outline-none opacity-50",
	"p-1.5 rounded-md transition-all duration-200",
	"min-w-[28px] min-h-[28px] cursor-pointer",
	"text-vscode-foreground",
	"hover:bg-[color:color-mix(in_srgb,var(--vscode-button-hoverBackground)_40%,transparent)]",
	"hover:opacity-75",
]

const disabledButton = "disabled opacity-35 cursor-not-allowed grayscale-[30%] hover:bg-transparent"

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
		<div className="flex items-center gap-0.5 flex-wrap justify-end min-w-0">
			<div className="flex items-center gap-0.5 shrink-0">
				<span
					role="button"
					aria-label="Enhance prompt with additional context"
					title="Enhance prompt with additional context"
					data-testid="enhance-prompt-button"
					onClick={() => !textAreaDisabled && !isEnhancingPrompt && handleEnhancePrompt()}
					className={cn(
						"codicon codicon-sparkle",
						baseActionButton,
						"transition-all duration-300 z-[1] hover:brightness-120",
						textAreaDisabled && disabledButton,
						isEnhancingPrompt && [
							"enhancing",
							"!opacity-100 disabled cursor-progress",
							"bg-gradient-to-r",
							"from-vscode-button-background from-10%",
							"via-[color:color-mix(in_srgb,var(--vscode-charts-yellow)_40%,var(--vscode-button-background))]",
							"via-50%",
							"to-vscode-button-background",
							"to-90%",
							"bg-[length:300%_100%]",
							"animate-border-flow",
						],
					)}
				/>
			</div>
			<span
				role="button"
				aria-label="Add images to message"
				title="Add images to message"
				onClick={() => !shouldDisableImages && onSelectImages()}
				className={cn("codicon codicon-device-camera", baseActionButton, shouldDisableImages && disabledButton)}
			/>
			<span
				role="button"
				aria-label="Send message"
				title="Send message"
				onClick={() => !textAreaDisabled && onSend()}
				className={cn("codicon codicon-send", baseActionButton, textAreaDisabled && disabledButton)}
			/>
		</div>
	)
}

export default ChatTextAreaActions
