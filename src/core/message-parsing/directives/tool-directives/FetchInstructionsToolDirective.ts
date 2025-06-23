import { ToolDirective } from "../ToolDirective"
import { ToolParamName } from "./ToolParamName"

/**
 * Directive for fetching instructions to perform a task.
 */
export interface FetchInstructionsToolDirective extends ToolDirective {
	name: "fetch_instructions"
	params: Partial<Pick<Record<ToolParamName, string>, "task">>
}
