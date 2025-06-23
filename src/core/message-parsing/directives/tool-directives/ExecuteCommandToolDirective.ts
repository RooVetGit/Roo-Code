import { ToolDirective } from "../ToolDirective"
import { ToolParamName } from "./ToolParamName"

/**
 * Directive for executing a command on the system.
 */
export interface ExecuteCommandToolDirective extends ToolDirective {
	name: "execute_command"
	// Pick<Record<ToolParamName, string>, "command"> makes "command" required, but Partial<> makes it optional
	params: Partial<Pick<Record<ToolParamName, string>, "command" | "cwd">>
}
