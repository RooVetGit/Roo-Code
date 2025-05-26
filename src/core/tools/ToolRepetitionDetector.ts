import { ToolUse } from "../../shared/tools"
import { t } from "../../i18n"

/**
 * Class for detecting patterns of tool call repetition in recent history
 * to prevent the AI from getting stuck in a loop.
 */
export class ToolRepetitionDetector {
	private toolCallHistory: string[] = []
	private readonly HISTORY_SIZE: number = 5 // Defines the window for checking repetitions
	private readonly REPETITION_THRESHOLD: number // The number of occurrences to trigger detection

	/**
	 * Creates a new ToolRepetitionDetector
	 * @param repetitionLimitInHistory The maximum number of identical tool calls allowed within the history window.
	 */
	constructor(repetitionLimitInHistory: number = 3) {
		this.REPETITION_THRESHOLD = repetitionLimitInHistory
	}

	/**
	 * Checks if the current tool call has been repeated frequently in the recent history
	 * and determines if execution should be allowed.
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
		// Serialize the block to a canonical JSON string for comparison
		const currentToolCallJson = this.serializeToolUse(currentToolCallBlock)

		// Add current call to history
		this.toolCallHistory.push(currentToolCallJson)

		// Trim history if it exceeds HISTORY_SIZE
		if (this.toolCallHistory.length > this.HISTORY_SIZE) {
			this.toolCallHistory.shift() // Remove the oldest entry
		}

		// Count occurrences of the current tool call in the history
		const repetitionCount = this.toolCallHistory.filter(call => call === currentToolCallJson).length

		// Check if repetition threshold is reached
		if (repetitionCount >= this.REPETITION_THRESHOLD) {
			// Reset history to allow recovery if user guides the AI past this point
			this.toolCallHistory = []

			// Return result indicating execution should not be allowed
			return {
				allowExecution: false,
				askUser: {
					messageKey: "mistake_limit_reached", // This key seems appropriate for various error limits
					messageDetail: t("tools:toolRepetitionLimitReached", { toolName: currentToolCallBlock.name }),
				},
			}
		}

		// Execution is allowed
		return { allowExecution: true }
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
