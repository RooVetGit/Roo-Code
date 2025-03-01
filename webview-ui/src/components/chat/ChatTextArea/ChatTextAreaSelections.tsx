import React from "react"
import { Mode, getAllModes } from "../../../../../src/shared/modes"
import { CaretIcon } from "../../common/CaretIcon"
import { vscode } from "../../../utils/vscode"

interface ChatTextAreaSelectionsProps {
	mode: Mode
	setMode: (value: Mode) => void
	currentApiConfigName: string | null | undefined
	listApiConfigMeta: Array<{ name: string }> | undefined
	customModes: any[]
}

const ChatTextAreaSelections: React.FC<ChatTextAreaSelectionsProps> = ({
	mode,
	setMode,
	currentApiConfigName,
	listApiConfigMeta,
	customModes,
}) => {
	const selectStyle = {
		fontSize: "11px",
		fontWeight: 400,
		cursor: "pointer",
		backgroundColor: "var(--vscode-input-background)",
		border: "1px solid color-mix(in srgb, var(--vscode-input-foreground) 35%, var(--vscode-input-background))", // Slightly darker border
		color: "var(--vscode-input-foreground)",
		outline: "none",
		padding: "4px 16px 4px 8px", // Adjusted padding
		borderRadius: "3px",
		WebkitAppearance: "none" as const,
		MozAppearance: "none" as const,
		appearance: "none" as const,
		transition: "border-color 0.1s ease",
		minHeight: "20px",
		maxWidth: "120px",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
		overflow: "hidden",
	}

	const optionStyle = {
		backgroundColor: "var(--vscode-input-background)",
		color: "var(--vscode-input-foreground)",
		fontSize: "11px",
		padding: "2px 4px",
		fontWeight: 400,
		lineHeight: "16px",
		textOverflow: "ellipsis",
		overflow: "hidden",
		whiteSpace: "nowrap",
		maxWidth: "200px", // Wider options in dropdown for readability
	}

	const caretContainerStyle = {
		position: "absolute" as const,
		right: 4,
		top: "50%",
		transform: "translateY(-45%)",
		pointerEvents: "none" as const,
		opacity: 0.6,
		fontSize: "10px", // Slightly smaller caret
	}

	const selectContainerStyle = {
		position: "relative" as const,
		display: "inline-block",
		minWidth: 0, // Allow container to shrink
		flex: "0 1 auto", // Allow shrinking but not growing
	}

	const hoverStyle = {
		"&:hover": {
			borderColor: "var(--vscode-input-border)",
			backgroundColor: "var(--vscode-input-background)",
		},
		"&:focus": {
			outline: "1px solid var(--vscode-focusBorder)",
			outlineOffset: "1px",
		},
	}

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: "4px",
				fontSize: "12px",
				minWidth: 0, // Allow container to shrink
				flex: "1 1 auto", // Allow growing and shrinking
				flexWrap: "wrap", // Allow wrapping on small screens
			}}>
			{/* Editor Mode Dropdown */}
			<div style={selectContainerStyle}>
				<select
					value={mode}
					title="Select mode for interaction"
					onChange={(e) => {
						const value = e.target.value
						if (value === "prompts-action") {
							window.postMessage({ type: "action", action: "promptsButtonClicked" })
							return
						}
						setMode(value as Mode)
						vscode.postMessage({
							type: "mode",
							text: value,
						})
					}}
					style={{
						...selectStyle,
						...hoverStyle,
					}}>
					{getAllModes(customModes).map((mode) => (
						<option key={mode.slug} value={mode.slug} style={optionStyle}>
							{mode.name}
						</option>
					))}
					<option
						disabled
						style={{
							borderTop: "1px solid var(--vscode-dropdown-border)",
							...optionStyle,
						}}>
						────
					</option>
					<option value="prompts-action" style={optionStyle}>
						Edit...
					</option>
				</select>
				<div style={caretContainerStyle}>
					<CaretIcon />
				</div>
			</div>

			{/* API Config Dropdown */}
			<div style={selectContainerStyle}>
				<select
					value={currentApiConfigName || ""}
					title="Select API configuration"
					onChange={(e) => {
						const value = e.target.value
						if (value === "settings-action") {
							window.postMessage({ type: "action", action: "settingsButtonClicked" })
							return
						}
						vscode.postMessage({
							type: "loadApiConfiguration",
							text: value,
						})
					}}
					style={{
						...selectStyle,
						...hoverStyle,
						textOverflow: "ellipsis",
					}}>
					{(listApiConfigMeta || []).map((config) => (
						<option key={config.name} value={config.name} style={optionStyle}>
							{config.name}
						</option>
					))}
					<option
						disabled
						style={{
							borderTop: "1px solid var(--vscode-dropdown-border)",
							...optionStyle,
						}}>
						────
					</option>
					<option value="settings-action" style={optionStyle}>
						Edit...
					</option>
				</select>
				<div style={caretContainerStyle}>
					<CaretIcon />
				</div>
			</div>
		</div>
	)
}

export default ChatTextAreaSelections
