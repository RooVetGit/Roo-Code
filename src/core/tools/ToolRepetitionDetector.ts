import { ToolUse } from "../../shared/tools"
import { t } from "../../i18n"

/**
 * Class for detecting tool call repetition patterns
 * to prevent the AI from getting stuck in loops.
 * Can detect both consecutive identical calls and pattern repetitions like "abcabc".
 */
export class ToolRepetitionDetector {
	private static readonly HISTORY_RETENTION_ON_RESET = 5

	private previousToolCallJson: string | null = null
	private consecutiveIdenticalToolCallCount: number = 0
	private readonly consecutiveIdenticalToolCallLimit: number

	private toolCallHistory: string[] = []
	private readonly historyMaxLength: number
	private readonly patternRepetitionLimit: number

	/**
	 * Creates a new ToolRepetitionDetector
	 * @param consecutiveLimit The maximum number of identical consecutive tool calls allowed.
	 *                        Setting this to 0 disables ALL repetition detection (both consecutive and pattern).
	 *                        Negative values will be treated as 0.
	 * @param historyLength The maximum length of tool call history to maintain
	 * @param patternLimit The maximum number of pattern repetitions allowed
	 */
	constructor(consecutiveLimit: number = 3, historyLength: number = 20, patternLimit: number = 2) {
		this.consecutiveIdenticalToolCallLimit = Math.max(0, consecutiveLimit)
		this.historyMaxLength = Math.max(1, Math.min(historyLength, 1000)) // reasonable upper bound
		this.patternRepetitionLimit = Math.max(0, patternLimit)
	}

	/**
	 * Checks if the current tool call is identical to the previous one
	 * and determines if execution should be allowed
	 *
	 * @param currentToolCallBlock ToolUse object representing the current tool call
	 * @returns Object indicating if execution is allowed and a message to show if not
	 */
	public check(currentToolCallBlock: ToolUse): {
		allowExecution: boolean
		askUser?: {
			messageKey: string
			messageDetail: string
		}
	} {
		// Skip ALL repetition checks when consecutive limit is 0 (unlimited)
		// This disables both consecutive identical tool call detection AND pattern repetition detection
		if (this.consecutiveIdenticalToolCallLimit <= 0) {
			return { allowExecution: true }
		}

		// Serialize the block to a canonical JSON string for comparison
		const currentToolCallJson = this.serializeToolUse(currentToolCallBlock)

		// Update history record only when detection is enabled
		this.updateHistory(currentToolCallJson)

		// Check for consecutive identical tool calls
		if (this.previousToolCallJson === currentToolCallJson) {
			this.consecutiveIdenticalToolCallCount++
		} else {
			this.consecutiveIdenticalToolCallCount = 1 // First occurrence of new tool
			this.previousToolCallJson = currentToolCallJson
		}

		// Check for pattern repetition
		const patternRepetition = this.detectPatternRepetition()

		// If any type of repetition is detected, prevent execution
		if (this.consecutiveIdenticalToolCallCount >= this.consecutiveIdenticalToolCallLimit || patternRepetition) {
			// Reset counters to allow recovery if user guides the AI past this point
			this.resetState()

			// Return result indicating execution should not be allowed
			return {
				allowExecution: false,
				askUser: {
					messageKey: "mistake_limit_reached",
					messageDetail: t("tools:toolRepetitionLimitReached", { toolName: currentToolCallBlock.name }),
				},
			}
		}

		// Execution is allowed
		return { allowExecution: true }
	}

	/**
	 * Updates the tool call history with the latest call
	 * @param toolCallJson The serialized tool call to add to history
	 */
	private updateHistory(toolCallJson: string): void {
		this.toolCallHistory.push(toolCallJson)

		// Keep history within maximum length
		if (this.toolCallHistory.length > this.historyMaxLength) {
			this.toolCallHistory.shift() // Remove oldest entry
		}
	}

	/**
	 * Detects repeating patterns in the tool call history
	 * @returns true if a pattern repetition is detected beyond the allowed limit
	 */
	private detectPatternRepetition(): boolean {
		const history = this.toolCallHistory
		if (history.length < 4) {
			// Need at least 4 elements to detect a pattern (minimum pattern length is 2, repeated at least twice)
			return false
		}

		// Check patterns of various lengths
		// Start with longer patterns to avoid false positives with short patterns
		const maxPatternLength = Math.floor(history.length / 2)

		for (let patternLength = 2; patternLength <= maxPatternLength; patternLength++) {
			// Check for repeating patterns of current length
			if (this.hasRepeatingPattern(history, patternLength)) {
				return true
			}
		}

		return false
	}

	/**
	 * Checks if the history contains a repeating pattern of specified length
	 * @param history Array of serialized tool calls
	 * @param patternLength Length of the pattern to check
	 * @returns true if a repeating pattern is found beyond the allowed limit
	 */
	private hasRepeatingPattern(history: string[], patternLength: number): boolean {
		if (patternLength <= 0 || history.length < patternLength * 2) {
			return false
		}

		// Get the most recent pattern
		const recentPattern = history.slice(history.length - patternLength)

		// Count how many times this pattern repeats consecutively
		let repetitionCount = 1 // Start with 1 for the pattern itself
		let position = history.length - patternLength - 1

		while (position >= 0) {
			let isMatch = true

			// Check if the current segment matches the pattern
			for (let i = 0; i < patternLength; i++) {
				if (position - i < 0 || history[position - i] !== recentPattern[patternLength - 1 - i]) {
					isMatch = false
					break
				}
			}

			if (isMatch) {
				repetitionCount++
				position -= patternLength

				// If we've found enough repetitions, return true
				if (repetitionCount > this.patternRepetitionLimit) {
					return true
				}
			} else {
				// If we find a non-matching segment, stop searching
				break
			}
		}

		return false
	}

	/**
	 * Resets the detector state to recover from repetition detection
	 */
	private resetState(): void {
		this.consecutiveIdenticalToolCallCount = 0
		this.previousToolCallJson = null
		// Keep last N entries for context
		this.toolCallHistory = this.toolCallHistory.slice(-ToolRepetitionDetector.HISTORY_RETENTION_ON_RESET)
	}

	/**
	 * Serializes a ToolUse object into a canonical JSON string for comparison
	 *
	 * @param toolUse The ToolUse object to serialize
	 * @returns JSON string representation of the tool use with sorted parameter keys
	 */
	private serializeToolUse(toolUse: ToolUse): string {
		// Create a new parameters object with alphabetically sorted keys
		const sortedParams: Record<string, unknown> = {}

		// Get parameter keys and sort them alphabetically
		const sortedKeys = Object.keys(toolUse.params).sort()

		// Populate the sorted parameters object in a type-safe way
		for (const key of sortedKeys) {
			if (Object.prototype.hasOwnProperty.call(toolUse.params, key)) {
				sortedParams[key] = toolUse.params[key as keyof typeof toolUse.params]
			}
		}

		// Create the object with the tool name and sorted parameters
		const toolObject = {
			name: toolUse.name,
			parameters: sortedParams,
		}

		// Convert to a canonical JSON string
		return JSON.stringify(toolObject)
	}
}
