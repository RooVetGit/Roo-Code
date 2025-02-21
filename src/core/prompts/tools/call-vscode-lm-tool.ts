import { ToolArgs } from "./types"

export function getCallVsCodeLmToolDescription(): string {
    return `## call_vscode_lm_tool
Description: Request to invoke a VS Code Language Model tool with specified parameters. The tool must be registered and available through VS Code's Language Model API. Each tool has a defined input schema that specifies required and optional parameters.

Parameters:
- tool_name: (required) The name of the VS Code LM tool to invoke
- arguments: (required) A JSON object containing the tool's input parameters according to its schema

Usage:
<call_vscode_lm_tool>
<tool_name>Tool name here</tool_name>
<arguments>
{
  "param1": "value1",
  "param2": "value2"
}
</arguments>
</call_vscode_lm_tool>

Example: Requesting to call a VS Code LM tool named 'tabCount'
<call_vscode_lm_tool>
<tool_name>tabCount</tool_name>
<arguments>
{
  "tabGroup": 1
}
</arguments>
</call_vscode_lm_tool>`
}