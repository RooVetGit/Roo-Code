import { ToolDirective } from "../ToolDirective"
import { ToolParamName } from "./ToolParamName"

/**
 * Directive for performing browser actions.
 */
export interface BrowserActionToolDirective extends ToolDirective {
	name: "browser_action"
	params: Partial<Pick<Record<ToolParamName, string>, "action" | "url" | "coordinate" | "text" | "size">>
}
