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
import { ToolFactory } from "./ToolFactory"
import { formatResponse } from "../prompts/responses"
import { ToolName } from "../../shared/tool-groups"
import { defaultModeSlug } from "../../shared/modes"
import { validateToolUse } from "../mode-validator"

/**
 * Class responsible for executing tools
 */
export class ToolExecutor {
	private toolFactory: ToolFactory

	constructor() {
		this.toolFactory = ToolFactory.getInstance()
	}

	/**
	 * Execute a tool
	 *
	 * @param cline The Cline instance
	 * @param block The tool use block with parameters
	 * @param askApproval Function to ask for user approval
	 * @param handleError Function to handle errors
	 * @param pushToolResult Function to push tool results
	 * @param removeClosingTag Function to remove closing tags
	 * @param toolDescription Optional function to get tool description
	 * @param askFinishSubTaskApproval Optional function to ask for approval to finish a subtask
	 * @returns True if a tool was executed, false otherwise
	 */
	public async executeToolUse(
		cline: Cline,
		block: ToolUse,
		askApproval: AskApproval,
		handleError: HandleError,
		pushToolResult: PushToolResult,
		removeClosingTag: RemoveClosingTag,
		toolDescription?: ToolDescription,
		askFinishSubTaskApproval?: AskFinishSubTaskApproval,
	): Promise<boolean> {
		// Validate tool use before execution
		const { mode, customModes } = (await cline.providerRef.deref()?.getState()) ?? {}
		try {
			validateToolUse(
				block.name as ToolName,
				mode ?? defaultModeSlug,
				customModes ?? [],
				{
					apply_diff: cline.diffEnabled,
				},
				block.params,
			)
		} catch (error) {
			cline.consecutiveMistakeCount++
			pushToolResult(formatResponse.toolError(error.message))
			return true
		}

		// Get the tool implementation
		const tool = this.toolFactory.getTool(block.name)
		if (!tool) {
			cline.consecutiveMistakeCount++
			pushToolResult(formatResponse.toolError(`Unknown tool: ${block.name}`))
			return true
		}

		// Execute the tool
		await tool.execute(
			cline,
			block,
			askApproval,
			handleError,
			pushToolResult,
			removeClosingTag,
			toolDescription,
			askFinishSubTaskApproval,
		)

		return true
	}
}
