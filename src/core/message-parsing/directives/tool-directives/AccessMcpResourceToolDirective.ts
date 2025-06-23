import { ToolDirective } from "../ToolDirective"
import { ToolParamName } from "./ToolParamName"

/**
 * Directive for accessing a resource provided by an MCP server.
 */
export interface AccessMcpResourceToolDirective extends ToolDirective {
	name: "access_mcp_resource"
	params: Partial<Pick<Record<ToolParamName, string>, "server_name" | "uri">>
}
