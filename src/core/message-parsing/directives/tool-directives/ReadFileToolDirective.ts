import { ToolDirective } from "../ToolDirective"
import { ToolParamName } from "./ToolParamName"

/**
 * Directive for reading the contents of a file.
 */
export interface ReadFileToolDirective extends ToolDirective {
	name: "read_file"
	params: Partial<Pick<Record<ToolParamName, string>, "args" | "path" | "start_line" | "end_line">>
}
