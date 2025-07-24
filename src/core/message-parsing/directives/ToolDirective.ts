import { ToolName } from "@roo-code/types"
import { ToolParamName } from "./tool-directives"

export interface ToolDirective {
	type: "tool_use"
	name: ToolName
	// params is a partial record, allowing only some or none of the possible parameters to be used
	params: Partial<Record<ToolParamName, string>>
	partial: boolean
}
