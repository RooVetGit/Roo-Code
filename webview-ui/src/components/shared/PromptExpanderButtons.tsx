import React, { useCallback, useEffect, useMemo } from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { PromptExpanderPrompt } from "../../../../src/shared/WebviewMessage"

interface PromptExpanderButtonsProps {
	onPromptSelect?: (text: string) => void
	showTitle?: boolean
}

export const PromptExpanderButtons: React.FC<PromptExpanderButtonsProps> = ({ onPromptSelect, showTitle = false }) => {
	const { promptExpanderPrompts = [] } = useExtensionState()

	// Default settings
	const { promptExpanderSettings } = useExtensionState()
		() => ({
			enableShortcuts: true,
			defaultShortcutPattern: "Alt+$N",
		}),
		[],
	)

	const isMac = useMemo(() => navigator.platform.toLowerCase().includes("mac"), [])
	const modifierKey = "Ctrl" // Always use Ctrl, even on Mac
	const altKey = useMemo(() => (isMac ? "⌥" : "Alt"), [isMac])

	const handlePromptClick = useCallback(
		(promptText: string) => {
			if (onPromptSelect) {
				onPromptSelect(promptText)
			}
		},
		[onPromptSelect],
	)

	const getShortcutText = useCallback(
		(index: number, customShortcut?: string) => {
			if (!settings.enableShortcuts) return ""
			if (customShortcut) return customShortcut.replace("Alt", altKey).replace("Ctrl", modifierKey)

			// For indices 0-9 (prompts 1-10), use Cmd/Ctrl+Alt+$N
			if (index < 10) {
				const num = index === 9 ? "0" : (index + 1).toString()
				return `${modifierKey}+${altKey}+${num}`
			}

			// For indices 10-19 (prompts 11-20), use Cmd/Ctrl+Shift+$N
			if (index < 20) {
				const adjustedIndex = index - 10
				const num = adjustedIndex === 9 ? "0" : (adjustedIndex + 1).toString()
				return `${modifierKey}+Shift+${num}`
			}

			// For indices 20+ (prompts 21+), use Alt+Shift+$N
			const adjustedIndex = index - 20
			const num = adjustedIndex % 10 === 9 ? "0" : ((adjustedIndex % 10) + 1).toString()
			return `${altKey}+Shift+${num}`
		},
		[modifierKey, altKey, settings],
	)

	const parseShortcut = useCallback((shortcut: string) => {
		const parts = shortcut.toLowerCase().split("+")
		return {
			alt: parts.includes("alt") || parts.includes("⌥"),
			shift: parts.includes("shift"),
			ctrl: parts.includes("ctrl") || parts.includes("control") || parts.includes("⌘"),
			key: parts[parts.length - 1],
		}
	}, [])

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (!settings.enableShortcuts || !promptExpanderPrompts.length) return

			promptExpanderPrompts.forEach((prompt: PromptExpanderPrompt, index: number) => {
				// Skip disabled prompts
				if (prompt.enabled === false) return

				// If the prompt has a custom shortcut, use that
				if (prompt.shortcut) {
					const shortcut = prompt.shortcut.replace("Alt", altKey).replace("Ctrl", modifierKey)
					const { alt, shift, ctrl, key } = parseShortcut(shortcut)
					const keyMatch = e.key === key || (key.match(/^\d$/) && (e.key === key || e.key === `Numpad${key}`))

					if (keyMatch && e.altKey === alt && e.shiftKey === shift && e.ctrlKey === ctrl) {
						e.preventDefault()
						handlePromptClick(prompt.prompt)
					}
					return
				}

				// For default shortcuts, handle the pattern based on index
				let num
				if (index < 10) {
					// First group (1-10): Ctrl+Alt+$N
					num = index === 9 ? "0" : (index + 1).toString()
					if ((e.key === num || e.key === `Numpad${num}`) && e.ctrlKey && e.altKey && !e.shiftKey) {
						e.preventDefault()
						handlePromptClick(prompt.prompt)
					}
				} else if (index < 20) {
					// Second group (11-20): Ctrl+Shift+$N
					const adjustedIndex = index - 10
					num = adjustedIndex === 9 ? "0" : (adjustedIndex + 1).toString()
					if ((e.key === num || e.key === `Numpad${num}`) && e.ctrlKey && !e.altKey && e.shiftKey) {
						e.preventDefault()
						handlePromptClick(prompt.prompt)
					}
				} else {
					// Third group (21+): Alt+Shift+$N
					const adjustedIndex = index - 20
					num = adjustedIndex % 10 === 9 ? "0" : ((adjustedIndex % 10) + 1).toString()
					if ((e.key === num || e.key === `Numpad${num}`) && !e.ctrlKey && e.altKey && e.shiftKey) {
						e.preventDefault()
						handlePromptClick(prompt.prompt)
					}
				}
			})
		},
		[handlePromptClick, modifierKey, altKey, promptExpanderPrompts, settings.enableShortcuts, parseShortcut],
	)

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [handleKeyDown])

	if (!promptExpanderPrompts.length) return null

	// Filter out invisible prompts for display
	const visiblePrompts = promptExpanderPrompts.filter((prompt) => prompt.visible !== false)

	return (
		<div style={{ padding: showTitle ? "10px" : "0" }}>
			{showTitle && <div style={{ marginBottom: "10px", fontWeight: "500" }}>Quick Prompts</div>}
			<div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
				{visiblePrompts.map((prompt: PromptExpanderPrompt, index: number) => (
					<VSCodeButton
						key={index}
						onClick={() => handlePromptClick(prompt.prompt)}
						style={{ justifyContent: "flex-start", textAlign: "left", width: "100%" }}
						title={`${prompt.prompt}\n\n${
							settings.enableShortcuts && prompt.enabled !== false
								? `Press ${getShortcutText(promptExpanderPrompts.indexOf(prompt), prompt.shortcut)} to quickly insert this prompt.`
								: ""
						} You can edit the text before sending.`}>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								width: "100%",
								gap: "8px",
							}}>
							<span
								style={{
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
									flex: 1,
								}}>
								{prompt.name}
							</span>
							{settings.enableShortcuts && prompt.enabled !== false && (
								<span
									style={{
										opacity: 0.7,
										flexShrink: 0,
										fontSize: "11px",
										padding: "1px 4px",
										backgroundColor: "var(--vscode-keybindingLabel-background)",
										border: "1px solid var(--vscode-keybindingLabel-border)",
										borderRadius: "3px",
										color: "inherit",
										fontFamily: "var(--vscode-editor-font-family)",
										textTransform: "uppercase",
										letterSpacing: "0.1em",
									}}>
									{getShortcutText(promptExpanderPrompts.indexOf(prompt), prompt.shortcut)}
								</span>
							)}
						</div>
					</VSCodeButton>
				))}
			</div>
		</div>
	)
}
