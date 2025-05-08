import { ToolArgs } from "./types"

export function getUseExtToolDescription(args: ToolArgs): string | undefined {
	if (!args.extensionToolManager || args.extensionToolManager.getAllTools().length === 0) {
		return undefined
	}

	return `## use_ext_tool
Description: Request to use a tool provided by a VSCode extension. Extensions can register tools that provide special capabilities. Each tool has defined input parameters that may be required or optional.
Parameters:
- extension_id: (required) The ID of the extension providing the tool
- tool_name: (required) The name of the tool to execute
- arguments: (required) A JSON object containing the tool's input parameters, following the tool's specifications
Usage:
<use_ext_tool>
<extension_id>extension id here</extension_id>
<tool_name>tool name here</tool_name>
<arguments>
{
  "param1": "value1",
  "param2": "value2"
}
</arguments>
</use_ext_tool>

Example: Requesting to use an extension tool

<use_ext_tool>
<extension_id>RooVeterinaryInc.roo-nb</extension_id>
<tool_name>get_notebook_info</tool_name>
<arguments>
{}
</arguments>
</use_ext_tool>`
}
