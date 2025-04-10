import { Cline } from "../Cline"
import { ToolUse } from "../assistant-message"
import {
	AskApproval,
	HandleError,
	PushToolResult,
	RemoveClosingTag,
	AskFinishSubTaskApproval,
	ToolDescription,
} from "./types"
import { ToolResponse } from "../Cline"

/**
 * Base abstract class for all tools
 * This provides a common interface for all tools and handles common functionality
 */
export abstract class BaseTool {
	/**
	 * Execute the tool
	 *
	 * @param cline The Cline instance
	 * @param block The tool use block with parameters
	 * @param askApproval Function to ask for user approval
	 * @param handleError Function to handle errors
	 * @param pushToolResult Function to push tool results
	 * @param removeClosingTag Function to remove closing tags
	 * @param toolDescription Optional function to get tool description
	 * @param askFinishSubTaskApproval Optional function to ask for approval to finish a subtask
	 */
	public abstract execute(
		cline: Cline,
		block: ToolUse,
		askApproval: AskApproval,
		handleError: HandleError,
		pushToolResult: PushToolResult,
		removeClosingTag: RemoveClosingTag,
		toolDescription?: ToolDescription,
		askFinishSubTaskApproval?: AskFinishSubTaskApproval,
	): Promise<void>

	/**
	 * Get the name of the tool
	 *
	 * @returns The name of the tool
	 */
	public abstract getName(): string

	/**
	 * Validate required parameters for the tool
	 *
	 * @param cline The Cline instance
	 * @param block The tool use block with parameters
	 * @param pushToolResult Function to push tool results
	 * @param requiredParams Array of required parameter names
	 * @returns True if all required parameters are present, false otherwise
	 */
	protected async validateRequiredParams(
		cline: Cline,
		block: ToolUse,
		pushToolResult: PushToolResult,
		requiredParams: string[],
	): Promise<boolean> {
		for (const param of requiredParams) {
			if (!block.params[param]) {
				cline.consecutiveMistakeCount++
				pushToolResult(await cline.sayAndCreateMissingParamError(this.getName() as any, param))
				return false
			}
		}
		return true
	}

	/**
	 * Handle partial tool execution
	 *
	 * @param cline The Cline instance
	 * @param block The tool use block with parameters
	 * @param partialMessage The partial message to send
	 * @returns True if the tool is partial and was handled, false otherwise
	 */
	protected async handlePartial(cline: Cline, block: ToolUse, partialMessage: string): Promise<boolean> {
		if (block.partial) {
			await cline.ask("tool", partialMessage, block.partial).catch(() => {})
			return true
		}
		return false
	}
}
