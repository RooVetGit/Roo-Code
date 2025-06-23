import { ToolDirective } from "../ToolDirective"
import { ToolParamName } from "./ToolParamName"

/**
 * Directive for searching the codebase.
 */
export interface CodebaseSearchToolDirective extends ToolDirective {
	name: "codebase_search"
	params: Partial<Pick<Record<ToolParamName, string>, "query" | "path">>
}
