import { ToolDirective } from "../ToolDirective"
import { ToolParamName } from "./ToolParamName"

/**
 * Directive for creating a new task instance.
 */
export interface NewTaskToolDirective extends ToolDirective {
	name: "new_task"
	params: Partial<Pick<Record<ToolParamName, string>, "mode" | "message">>
}
