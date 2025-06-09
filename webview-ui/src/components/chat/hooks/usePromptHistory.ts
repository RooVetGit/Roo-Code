import { useCallback, useEffect, useMemo, useState } from "react"

interface TaskHistoryItem {
	task: string
	workspace?: string
}

interface UsePromptHistoryProps {
	taskHistory: TaskHistoryItem[] | undefined
	cwd: string | undefined
	inputValue: string
	setInputValue: (value: string) => void
}

interface CursorPositionState {
	value: string
	afterRender?: "SET_CURSOR_FIRST_LINE" | "SET_CURSOR_LAST_LINE" | "SET_CURSOR_START"
}

export interface UsePromptHistoryReturn {
	historyIndex: number
	setHistoryIndex: (index: number) => void
	tempInput: string
	setTempInput: (input: string) => void
	promptHistory: string[]
	inputValueWithCursor: CursorPositionState
	setInputValueWithCursor: (state: CursorPositionState) => void
	handleHistoryNavigation: (
		event: React.KeyboardEvent<HTMLTextAreaElement>,
		showContextMenu: boolean,
		isComposing: boolean,
	) => boolean
	resetHistoryNavigation: () => void
	resetOnInputChange: (newValue: string) => void
}

export const usePromptHistory = ({
	taskHistory,
	cwd,
	inputValue,
	setInputValue,
}: UsePromptHistoryProps): UsePromptHistoryReturn => {
	// Maximum number of prompts to keep in history for memory management
	const MAX_PROMPT_HISTORY_SIZE = 100

	// Prompt history navigation state
	const [historyIndex, setHistoryIndex] = useState(-1)
	const [tempInput, setTempInput] = useState("")
	const [promptHistory, setPromptHistory] = useState<string[]>([])
	const [inputValueWithCursor, setInputValueWithCursor] = useState<CursorPositionState>({ value: inputValue })

	// Initialize prompt history from task history with performance optimization
	const filteredPromptHistory = useMemo(() => {
		if (!taskHistory || taskHistory.length === 0 || !cwd) {
			return []
		}

		// Extract user prompts from task history for the current workspace only
		const prompts = taskHistory
			.filter((item) => {
				// Filter by workspace and ensure task is not empty
				return item.task && item.task.trim() !== "" && (!item.workspace || item.workspace === cwd)
			})
			.map((item) => item.task)
			// Limit history size to prevent memory issues
			.slice(-MAX_PROMPT_HISTORY_SIZE)

		// taskHistory is already in chronological order (oldest first)
		// We keep it as-is so that navigation works correctly:
		// - Arrow up increases index to go back in history (older prompts)
		// - Arrow down decreases index to go forward (newer prompts)
		return prompts
	}, [taskHistory, cwd])

	// Update prompt history when filtered history changes
	useEffect(() => {
		setPromptHistory(filteredPromptHistory)
	}, [filteredPromptHistory])

	// Reset history navigation when user types (but not when we're setting it programmatically)
	const resetOnInputChange = useCallback(
		(newValue: string) => {
			if (historyIndex !== -1) {
				setHistoryIndex(-1)
				setTempInput("")
			}
		},
		[historyIndex],
	)

	const handleHistoryNavigation = useCallback(
		(event: React.KeyboardEvent<HTMLTextAreaElement>, showContextMenu: boolean, isComposing: boolean): boolean => {
			// Handle prompt history navigation
			if (!showContextMenu && promptHistory.length > 0 && !isComposing) {
				const textarea = event.currentTarget
				const { selectionStart, selectionEnd, value } = textarea
				const lines = value.substring(0, selectionStart).split("\n")
				const currentLineIndex = lines.length - 1
				const totalLines = value.split("\n").length
				const isAtFirstLine = currentLineIndex === 0
				const isAtLastLine = currentLineIndex === totalLines - 1
				const hasSelection = selectionStart !== selectionEnd

				// Only navigate history if cursor is at first/last line and no text is selected
				if (!hasSelection) {
					if (event.key === "ArrowUp" && isAtFirstLine) {
						event.preventDefault()

						// Save current input if starting navigation
						if (historyIndex === -1 && inputValue.trim() !== "") {
							setTempInput(inputValue)
						}

						// Navigate to previous prompt
						const newIndex = historyIndex + 1
						if (newIndex < promptHistory.length) {
							setHistoryIndex(newIndex)
							const historicalPrompt = promptHistory[newIndex]
							setInputValue(historicalPrompt)
							setInputValueWithCursor({
								value: historicalPrompt,
								afterRender: "SET_CURSOR_FIRST_LINE",
							})
						}
						return true
					}

					if (event.key === "ArrowDown" && isAtLastLine) {
						event.preventDefault()

						// Navigate to next prompt
						if (historyIndex > 0) {
							const newIndex = historyIndex - 1
							setHistoryIndex(newIndex)
							const historicalPrompt = promptHistory[newIndex]
							setInputValue(historicalPrompt)
							setInputValueWithCursor({
								value: historicalPrompt,
								afterRender: "SET_CURSOR_LAST_LINE",
							})
						} else if (historyIndex === 0) {
							// Return to current input
							setHistoryIndex(-1)
							setInputValue(tempInput)
							setInputValueWithCursor({
								value: tempInput,
								afterRender: "SET_CURSOR_START",
							})
						}
						return true
					}
				}
			}
			return false
		},
		[promptHistory, historyIndex, inputValue, tempInput, setInputValue],
	)

	const resetHistoryNavigation = useCallback(() => {
		setHistoryIndex(-1)
		setTempInput("")
	}, [])

	return {
		historyIndex,
		setHistoryIndex,
		tempInput,
		setTempInput,
		promptHistory,
		inputValueWithCursor,
		setInputValueWithCursor,
		handleHistoryNavigation,
		resetHistoryNavigation,
		resetOnInputChange,
	}
}
