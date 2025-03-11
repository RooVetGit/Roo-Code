import React from "react"
import { Mode, getAllModes } from "../../../../../src/shared/modes"
import { SelectDropdown, DropdownOptionType } from "@/components/ui"
import { vscode } from "../../../utils/vscode"

interface ChatTextAreaSelectionsProps {
	mode: Mode
	setMode: (value: Mode) => void
	currentApiConfigName: string | null | undefined
	listApiConfigMeta: Array<{ name: string }> | undefined
	customModes: any[]
	modeShortcutText: string
}

const ChatTextAreaSelections: React.FC<ChatTextAreaSelectionsProps> = ({
	mode,
	setMode,
	currentApiConfigName,
	listApiConfigMeta,
	customModes,
	modeShortcutText,
}) => {
	return (
		<div className="flex items-center gap-1 text-xs min-w-0 flex-1 flex-wrap">
			{/* Editor Mode Dropdown */}
			<SelectDropdown
				value={mode}
				title="Select mode for interaction"
				options={[
					// Add the shortcut text as a disabled option at the top
					{
						value: "shortcut",
						label: modeShortcutText,
						disabled: true,
						type: DropdownOptionType.SHORTCUT,
					},
					// Add all modes
					...getAllModes(customModes).map((mode) => ({
						value: mode.slug,
						label: mode.name,
						type: DropdownOptionType.ITEM,
					})),
					// Add separator
					{
						value: "sep-1",
						label: "Separator",
						type: DropdownOptionType.SEPARATOR,
					},
					// Add Edit option
					{
						value: "promptsButtonClicked",
						label: "Edit...",
						type: DropdownOptionType.ACTION,
					},
				]}
				onChange={(value) => {
					setMode(value as Mode)
					vscode.postMessage({
						type: "mode",
						text: value,
					})
				}}
				shortcutText={modeShortcutText}
				triggerClassName="w-full"
			/>

			{/* API Config Dropdown */}
			<SelectDropdown
				value={currentApiConfigName || ""}
				title="Select API configuration"
				options={[
					// Add all API configurations
					...(listApiConfigMeta || []).map((config) => ({
						value: config.name,
						label: config.name,
						type: DropdownOptionType.ITEM,
					})),
					// Add separator
					{
						value: "sep-2",
						label: "Separator",
						type: DropdownOptionType.SEPARATOR,
					},
					// Add Edit option
					{
						value: "settingsButtonClicked",
						label: "Edit...",
						type: DropdownOptionType.ACTION,
					},
				]}
				onChange={(value) => {
					vscode.postMessage({
						type: "loadApiConfiguration",
						text: value,
					})
				}}
				contentClassName="max-h-[300px] overflow-y-auto"
				triggerClassName="w-full text-ellipsis overflow-hidden"
			/>
		</div>
	)
}

export default ChatTextAreaSelections
