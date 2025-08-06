import { ToolArgs } from "../../prompts/tools/types"
import { BaseToolSchema } from "./base-tool-schema"

const baseAccessMcpResourceSchema: BaseToolSchema = {
	name: "access_mcp_resource",
	description:
		"Request to access a resource provided by a connected MCP server. Resources represent data sources that can be used as context, such as files, API responses, or system information.",
	parameters: [
		{
			name: "server_name",
			type: "string",
			description: "The name of the MCP server providing the resource",
			required: true,
		},
		{
			name: "uri",
			type: "string",
			description: "The URI identifying the specific resource to access",
			required: true,
		},
	],
}

export const accessMcpResourceSchema: BaseToolSchema = {
	...baseAccessMcpResourceSchema,
	customDescription: (args: ToolArgs) => {
		if (!args.mcpHub) {
			return undefined
		}
		const schema = JSON.parse(JSON.stringify(baseAccessMcpResourceSchema))
		return schema as BaseToolSchema
	},
}
