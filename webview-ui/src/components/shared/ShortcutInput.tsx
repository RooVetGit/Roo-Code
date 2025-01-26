import React, { useCallback, useState } from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"

interface ShortcutInputProps {
	value?: string
	onChange: (shortcut: string) => void
	placeholder?: string
}

export const ShortcutInput: React.FC<ShortcutInputProps> = ({
	value,
	onChange,
	placeholder = "Click to record shortcut",
}) => {
	const [isRecording, setIsRecording] = useState(false)
	const isMac = navigator.platform.toLowerCase().includes("mac")
	const altKey = isMac ? "⌥" : "Alt"

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			e.preventDefault()
			if (!isRecording) return

			const keys: string[] = []
			if (e.ctrlKey) keys.push("Ctrl")
			if (e.altKey) keys.push(altKey)
			if (e.shiftKey) keys.push("Shift")

			// Only add the key if it's not a modifier key
			if (!["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
				// Convert key to a readable format
				const key = e.key.length === 1 ? e.key.toUpperCase() : e.key
				keys.push(key)

				// Stop recording and set the shortcut
				setIsRecording(false)
				onChange(keys.join("+"))
			}
		},
		[isRecording, altKey, onChange],
	)

	const handleClear = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			onChange("")
		},
		[onChange],
	)

	return (
		<div
			tabIndex={0}
			onKeyDown={handleKeyDown}
			onClick={() => setIsRecording(true)}
			onBlur={() => setIsRecording(false)}
			style={{
				position: "relative",
				padding: "4px 8px",
				minHeight: "28px",
				backgroundColor: "var(--vscode-input-background)",
				border: "1px solid var(--vscode-input-border)",
				borderRadius: "2px",
				cursor: "pointer",
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				color: value ? "var(--vscode-input-foreground)" : "var(--vscode-input-placeholderForeground)",
			}}>
			<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
				{isRecording ? (
					<span style={{ color: "var(--vscode-inputValidation-infoForeground)" }}>
						Recording... Press your shortcut
					</span>
				) : value ? (
					<span
						style={{
							backgroundColor: "var(--vscode-button-secondaryBackground)",
							padding: "2px 4px",
							borderRadius: "3px",
							fontSize: "0.9em",
						}}>
						{value}
					</span>
				) : (
					placeholder
				)}
			</div>
			{value && !isRecording && (
				<VSCodeButton
					appearance="icon"
					onClick={handleClear}
					style={{ padding: 0, margin: 0, minWidth: "20px" }}>
					<span className="codicon codicon-close" />
				</VSCodeButton>
			)}
		</div>
	)
}
