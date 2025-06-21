import { ToolDirective } from "../ToolDirective"
import { ToolParamName } from "./ToolParamName"

/**
 * Directive for inserting content into a file at a specific line.
 */
export interface InsertCodeBlockToolDirective extends ToolDirective {
	name: "insert_content"
	params: Partial<Pick<Record<ToolParamName, string>, "path" | "line" | "content">>
}
