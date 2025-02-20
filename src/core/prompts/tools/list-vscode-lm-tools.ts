import { ToolArgs } from "./types"

export function getListVsCodeLmToolsDescription(): string {
    return `## list_vscode_lm_tools
Description: Request to list all available VS Code Language Model tools registered by extensions. This tool provides information about each tool's name, description, and input schema.
Parameters: None required
Usage:
<list_vscode_lm_tools>
</list_vscode_lm_tools>

Example: Requesting to list all VS Code LM tools
<list_vscode_lm_tools>
</list_vscode_lm_tools>`
}