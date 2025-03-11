import React, { forwardRef, useEffect, useState } from "react"
import ChatTextAreaLayout from "./ChatTextAreaLayout"
import ChatTextAreaInput from "./ChatTextAreaInput"
import ChatTextAreaSelections from "./ChatTextAreaSelections"
import ChatTextAreaActions from "./ChatTextAreaActions"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { ContextMenuOptionType } from "@/utils/context-mentions"
import { Mode } from "../../../../../src/shared/modes"

interface ChatTextAreaProps {
	inputValue: string
	setInputValue: (value: string) => void
	textAreaDisabled: boolean
	placeholderText: string
	selectedImages: string[]
	setSelectedImages: React.Dispatch<React.SetStateAction<string[]>>
	onSend: () => void
	onSelectImages: () => void
	shouldDisableImages: boolean
	onHeightChange?: (height: number) => void
	mode: Mode
	setMode: (value: Mode) => void
	modeShortcutText: string
}

const ChatTextArea = forwardRef<HTMLTextAreaElement, ChatTextAreaProps>(
	(
		{
			inputValue,
			setInputValue,
			textAreaDisabled,
			placeholderText,
			selectedImages,
			setSelectedImages,
			onSend,
			onSelectImages,
			shouldDisableImages,
			onHeightChange,
			mode,
			setMode,
			modeShortcutText,
		},
		ref,
	) => {
		const { filePaths, openedTabs, currentApiConfigName, listApiConfigMeta, customModes, cwd } = useExtensionState()
		const [gitCommits, setGitCommits] = useState<any[]>([])
		const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false)
		const [showDropdown, setShowDropdown] = useState(false)

		// Close dropdown when clicking outside
		useEffect(() => {
			const handleClickOutside = (event: MouseEvent) => {
				if (showDropdown) {
					setShowDropdown(false)
				}
			}
			document.addEventListener("mousedown", handleClickOutside)
			return () => document.removeEventListener("mousedown", handleClickOutside)
		}, [showDropdown])

		// Handle enhanced prompt response
		useEffect(() => {
			const messageHandler = (event: MessageEvent) => {
				const message = event.data
				if (message.type === "enhancedPrompt") {
					if (message.text) {
						setInputValue(message.text)
					}
					setIsEnhancingPrompt(false)
				} else if (message.type === "commitSearchResults") {
					const commits = message.commits.map((commit: any) => ({
						type: ContextMenuOptionType.Git,
						value: commit.hash,
						label: commit.subject,
						description: `${commit.shortHash} by ${commit.author} on ${commit.date}`,
						icon: "$(git-commit)",
					}))
					setGitCommits(commits)
				}
			}
			window.addEventListener("message", messageHandler)
			return () => window.removeEventListener("message", messageHandler)
		}, [setInputValue, setIsEnhancingPrompt])

		return (
			<ChatTextAreaLayout>
				{{
					input: (
						<ChatTextAreaInput
							ref={ref}
							inputValue={inputValue}
							setInputValue={setInputValue}
							textAreaDisabled={textAreaDisabled}
							placeholderText={placeholderText}
							selectedImages={selectedImages}
							setSelectedImages={setSelectedImages}
							onSend={onSend}
							onHeightChange={onHeightChange}
							setMode={setMode}
							customModes={customModes}
							filePaths={filePaths}
							openedTabs={openedTabs}
							gitCommits={gitCommits}
							shouldDisableImages={shouldDisableImages}
							cwd={cwd}
						/>
					),
					selections: (
						<ChatTextAreaSelections
							mode={mode}
							setMode={setMode}
							currentApiConfigName={currentApiConfigName}
							listApiConfigMeta={listApiConfigMeta}
							customModes={customModes}
							modeShortcutText={modeShortcutText}
						/>
					),
					actions: (
						<ChatTextAreaActions
							textAreaDisabled={textAreaDisabled}
							shouldDisableImages={shouldDisableImages}
							isEnhancingPrompt={isEnhancingPrompt}
							inputValue={inputValue}
							setInputValue={setInputValue}
							onSelectImages={onSelectImages}
							onSend={onSend}
							setIsEnhancingPrompt={setIsEnhancingPrompt}
						/>
					),
				}}
			</ChatTextAreaLayout>
		)
	},
)

export default ChatTextArea
