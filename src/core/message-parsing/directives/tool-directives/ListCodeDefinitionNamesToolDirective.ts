import { ToolDirective } from "../ToolDirective"
import { ToolParamName } from "./ToolParamName"

/**
 * Directive for listing definition names from source code.
 */
export interface ListCodeDefinitionNamesToolDirective extends ToolDirective {
	name: "list_code_definition_names"
	params: Partial<Pick<Record<ToolParamName, string>, "path">>
}
