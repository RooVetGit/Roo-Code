import { ToolDirective } from "../ToolDirective"
import { ToolParamName } from "./ToolParamName"

/**
 * Directive for using a tool provided by an MCP server.
 */
export interface UseMcpToolToolDirective extends ToolDirective {
	name: "use_mcp_tool"
	params: Partial<Pick<Record<ToolParamName, string>, "server_name" | "tool_name" | "arguments">>
}
