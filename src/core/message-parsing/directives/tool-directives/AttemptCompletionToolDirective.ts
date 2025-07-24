import { ToolDirective } from "../ToolDirective"
import { ToolParamName } from "./ToolParamName"

/**
 * Directive for attempting to complete a task.
 */
export interface AttemptCompletionToolDirective extends ToolDirective {
	name: "attempt_completion"
	params: Partial<Pick<Record<ToolParamName, string>, "result" | "command">>
}
