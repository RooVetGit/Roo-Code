import { ToolDirective } from "../ToolDirective"
import { ToolParamName } from "./ToolParamName"

/**
 * Directive for searching and replacing text or patterns in a file.
 */
export interface SearchAndReplaceToolDirective extends ToolDirective {
	name: "search_and_replace"
	params: Required<Pick<Record<ToolParamName, string>, "path" | "search" | "replace">> &
		Partial<Pick<Record<ToolParamName, string>, "use_regex" | "ignore_case" | "start_line" | "end_line">>
}
